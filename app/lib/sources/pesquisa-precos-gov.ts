import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Pesquisa de Preços (Compras.gov.br) — Busca por Descrição
// Mesmo backend de https://pesquisaprecos.compras.gov.br
// API pública: https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarMaterial
// Modo "tipo=descricao" busca diretamente pela descrição do item, sem precisar
// mapear para código PDM antecipadamente — mais rápido e mais próximo do que o
// pesquisador faz manualmente na interface do governo.
const BASE = "https://dadosabertos.compras.gov.br";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string): Promise<any | null> {
  for (let t = 0; t < 3; t++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(25_000),
      });
      if (res.status === 429 || res.status === 503) { await sleep(1500); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(1200); }
  }
  return null;
}

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function calcSim(descricao: string, termos: string[]): number {
  if (!termos.length) return 50;
  const d = norm(descricao);
  const hits = termos.filter((t) => d.includes(t));
  return Math.min(100, Math.round((hits.length / termos.length) * 100));
}

// Tenta construir link PNCP a partir dos dados disponíveis no resultado da API.
// O dadosabertos retorna codigoUasg mas não CNPJ diretamente.
// Quando tiver cnpjOrgao (campo extra que alguns endpoints retornam), usa-o.
// Caso contrário, gera link de busca no PNCP para o objeto da compra.
function gerarLinkPncp(r: any, termosBusca: string): string | null {
  // Tentativa 1: cnpjOrgao direto no resultado
  const cnpj = (r?.cnpjOrgao || r?.cnpj || "").replace(/[^\d]/g, "");
  const seq = r?.sequencialCompra || r?.numeroSequencialCompra;
  const ano = r?.anoCompra || (r?.dataCompra ? String(r.dataCompra).slice(0, 4) : null);
  if (cnpj.length === 14 && seq && ano) {
    return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${Number(seq)}`;
  }

  // Tentativa 2: numeroControlePNCP no formato "{cnpj14}-{seq}/{ano}"
  const ncp = r?.numeroControlePNCP || "";
  const m = ncp.match(/^(\d{14})-(\d+)\/(\d{4})$/);
  if (m) return `https://pncp.gov.br/app/editais/${m[1]}/${m[3]}/${parseInt(m[2], 10)}`;

  // Fallback: busca no PNCP pelo objeto da compra
  const query = encodeURIComponent(r?.objetoCompra || r?.descricaoItem || termosBusca || "");
  if (query) return `https://pncp.gov.br/app/editais?q=${query}`;
  return null;
}

export async function buscarPesquisaPrecosGov(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20, dataInicial, dataFinal, uf } = params;
  const termos = norm(termo)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);

  const fim = dataFinal || new Date().toISOString().slice(0, 10);
  const inicio = dataInicial || (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  })();

  // Extrai a palavra principal do termo (mais longa, não stopword)
  const STOPWORDS = new Set([
    "para","com","uso","pro","sem","sobre","sob","ate","mais","menos",
    "bem","tipo","item","unidade","valor","aquisicao","fornecimento",
    "contratacao","compra","compras","prestacao","servico","servicos",
    "objeto","eventual","eventuais","diversos","diversas",
    "nas","nos","na","no","da","do","de","dos","das","em","por",
    "uma","um","ou","e","o","os","as","a","ao","aos","que",
  ]);
  const termoPrincipal = termos
    .filter((t) => !STOPWORDS.has(t) && !/^\d+$/.test(t))
    .sort((a, b) => b.length - a.length)[0] || termos[0] || termo;

  try {
    const url = new URL(`${BASE}/modulo-pesquisa-preco/1_consultarMaterial`);
    url.searchParams.set("tipo", "descricao");
    url.searchParams.set("codigo", termoPrincipal);
    url.searchParams.set("dataCompraInicio", inicio);
    url.searchParams.set("dataCompraFim", fim);
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("tamanhoPagina", String(Math.min(Math.max(tamanhoPagina, 10), 50)));
    if (uf) url.searchParams.set("estado", uf);

    const dados = await getJson(url.toString());
    if (!dados?.resultado?.length) {
      // Tenta com o termo completo se não achou com a palavra principal
      if (termoPrincipal !== termo) {
        const url2 = new URL(`${BASE}/modulo-pesquisa-preco/1_consultarMaterial`);
        url2.searchParams.set("tipo", "descricao");
        url2.searchParams.set("codigo", norm(termo).slice(0, 60));
        url2.searchParams.set("dataCompraInicio", inicio);
        url2.searchParams.set("dataCompraFim", fim);
        url2.searchParams.set("pagina", "1");
        url2.searchParams.set("tamanhoPagina", "20");
        const dados2 = await getJson(url2.toString());
        if (!dados2?.resultado?.length) return { fonte: "pesquisa_precos_gov", items: [], total: 0 };
        return mapResultados(dados2.resultado, termos, termo);
      }
      return { fonte: "pesquisa_precos_gov", items: [], total: 0 };
    }

    return mapResultados(dados.resultado, termos, termo);
  } catch (err) {
    return { fonte: "pesquisa_precos_gov", items: [], total: 0, erro: String(err) };
  }
}

function mapResultados(resultado: any[], termos: string[], termoBusca: string): ResultadoFonte {
  const items: ResultadoBruto[] = resultado.map((r: any) => {
    const valorUnitario = r.precoUnitario != null ? Number(r.precoUnitario) : null;
    const quantidade = r.quantidade != null ? Number(r.quantidade) : null;
    const descricao = r.descricaoItem || r.nomePdm || termoBusca;
    return {
      fonte: "pesquisa_precos_gov" as const,
      orgao: r.nomeUasg || r.nomeOrgao || "Órgão público",
      descricao,
      quantidade,
      dataContrato: r.dataCompra || null,
      valorUnitario,
      valorTotal:
        valorUnitario != null && quantidade != null
          ? valorUnitario * quantidade
          : valorUnitario,
      localizacao: r.municipio
        ? `${r.municipio}/${r.estado || ""}`.replace(/\/$/, "")
        : r.estado || null,
      similaridade: calcSim(descricao, termos),
      documentoOrigem: r.idCompra ? String(r.idCompra) : null,
      linkEdital: gerarLinkPncp(r, termoBusca),
      dadosBrutos: {
        ...r,
        // campos extras para exibição na UI (imagem #4)
        _fornecedor: r.nomeFornecedor || null,
        _marca: r.marca || null,
        _codigoUasg: r.codigoUasg || null,
        _numeroItemCompra: r.numeroItemCompra || null,
        _objetoCompra: r.objetoCompra || null,
        _esfera: r.esfera || r.poder || null,
        _modalidade: r.modalidade || null,
        _cnpjFornecedor: r.cnpjFornecedor || null,
        _criterioJulgamento: r.criterioJulgamento || null,
        _unidadeFornecimento: r.unidadeFornecimento || null,
      } as Record<string, unknown>,
    };
  });

  items.sort((a, b) => b.similaridade - a.similaridade);
  return { fonte: "pesquisa_precos_gov", items, total: items.length };
}
