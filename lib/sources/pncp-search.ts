import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// ─── PNCP — Busca textual via endpoint de pesquisa ───────────────────────────
// Usa o endpoint de pesquisa do PNCP que suporta q= (texto livre).
// Retorna links reais no formato: https://pncp.gov.br/app/editais/{cnpj}/{ano}/{seq}
//
// O WAF do PNCP pode bloquear IPs fora do Brasil; use PNCP_PROXY_URL se necessário.
const PROXY_BASE = (process.env.PNCP_PROXY_URL || "").replace(/\/$/, "");
const SEARCH_BASE = "https://pncp.gov.br/api/search";
const CONSULTA_BASE = "https://pncp.gov.br/api/consulta";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function calcSimilaridade(descricao: string, termos: string[]): number {
  const d = norm(descricao);
  if (!termos.length) return 0;
  const hits = termos.filter(t => d.includes(t));
  return Math.round((hits.length / termos.length) * 100);
}

// Converte numeroControlePNCP (formato CNPJ14-mod-seq/ano) → URL edital
function buildLink(numeroControlePNCP: string | undefined | null): string | null {
  if (!numeroControlePNCP) return null;
  const match = String(numeroControlePNCP).match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
  if (match) {
    return `https://pncp.gov.br/app/editais/${match[1]}/${match[3]}/${parseInt(match[2], 10)}`;
  }
  return null;
}

async function fetchJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function buscarPNCPSearch(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20, dataInicial, dataFinal } = params;
  const termos = norm(termo).split(/\s+/).filter(t => t.length > 2);

  // Estratégia 1: endpoint /api/search (busca textual, se disponível)
  const searchUrl = new URL(PROXY_BASE ? `${PROXY_BASE}/api/search` : SEARCH_BASE);
  searchUrl.searchParams.set("q", termo);
  searchUrl.searchParams.set("pagina", String(pagina));
  searchUrl.searchParams.set("tamanhoPagina", String(Math.min(tamanhoPagina, 40)));
  searchUrl.searchParams.set("tipos_documento", "edital");
  if (dataInicial) searchUrl.searchParams.set("dataInicial", dataInicial.replace(/-/g, ""));
  if (dataFinal) searchUrl.searchParams.set("dataFinal", dataFinal.replace(/-/g, ""));

  let raw: any[] = [];

  const d1 = await fetchJson(searchUrl.toString());
  if (d1?.items?.length || d1?.data?.length || Array.isArray(d1)) {
    raw = Array.isArray(d1) ? d1 : d1?.items || d1?.data || [];
  }

  // Estratégia 2 (fallback): /api/consulta/v1/contratacoes/publicacao com múltiplas modalidades
  if (!raw.length) {
    const base = PROXY_BASE ? `${PROXY_BASE}/api/consulta` : CONSULTA_BASE;
    // Tenta modalidades: 6=Diálogo Competitivo, 7=Leilão, 8=Pregão, 9=Concorrência
    for (const mod of [8, 6, 9]) {
      const url = new URL(`${base}/v1/contratacoes/publicacao`);
      const dataFim = (dataFinal || new Date().toISOString().slice(0, 10)).replace(/-/g, "");
      const dataIni = (() => {
        const d = new Date(); d.setDate(d.getDate() - 365);
        return (dataInicial || d.toISOString().slice(0, 10)).replace(/-/g, "");
      })();
      url.searchParams.set("dataInicial", dataIni);
      url.searchParams.set("dataFinal", dataFim);
      url.searchParams.set("codigoModalidadeContratacao", String(mod));
      url.searchParams.set("pagina", String(pagina));
      url.searchParams.set("tamanhoPagina", "50");

      const d = await fetchJson(url.toString());
      const lote: any[] = Array.isArray(d) ? d : d?.data || d?.items || [];
      const filtrados = lote.filter((r: any) => {
        const texto = norm(r?.objetoCompra || r?.descricao || "");
        return termos.some(t => texto.includes(t));
      });
      raw.push(...filtrados);
      if (raw.length >= tamanhoPagina) break;
    }
  }

  const items: ResultadoBruto[] = raw.map((r: any) => {
    const orgao = r?.orgaoEntidade || {};
    const unidade = r?.unidadeOrgao || {};
    const cnpj = (orgao?.cnpj || r?.cnpj || "").replace(/\D/g, "");
    const anoCompra = r?.anoCompra || r?.ano;
    const seqCompra = r?.sequencialCompra || r?.sequencial;
    const numeroControlePNCP = r?.numeroControlePNCP || r?.numero_controle_pncp;

    let linkEdital: string | null = null;
    if (cnpj && anoCompra && seqCompra != null) {
      linkEdital = `https://pncp.gov.br/app/editais/${cnpj}/${anoCompra}/${seqCompra}`;
    } else {
      linkEdital = buildLink(numeroControlePNCP);
    }

    const estimado = r?.valorTotalEstimado != null ? Number(r.valorTotalEstimado) : null;
    const homologado = r?.valorTotalHomologado != null ? Number(r.valorTotalHomologado) : null;
    const valor = homologado && homologado > 0 ? homologado : estimado;

    return {
      fonte: "pncp" as const,
      orgao: unidade?.nomeUnidade || orgao?.razaoSocial || r?.nome_orgao || "Órgão público",
      descricao: r?.objetoCompra || r?.descricao || r?.objeto || "Sem descrição",
      quantidade: null,
      dataContrato: r?.dataPublicacaoPncp || r?.dataAberturaProposta || r?.data || null,
      valorUnitario: null,
      valorTotal: Number.isFinite(valor) ? valor : null,
      localizacao: unidade?.municipioNome
        ? `${unidade.municipioNome}/${unidade?.ufSigla || ""}`
        : unidade?.ufSigla || r?.uf || null,
      similaridade: calcSimilaridade(r?.objetoCompra || r?.descricao || "", termos),
      documentoOrigem: numeroControlePNCP || `${cnpj}-${anoCompra}-${seqCompra}` || null,
      linkEdital,
      dadosBrutos: r as unknown as Record<string, unknown>,
    };
  });

  items.sort((a, b) => b.similaridade - a.similaridade);

  return {
    fonte: "pncp",
    items: items.slice(0, tamanhoPagina),
    total: items.length,
    erro: items.length === 0 ? "PNCP não retornou resultados (verifique acesso à rede ou proxy BR)" : undefined,
  };
}
