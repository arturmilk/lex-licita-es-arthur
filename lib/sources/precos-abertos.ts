import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Pesquisa de Preços em Dados Abertos — Compras.gov.br
// Suporta CATMAT (materiais) e CATSER (serviços) automaticamente.
const BASE = "https://dadosabertos.compras.gov.br";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CACHE_MS = 24 * 60 * 60 * 1000; // 24h

interface Pdm {
  codigoGrupo?: number; nomeGrupo?: string;
  codigoClasse?: number; nomeClasse?: string;
  codigoPdm: number; nomePdm: string; statusPdm?: boolean;
}

interface RegistroPreco {
  dataCompra: string; precoUnitario: number; quantidade: number;
  descricaoItem: string; nomeFornecedor?: string; marca?: string;
  nomeUasg?: string; estado?: string; municipio?: string;
  idCompra?: number; codigoPdm?: number; nomePdm?: string; objetoCompra?: string;
}

// ─── Palavras-chave que indicam SERVIÇO de TI / serviço em geral ──────────────
const SERVICO_KEYWORDS = [
  "datacenter","data center","data-center","suporte tecnico","suporte a ",
  "manutencao","helpdesk","help desk","licenca","software","sistema","plataforma",
  "infraestrutura","servidor","storage","rede","cloud","nuvem","seguranca",
  "backup","desenvolvimento","analise","consultoria","ti ","tecnologia da informacao",
  "servico de","prestacao de","gestao de","monitoramento","sustentacao","sustentacao",
  "outsourcing","terceirizacao","implantacao","implementacao","suporte e manutencao",
  "link de dados","conectividade","internet","firewall","virtualizacao","vmware",
  "microsoft azure","aws","google cloud","erp","crm","banco de dados","database",
  "contingencia","disaster recovery","soc","noc","service desk",
];

function ehServico(termo: string): boolean {
  const t = termo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return SERVICO_KEYWORDS.some(kw => t.includes(kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function getJson(url: string): Promise<any | null> {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status === 400 || res.status === 500) { await sleep(1200); continue; }
      if (!res.ok) return null;
      return await res.json();
    } catch { await sleep(1200); }
  }
  return null;
}

// ─── Cache de catálogo (materiais e serviços) ─────────────────────────────────
const g = globalThis as any;

async function carregarCatalogo(tipo: "material" | "servico"): Promise<Pdm[]> {
  const cacheKey = tipo === "material" ? "__precosAbertosPdms" : "__precosAbertosServicos";
  const endpointLista = tipo === "material"
    ? "modulo-material/3_consultarPdmMaterial"
    : "modulo-servico/3_consultarPdmServico";

  const c = g[cacheKey];
  if (c?.pdms?.length && Date.now() - c.ts < CACHE_MS) return c.pdms;
  if (c?.promise) return c.promise;

  const promise = (async () => {
    const pdms: Pdm[] = [];
    const primeira = await getJson(`${BASE}/${endpointLista}?pagina=1&tamanhoPagina=500`);
    if (!primeira?.resultado) return [];
    pdms.push(...primeira.resultado);
    const total = primeira.totalPaginas || 1;
    for (let p = 2; p <= total; p++) {
      await sleep(400);
      const d = await getJson(`${BASE}/${endpointLista}?pagina=${p}&tamanhoPagina=500`);
      if (d?.resultado) pdms.push(...d.resultado);
    }
    g[cacheKey] = { pdms, ts: Date.now(), promise: undefined };
    return pdms;
  })();

  g[cacheKey] = { pdms: [], ts: 0, promise };
  try { return await promise; }
  finally { if (g[cacheKey]?.promise) g[cacheKey].promise = undefined; }
}

// ─── Tokenização ─────────────────────────────────────────────────────────────
const STOPWORDS = new Set([
  "para","com","uso","pro","sem","sobre","sob","ate","mais","menos","bem","tipo",
  "item","unidade","valor","prazo","cada","entre","apos","antes","durante","conforme",
  "todos","todo","toda","todas","qualquer","ser","nas","nos","na","no","da","do","de",
  "dos","das","em","por","uma","um","ou","e","o","os","as","a","ao","aos","que","via",
  "sendo","seja","serao","esta","este","esses","essas","aquisicao","fornecimento",
  "contratacao","compra","prestacao","objeto","eventual","diversos",
]);

function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Sinônimos para termos de TI que aparecem de formas diferentes no CATSER
const SINONIMOS: Record<string, string[]> = {
  datacenter: ["data", "center"],
  "data center": ["datacenter"],
  helpdesk: ["help", "desk"],
  outsourcing: ["terceirizacao"],
  vmware: ["virtualizacao"],
  firewall: ["seguranca", "rede"],
  storage: ["armazenamento"],
  backup: ["contingencia"],
};

function tokens(termo: string): string[] {
  const norm = normalizar(termo);
  // expande sinônimos antes de tokenizar
  let expandido = norm;
  for (const [k, vs] of Object.entries(SINONIMOS)) {
    if (expandido.includes(normalizar(k))) {
      expandido += " " + vs.join(" ");
    }
  }
  const tks = expandido
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
  // deduplica mantendo ordem
  const vistos = new Set<string>();
  return tks.filter(t => { if (vistos.has(t)) return false; vistos.add(t); return true; });
}

function variantes(t: string): string[] {
  const v = [t];
  if (t.length > 4) {
    if (t.endsWith("es")) v.push(t.slice(0, -2));
    if (t.endsWith("s")) v.push(t.slice(0, -1));
    if (t.endsWith("cao")) v.push(t.slice(0, -3) + "coes", t.slice(0, -3));
  }
  return v;
}

