import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Pesquisa de Preços em Dados Abertos — Compras.gov.br
// https://dadosabertos.compras.gov.br (API pública, sem login, acessível fora do Brasil)
const BASE = "https://dadosabertos.compras.gov.br";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CACHE_MS = 24 * 60 * 60 * 1000; // 24h

interface Pdm {
  codigoGrupo: number;
  nomeGrupo: string;
  codigoClasse: number;
  nomeClasse: string;
  codigoPdm: number;
  nomePdm: string;
  statusPdm: boolean;
}

interface RegistroPreco {
  dataCompra: string;
  precoUnitario: number;
  quantidade: number;
  descricaoItem: string;
  nomeFornecedor?: string;
  marca?: string;
  nomeUasg?: string;
  estado?: string;
  municipio?: string;
  poder?: string;
  esfera?: string;
  idCompra: number;
  numeroItemCompra?: number;
  codigoItemCatalogo?: number;
  codigoPdm?: number;
  nomePdm?: string;
  objetoCompra?: string;
}

async function getJson(url: string): Promise<any | null> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(30_000),
        next: { revalidate: 3600 },
      });
      if (res.status === 429 || res.status === 400 || res.status === 500) {
        await sleep(1200);
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch {
      await sleep(1200);
    }
  }
  return null;
}

// ---- cache da lista de PDMs (pesquisa local) ----
const g = globalThis as any;
function cachePdms(): { pdms: Pdm[]; ts: number } | undefined {
  return g.__precosAbertosPdms;
}

async function carregarPdms(): Promise<Pdm[]> {
  const c = cachePdms();
  if (c && Date.now() - c.ts < CACHE_MS) return c.pdms;
  if (c?.promise) return c.promise;

  const promise = (async () => {
    const pdms: Pdm[] = [];
    const primeira = await getJson(
      `${BASE}/modulo-material/3_consultarPdmMaterial?pagina=1&tamanhoPagina=500`
    );
    if (!primeira?.resultado) return [];
    pdms.push(...primeira.resultado);
    const totalPaginas = primeira.totalPaginas || 1;
    for (let p = 2; p <= totalPaginas; p++) {
      await sleep(500);
      const dados = await getJson(
        `${BASE}/modulo-material/3_consultarPdmMaterial?pagina=${p}&tamanhoPagina=500`
      );
      if (dados?.resultado) pdms.push(...dados.resultado);
    }
    g.__precosAbertosPdms = { pdms, ts: Date.now(), promise: undefined };
    return pdms;
  })();

  g.__precosAbertosPdms = { pdms: [], ts: 0, promise };
  try {
    return await promise;
  } finally {
    if (g.__precosAbertosPdms?.promise) {
      g.__precosAbertosPdms.promise = undefined;
    }
  }
}

function tokens(termo: string): string[] {
  return termo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function pontuarPdm(p: Pdm, termos: string[]): number {
  const pdm = p.nomePdm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const classe = p.nomeClasse.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const grupo = p.nomeGrupo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let score = 0;
  for (const t of termos) {
    if (pdm.includes(t)) score += 4;
    else if (classe.includes(t)) score += 2;
    else if (grupo.includes(t)) score += 1;
  }
  // todos os termos presentes no PDM = bónus forte
  if (termos.every((t) => pdm.includes(t))) score += 6;
  if (termos.length && !score) return 0;
  return score;
}

export async function buscarPrecosAbertos(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20, dataInicial, dataFinal, uf } = params;
  const termos = tokens(termo);

  const fim = dataFinal || new Date().toISOString().slice(0, 10);
  const inicio = dataInicial || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 365);
    return d.toISOString().slice(0, 10);
  })();

  try {
    // 1) Se o termo for um código, usa-o diretamente
    let pdms: number[] = [];
    if (/^\d+$/.test(termo.trim())) {
      pdms = [Number(termo.trim())];
    } else {
      // 2) Pesquisa local na lista de PDMs
      const lista = await carregarPdms();
      const pontuados = lista
        .map((p) => ({ p, score: pontuarPdm(p, termos) }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);
      pdms = pontuados.slice(0, 4).map((x) => x.p.codigoPdm);
      if (!pdms.length) return { fonte: "precos_abertos", items: [], total: 0 };
    }

    // 3) Consulta preços de cada PDM
    const registros: RegistroPreco[] = [];
    for (const pdm of pdms) {
      const url = new URL(`${BASE}/modulo-pesquisa-preco/1_consultarMaterial`);
      url.searchParams.set("tipo", "codigoPdm");
      url.searchParams.set("codigo", String(pdm));
      url.searchParams.set("dataCompraInicio", inicio);
      url.searchParams.set("dataCompraFim", fim);
      url.searchParams.set("pagina", String(pagina));
      url.searchParams.set("tamanhoPagina", String(Math.min(Math.max(tamanhoPagina, 10), 20)));
      if (uf) url.searchParams.set("estado", uf);

      const dados = await getJson(url.toString());
      for (const r of dados?.resultado || []) {
        registros.push({
          dataCompra: r.dataCompra,
          precoUnitario: r.precoUnitario,
          quantidade: r.quantidade,
          descricaoItem: r.descricaoItem || "",
          nomeFornecedor: r.nomeFornecedor,
          marca: r.marca,
          nomeUasg: r.nomeUasg,
          estado: r.estado,
          municipio: r.municipio,
          poder: r.poder,
          esfera: r.esfera,
          idCompra: r.idCompra,
          numeroItemCompra: r.numeroItemCompra,
          codigoItemCatalogo: r.codigoItemCatalogo,
          codigoPdm: pdm,
          nomePdm: r.nomePdm,
          objetoCompra: r.objetoCompra,
        });
      }
      await sleep(700);
    }

    const itensTermos = termos.join(" ");
    const items: ResultadoBruto[] = registros.map((r) => {
      const valorUnitario = r.precoUnitario ?? null;
      const quantidade = r.quantidade ?? null;
      return {
        fonte: "precos_abertos" as const,
        orgao: r.nomeUasg || "Órgão público",
        descricao: r.descricaoItem || termo,
        quantidade,
        dataContrato: r.dataCompra || null,
        valorUnitario,
        valorTotal: valorUnitario != null && quantidade != null ? valorUnitario * quantidade : valorUnitario,
        localizacao: r.municipio ? `${r.municipio}/${r.estado || ""}`.replace(/\/$/, "") : r.estado || null,
        similaridade: r.descricaoItem.toLowerCase().includes(itensTermos) ? 95 : 70,
        documentoOrigem: r.idCompra ? String(r.idCompra) : null,
        linkEdital: null,
        dadosBrutos: r as unknown as Record<string, unknown>,
      };
    });

    items.sort((a, b) => b.similaridade - a.similaridade);

    return {
      fonte: "precos_abertos",
      items: items.slice(0, Math.max(tamanhoPagina, 10) * 3),
      total: registros.length,
    };
  } catch (err) {
    return { fonte: "precos_abertos", items: [], total: 0, erro: String(err) };
  }
}
