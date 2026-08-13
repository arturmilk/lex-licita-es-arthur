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
interface CachePdms {
  pdms: Pdm[];
  ts: number;
  promise?: Promise<Pdm[]>;
}
function cachePdms(): CachePdms | undefined {
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

const STOPWORDS = new Set([
  "para", "com", "uso", "pro", "sem", "sobre", "sob", "ate", "mais", "menos",
  "bem", "tipo", "item", "unidade", "valor", "prazo", "cada", "entre", "apos",
  "antes", "durante", "conforme", "todos", "todo", "toda", "todas", "qualquer",
  "ser", "nas", "nos", "na", "no", "da", "do", "de", "dos", "das", "em", "por",
  "uma", "um", "ou", "e", "o", "os", "as", "a", "ao", "aos", "que", "com",
  "por", "via", "sendo", "seja", "serao", "esta", "este", "esses", "essas",
  "aquisicao", "fornecimento", "contratacao", "compra", "compras", "prestacao",
  "servico", "servicos", "objeto", "eventual", "eventuais", "diversos", "diversas",
  "cinco", "cinquenta", "cem", "mil", "dez", "vinte", "trinta", "quarenta",
  "sessenta", "setenta", "oitenta", "noventa", "duzentos", "trezentos",
  "quantidade", "quantidades", "minimo", "minima", "maximo", "maxima",
]);

function tokens(termo: string): string[] {
  return termo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t) && !/^\d+$/.test(t));
}

// variantes: "notebooks" -> ["notebooks", "notebook"]; "cadeiras" -> ["cadeiras", "cadeira"]
function variantes(t: string): string[] {
  const v = [t];
  if (t.length > 4) {
    if (t.endsWith("es")) v.push(t.slice(0, -2));
    if (t.endsWith("s")) v.push(t.slice(0, -1));
  }
  return v;
}

function pontuarPdm(p: Pdm, termos: string[]): number {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const pdm = norm(p.nomePdm || "");
  const classe = norm(p.nomeClasse || "");
  const grupo = norm(p.nomeGrupo || "");
  const palavrasPdm = pdm.split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;
  let maiorToken = 0;
  for (let idx = 0; idx < termos.length; idx++) {
    const t = termos[idx];
    const vars = variantes(t);
    const hitPdm = vars.some((v) => v.length > 2 && palavrasPdm.includes(v));
    const hitClasse = vars.some((v) => v.length > 2 && classe.includes(v));
    const hitGrupo = vars.some((v) => v.length > 2 && grupo.includes(v));
    if (hitPdm) {
      score += 4;
      // o item principal costuma aparecer cedo na frase -> pondera por posicao
      score += Math.max(0, 6 - idx) * 0.5;
      const len = Math.max(...vars.filter((v) => v.length > 2 && palavrasPdm.includes(v)).map((v) => v.length));
      if (len > maiorToken) maiorToken = len;
    } else if (hitClasse) score += 2;
    else if (hitGrupo) score += 1;
  }
  if (termos.length && !score) return 0;
  // bónus: nome do PDM é exatamente um token (ou começa com ele) — para QUALQUER token
  const varsTodas = termos.flatMap((t) => variantes(t)).filter((v) => v.length > 2);
  if (varsTodas.some((v) => pdm === v)) score += 12;
  else if (varsTodas.some((v) => palavrasPdm[0] === v)) score += 7;
  if (p.statusPdm) score += 1;
  return score + maiorToken / 100;
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
        .sort((a, b) => b.score - a.score || (a.p.nomePdm || "").length - (b.p.nomePdm || "").length);
      pdms = pontuados.slice(0, 6).map((x) => x.p.codigoPdm);
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