// ─── Scoring de PDM contra termos da busca ───────────────────────────────────
function pontuarPdm(p: Pdm, termos: string[]): number {
  const pdm = normalizar(p.nomePdm || "");
  const classe = normalizar(p.nomeClasse || "");
  const grupo = normalizar(p.nomeGrupo || "");
  const palavrasPdm = pdm.split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0, maiorToken = 0;

  for (let idx = 0; idx < termos.length; idx++) {
    const vars = variantes(termos[idx]);
    const hitPdm = vars.some(v => v.length > 2 && palavrasPdm.includes(v));
    const hitClasse = vars.some(v => v.length > 2 && classe.includes(v));
    const hitGrupo = vars.some(v => v.length > 2 && grupo.includes(v));
    if (hitPdm) {
      score += 4 + Math.max(0, 6 - idx) * 0.5;
      const len = Math.max(...vars.filter(v => v.length > 2 && palavrasPdm.includes(v)).map(v => v.length));
      if (len > maiorToken) maiorToken = len;
    } else if (hitClasse) score += 2;
    else if (hitGrupo) score += 1;
  }
  if (termos.length && !score) return 0;
  const varsTodas = termos.flatMap(t => variantes(t)).filter(v => v.length > 2);
  if (varsTodas.some(v => pdm === v)) score += 12;
  else if (varsTodas.some(v => palavrasPdm[0] === v)) score += 7;
  if (p.statusPdm) score += 1;
  return score + maiorToken / 100;
}

// ─── Similaridade por token (substitui o "contains string inteira") ───────────
function calcSimilaridade(descricao: string, termos: string[]): number {
  if (!termos.length) return 0;
  const d = normalizar(descricao);
  const hits = termos.filter(t => variantes(t).some(v => d.includes(v)));
  const ratio = hits.length / termos.length;
  if (ratio >= 1)   return 95;
  if (ratio >= 0.7) return 82;
  if (ratio >= 0.5) return 68;
  if (ratio >= 0.3) return 55;
  return Math.max(30, Math.round(ratio * 60));
}

// ─── Busca de preços (material ou serviço) ────────────────────────────────────
async function buscarPrecos(
  tipo: "material" | "servico",
  pdms: number[],
  inicio: string,
  fim: string,
  pagina: number,
  tamanhoPagina: number,
  uf?: string,
): Promise<RegistroPreco[]> {
  const endpoint = tipo === "material"
    ? "modulo-pesquisa-preco/1_consultarMaterial"
    : "modulo-pesquisa-preco/1_consultarServico";

  const registros: RegistroPreco[] = [];
  for (const pdm of pdms) {
    const url = new URL(`${BASE}/${endpoint}`);
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
        dataCompra: r.dataCompra, precoUnitario: r.precoUnitario, quantidade: r.quantidade,
        descricaoItem: r.descricaoItem || r.descricaoServico || "",
        nomeFornecedor: r.nomeFornecedor, marca: r.marca,
        nomeUasg: r.nomeUasg, estado: r.estado, municipio: r.municipio,
        idCompra: r.idCompra, codigoPdm: pdm, nomePdm: r.nomePdm || r.nomeServico,
        objetoCompra: r.objetoCompra,
      });
    }
    await sleep(600);
  }
  return registros;
}

// ─── Exportação principal ─────────────────────────────────────────────────────
export async function buscarPrecosAbertos(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20, dataInicial, dataFinal, uf } = params;
  const termos = tokens(termo);

  const fim = dataFinal || new Date().toISOString().slice(0, 10);
  const inicio = dataInicial || (() => {
    const d = new Date(); d.setDate(d.getDate() - 365); return d.toISOString().slice(0, 10);
  })();

  try {
    let pdms: number[] = [];
    const tipoConsulta: "material" | "servico" = ehServico(termo) ? "servico" : "material";

    if (/^\d+$/.test(termo.trim())) {
      pdms = [Number(termo.trim())];
    } else {
      const lista = await carregarCatalogo(tipoConsulta);
      const pontuados = lista
        .map(p => ({ p, score: pontuarPdm(p, termos) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || (a.p.nomePdm || "").length - (b.p.nomePdm || "").length);

      pdms = pontuados.slice(0, 10).map(x => x.p.codigoPdm);

      // fallback: se não achou no catálogo primário, tenta o outro
      if (!pdms.length) {
        const tipoFallback: "material" | "servico" = tipoConsulta === "servico" ? "material" : "servico";
        const listaFallback = await carregarCatalogo(tipoFallback);
        const pontuadosFallback = listaFallback
          .map(p => ({ p, score: pontuarPdm(p, termos) }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score);
        pdms = pontuadosFallback.slice(0, 6).map(x => x.p.codigoPdm);
        if (!pdms.length) return { fonte: "precos_abertos", items: [], total: 0 };
      }
    }

    // Para serviços de TI, não filtrar por UF — contratos são nacionais e a
    // maioria fica em DF/SP/RJ; filtrar por UF zera os resultados fora desses estados.
    const ufEfetiva = tipoConsulta === "servico" ? undefined : uf;
    const registros = await buscarPrecos(tipoConsulta, pdms, inicio, fim, pagina, tamanhoPagina, ufEfetiva);

    const items: ResultadoBruto[] = registros.map(r => {
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
        similaridade: calcSimilaridade(r.descricaoItem || "", termos),
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
