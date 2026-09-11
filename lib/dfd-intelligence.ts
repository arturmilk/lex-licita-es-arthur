import { buscarPrecosAbertos } from "@/lib/sources/precos-abertos";
import { buscarPNCPSearch } from "@/lib/sources/pncp-search";
import { buscarTCU } from "@/lib/julgados";

const CATMAT_ITEM_URL = "https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial";

function norm(v: string) {
  return (v || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const STOP = new Set(["para", "com", "sem", "uma", "uns", "das", "dos", "que", "por", "de", "do", "da", "em", "no", "na", "ao", "aos", "aquisição", "aquisicao", "contratação", "contratacao", "fornecimento"]);

function tokens(v: string) {
  const vistos = new Set<string>();
  return norm(v).split(/[^a-z0-9]+/).filter(t => t.length >= 3 && !STOP.has(t) && !/^\d+$/.test(t)).filter(t => {
    if (vistos.has(t)) return false;
    vistos.add(t);
    return true;
  });
}

function scoreDescricao(alvo: string, referencia: string) {
  const ts = tokens(referencia);
  if (!ts.length) return 0;
  const a = norm(alvo);
  let peso = 0;
  let total = 0;
  ts.forEach((t, idx) => {
    const p = idx < 4 ? 2 : 1;
    total += p;
    if (a.includes(t)) peso += p;
  });
  return total ? peso / total : 0;
}


type RequisitosNumericos = { ramGb?: number; ssdGb?: number; telaPol?: number; nucleos?: number; garantiaMeses?: number };

function numPt(v: string) {
  const n = Number(String(v || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function extrairRequisitosNumericos(texto: string): RequisitosNumericos {
  const t = norm(texto);
  const pick = (regexes: RegExp[]) => {
    for (const re of regexes) {
      const m = t.match(re); const n = m?.[1] ? numPt(m[1]) : null;
      if (n != null) return n;
    }
    return undefined;
  };
  return {
    ramGb: pick([/(?:memoria\s*ram|\bram\b)[^0-9]{0,25}(\d+(?:[.,]\d+)?)\s*gb/, /(\d+(?:[.,]\d+)?)\s*gb[^,|]{0,25}(?:memoria\s*ram|\bram\b)/]),
    ssdGb: pick([/(?:armazenamento\s*)?ssd[^0-9]{0,25}(\d+(?:[.,]\d+)?)\s*(?:gb)?/, /(\d+(?:[.,]\d+)?)\s*gb[^,|]{0,25}(?:ssd)/]),
    telaPol: pick([/(?:tela)[^0-9]{0,25}(\d+(?:[.,]\d+)?)\s*(?:pol|poleg)/, /(\d+(?:[.,]\d+)?)\s*(?:pol|poleg)[^,|]{0,20}tela/]),
    nucleos: pick([/(\d+(?:[.,]\d+)?)\s*(?:nucleos|núcleos)/, /(?:nucleos|núcleos)[^0-9]{0,20}(\d+(?:[.,]\d+)?)/]),
    garantiaMeses: pick([/(?:garantia)[^0-9]{0,30}(\d+(?:[.,]\d+)?)\s*(?:mes|meses)/, /(\d+(?:[.,]\d+)?)\s*(?:mes|meses)[^,|]{0,20}(?:garantia)/]),
  };
}

function trechoCampo(descricao: string, rotulos: string[]) {
  const d = norm(descricao);
  for (const r of rotulos) {
    const i = d.indexOf(norm(r));
    if (i >= 0) return d.slice(i, i + 120).split(',')[0];
  }
  return "";
}

function faixaContem(trecho: string, valor: number) {
  if (!trecho) return true; // sem dado explícito: não rejeita por ausência
  if (/sem\s+(?:disco|ssd)|nao\s+possui|não\s+possui/.test(trecho)) return false;
  const nums = Array.from(trecho.matchAll(/\d+(?:[.,]\d+)?/g)).map(m => numPt(m[0])).filter((n): n is number => n != null);
  if (!nums.length) return true;
  if (/superior\s+a|maior\s+que|acima\s+de/.test(trecho)) return valor > nums[0];
  if (/minimo\s+de|minima\s+de|mínimo\s+de|mínima\s+de/.test(trecho)) return valor >= nums[0];
  if (/ate\s+|até\s+|maxim/.test(trecho)) return valor <= nums[0];
  if (nums.length >= 2 && /\s+a\s+|entre/.test(trecho)) return valor >= Math.min(nums[0], nums[1]) && valor <= Math.max(nums[0], nums[1]);
  // Valor explícito sem faixa (ex.: garantia 36 meses) deve coincidir com o requisito.
  if (nums.length === 1) return Math.abs(valor - nums[0]) < 0.01;
  return true;
}

function compativelComContexto(contexto: string, descricao: string) {
  const req = extrairRequisitosNumericos(contexto);
  const testes: Array<[number | undefined, string]> = [
    [req.ramGb, trechoCampo(descricao, ["memória ram", "memoria ram"])],
    [req.ssdGb, trechoCampo(descricao, ["armazenamento ssd", "ssd"])],
    [req.telaPol, trechoCampo(descricao, ["tela"])],
    [req.nucleos, trechoCampo(descricao, ["núcleos por processador", "nucleos por processador"])],
    [req.garantiaMeses, trechoCampo(descricao, ["garantia on site", "garantia"])],
  ];
  const avaliados = testes.filter(([v, trecho]) => v != null && !!trecho);
  if (!avaliados.length) return { compativel: true, avaliados: 0 };
  const incompat = avaliados.filter(([v, trecho]) => !faixaContem(trecho, v!));
  const c = norm(contexto), d = norm(descricao);
  const qualitativos: boolean[] = [];
  if (/sistema operacional[^|,]{0,40}proprietario|sistema proprietario/.test(c)) qualitativos.push(/sistema operacional[^,]{0,50}proprietario/.test(d));
  if (/sem sistema operacional/.test(c)) qualitativos.push(/sem sistema operacional/.test(d));
  if (/open source|codigo aberto/.test(c)) qualitativos.push(/open source|codigo aberto/.test(d));
  if (/sensivel ao toque|touch/.test(c)) qualitativos.push(/sensivel ao toque/.test(d));
  if (/sem interatividade/.test(c)) qualitativos.push(/sem interatividade/.test(d));
  return { compativel: incompat.length === 0 && qualitativos.every(Boolean), avaliados: avaliados.length + qualitativos.length };
}

function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
  if (typeof v !== "string") return null;
  const m = v.replace(/\./g, "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function mediana(vals: number[]) {
  const a = [...vals].sort((x, y) => x - y);
  if (!a.length) return 0;
  const i = Math.floor(a.length / 2);
  return a.length % 2 ? a[i] : (a[i - 1] + a[i]) / 2;
}

function quartil(vals: number[], q: number) {
  const a = [...vals].sort((x, y) => x - y);
  if (!a.length) return 0;
  const pos = (a.length - 1) * q;
  const base = Math.floor(pos);
  const resto = pos - base;
  return a[base + 1] !== undefined ? a[base] + resto * (a[base + 1] - a[base]) : a[base];
}

function limparOutliers(vals: number[]) {
  if (vals.length < 4) return vals;
  const q1 = quartil(vals, .25), q3 = quartil(vals, .75), iqr = q3 - q1;
  if (!Number.isFinite(iqr) || iqr <= 0) return vals;
  const min = q1 - 1.5 * iqr, max = q3 + 1.5 * iqr;
  const limpos = vals.filter(v => v >= min && v <= max);
  return limpos.length >= 3 ? limpos : vals;
}

async function validarCatmat(codigo: number) {
  try {
    const u = new URL(CATMAT_ITEM_URL);
    u.searchParams.set("codigoItem", String(codigo));
    u.searchParams.set("pagina", "1");
    u.searchParams.set("tamanhoPagina", "10");
    const r = await fetch(u.toString(), { headers: { Accept: "application/json", "User-Agent": "LEX Licitações" }, signal: AbortSignal.timeout(12_000), cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    const item = j?.resultado?.[0];
    return item ? {
      codigo: Number(item.codigoItem),
      descricao: String(item.descricaoItem || ""),
      pdm: item.codigoPdm != null ? Number(item.codigoPdm) : null,
      nomePdm: String(item.nomePdm || ""),
      grupo: `${item.codigoGrupo || ""} ${item.nomeGrupo || ""}`.trim(),
      classe: `${item.codigoClasse || ""} ${item.nomeClasse || ""}`.trim(),
      ativo: item.statusItem !== false,
    } : null;
  } catch { return null; }
}


async function listarCatmatPorPdm(codigoPdm: number) {
  try {
    const u = new URL(CATMAT_ITEM_URL);
    u.searchParams.set("codigoPdm", String(codigoPdm));
    u.searchParams.set("pagina", "1");
    u.searchParams.set("tamanhoPagina", "500");
    const r = await fetch(u.toString(), { headers: { Accept: "application/json", "User-Agent": "LEX Licitações" }, signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (!r.ok) return [] as any[];
    const j = await r.json();
    return Array.isArray(j?.resultado) ? j.resultado.filter((x: any) => x?.statusItem !== false) : [];
  } catch { return [] as any[]; }
}

async function selecionarCatmatOficial(codigoPdm: number, contextoTecnico: string, fallbackCodigo?: number) {
  const todos = await listarCatmatPorPdm(codigoPdm);
  if (!todos.length) return fallbackCodigo ? validarCatmat(fallbackCodigo) : null;

  // Primeiro elimina variantes que contradizem requisitos numéricos explícitos.
  // Assim, mesmo se a IA classificadora falhar, o fallback nunca escolhe uma faixa incompatível.
  const compativeis = todos.filter((item: any) => compativelComContexto(contextoTecnico, String(item.descricaoItem || "")).compativel);
  const universo = compativeis.length ? compativeis : todos;
  // Pré-ranking reduz volume; a decisão final continua restrita a códigos oficiais.
  const ranked = universo
    .map((item: any) => ({ item, score: scoreDescricao(String(item.descricaoItem || ""), contextoTecnico), compat: compativelComContexto(contextoTecnico, String(item.descricaoItem || "")) }))
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, 70);

  try {
    const { chat } = await import("@/lib/ia");
    const candidatos = ranked.map(({ item }: any) => ({
      codigo: Number(item.codigoItem),
      descricao: String(item.descricaoItem || "").slice(0, 700),
    }));
    const resposta = await chat([
      {
        role: "system",
        content: `Você é um classificador técnico de CATMAT. Escolha SOMENTE um código existente na lista fornecida e apenas se a descrição oficial for compatível com as especificações informadas. Interprete corretamente faixas técnicas: por exemplo, 512 GB é superior a 500 GB; 16 GB de RAM é superior a 8 GB. Não escolha uma faixa que exclua explicitamente o requisito. Se faltarem especificações para diferenciar variantes relevantes, marque confianca "baixa" ou retorne codigo null. Não invente código. Responda APENAS JSON válido: {"codigo":123,"confianca":"alta|media|baixa","motivo":"..."}.`
      },
      {
        role: "user",
        content: `NECESSIDADE/ESPECIFICAÇÕES:\n${contextoTecnico.slice(0, 6000)}\n\nCATMATs OFICIAIS DO PDM ${codigoPdm}:\n${JSON.stringify(candidatos)}`
      },
    ], 0.05, 900);
    const ini = resposta.indexOf("{");
    const fim = resposta.lastIndexOf("}");
    const json = JSON.parse(resposta.slice(ini, fim + 1));
    const codigo = Number(json?.codigo || 0);
    const escolhido = todos.find((x: any) => Number(x.codigoItem) === codigo);
    if (escolhido) return {
      codigo: Number(escolhido.codigoItem),
      descricao: String(escolhido.descricaoItem || ""),
      pdm: Number(escolhido.codigoPdm || codigoPdm),
      nomePdm: String(escolhido.nomePdm || ""),
      grupo: `${escolhido.codigoGrupo || ""} ${escolhido.nomeGrupo || ""}`.trim(),
      classe: `${escolhido.codigoClasse || ""} ${escolhido.nomeClasse || ""}`.trim(),
      ativo: escolhido.statusItem !== false,
      _confianca: ["alta", "media", "baixa"].includes(json?.confianca) ? json.confianca : "baixa",
      _motivo: String(json?.motivo || "").slice(0, 500),
    } as any;
  } catch { /* fallback abaixo */ }

  const top = ranked[0];
  const melhor = top?.item;
  const fallbackConf = top?.compat?.avaliados >= 2 && top?.score >= 0.2 ? "media" : "baixa";
  return melhor ? {
    codigo: Number(melhor.codigoItem), descricao: String(melhor.descricaoItem || ""),
    pdm: Number(melhor.codigoPdm || codigoPdm), nomePdm: String(melhor.nomePdm || ""),
    grupo: `${melhor.codigoGrupo || ""} ${melhor.nomeGrupo || ""}`.trim(),
    classe: `${melhor.codigoClasse || ""} ${melhor.nomeClasse || ""}`.trim(), ativo: melhor.statusItem !== false,
    _confianca: fallbackConf, _motivo: fallbackConf === "media" ? "Seleção heurística restrita a variantes oficiais sem conflito com os requisitos numéricos identificados; confirmar requisitos não informados." : "Seleção heurística; requer confirmação técnica.",
  } as any : null;
}


async function derivarTermoPesquisa(objeto: string, contextoTecnico: string) {
  const original = String(objeto || "").trim();
  const n = norm(original);
  const regras = [
    /(?:aquisicao|compra|fornecimento)\s+(?:de\s+)?(.+?)(?=\s+(?:para|com|destinad[oa]s?|visando|a fim de)\b|[,;.]|$)/,
    /(?:contratacao|prestacao)\s+(?:de\s+)?(.+?)(?=\s+(?:para|com|destinad[oa]s?|visando|a fim de)\b|[,;.]|$)/,
  ];
  for (const re of regras) {
    const m = n.match(re);
    const termo = String(m?.[1] || "").replace(/\b(?:eventual|futura|empresa especializada em|empresa especializada para)\b/g, " ").replace(/\s+/g, " ").trim();
    if (termo.length >= 3 && termo.length <= 90 && !/^(empresa|servico|material|bem|bens)$/.test(termo)) return termo;
  }
  // Para frases já curtas, não há motivo para chamar IA.
  if (original.length <= 80) return original;
  try {
    const { chat } = await import("@/lib/ia");
    const out = await chat([
      { role:"system", content:`Extraia o núcleo pesquisável de um objeto de contratação pública para consulta em CATMAT/CATSER, Compras.gov e PNCP. Preserve o nome do bem ou do serviço, mas retire finalidade, órgão, quantidade e especificações que serão usadas depois na comparação. Exemplos: "aquisição de notebook com 16 GB para fiscais" -> "notebook"; "contratação de empresa para manutenção preventiva e corretiva de aparelhos de ar-condicionado" -> "manutenção de ar-condicionado". Responda APENAS JSON: {"termo":"..."}. Não invente sinônimo se o objeto já contém um termo adequado.` },
      { role:"user", content:`Objeto: ${original}\nContexto técnico: ${contextoTecnico.slice(0,3000)}` },
    ], 0.02, 180);
    const a=out.indexOf('{'), b=out.lastIndexOf('}');
    if (a>=0 && b>a) {
      const j=JSON.parse(out.slice(a,b+1));
      const termo=String(j?.termo||'').trim();
      if (termo.length>=3 && termo.length<=120) return termo;
    }
  } catch { /* fallback */ }
  return original.slice(0,120);
}


export interface OpcaoCatalogoPesquisa {
  tipo: "CATMAT" | "CATSER";
  codigo: number;
  descricao: string;
  pdm?: number | null;
  nomePdm?: string;
  principal: boolean;
  confianca: "alta" | "media" | "baixa";
  nota: string;
  requisitosComparados: number;
  diferencas?: string[];
}

/** Sugere poucas opções oficiais de catálogo para a tela de Pesquisa de Preço. */
export async function sugerirOpcoesCatalogoPesquisa(opts: {
  descricao: string;
  especificacao?: string | null;
  quantidade?: string | number | null;
  unidade?: string | null;
  localEntrega?: string | null;
}) {
  const contextoTecnico = [opts.descricao, opts.especificacao].filter(Boolean).join(" | ");
  const base = await enriquecerDFD({
    objeto: opts.descricao,
    quantidade: opts.quantidade,
    unidade: opts.unidade,
    localEntrega: opts.localEntrega,
    dadosContexto: { requisitosTecnicos: opts.especificacao || "" },
  });

  if (!base.catalogo || base.catalogo.tipo !== "CATMAT" || !base.catalogo.pdm) {
    return { principalCodigo: null, opcoes: [] as OpcaoCatalogoPesquisa[], alerta: base.alertas?.[0] || "Nenhuma classificação CATMAT segura foi encontrada automaticamente." };
  }

  const todos = await listarCatmatPorPdm(Number(base.catalogo.pdm));
  const principalCodigo = Number(base.catalogo.codigo);
  const camposDesc = (descricao: string) => new Map(String(descricao || "").split(",").map(p => p.trim()).filter(p => p.includes(":" )).map(p => { const i=p.indexOf(":"); return [norm(p.slice(0,i)).trim(), p.slice(i+1).trim()] as [string,string]; }));
  const camposPrincipal = camposDesc(base.catalogo.descricao);
  const diferencasPrincipais = (descricao: string) => {
    const m = camposDesc(descricao); const out: string[] = [];
    for (const [k,v] of Array.from(m.entries())) { const baseV=camposPrincipal.get(k); if (baseV && norm(baseV) !== norm(v)) out.push(`${k.toUpperCase()}: ${v}`); }
    return out.slice(0,4);
  };
  const ranked = todos
    .map((item: any) => {
      const descricao = String(item.descricaoItem || "");
      const compat = compativelComContexto(contextoTecnico, descricao);
      return { item, descricao, compat, score: scoreDescricao(descricao, contextoTecnico) };
    })
    .filter((x: any) => x.compat.compativel)
    .sort((a: any, b: any) => {
      if (Number(a.item.codigoItem) === principalCodigo) return -1;
      if (Number(b.item.codigoItem) === principalCodigo) return 1;
      return (b.compat.avaliados - a.compat.avaliados) || (b.score - a.score);
    });

  const escolhidos: OpcaoCatalogoPesquisa[] = [];
  const seen = new Set<number>();
  const principal = ranked.find((x: any) => Number(x.item.codigoItem) === principalCodigo);
  const candidatos = principal ? [principal, ...ranked.filter((x: any) => Number(x.item.codigoItem) !== principalCodigo)] : ranked;
  for (const x of candidatos) {
    const codigo = Number(x.item.codigoItem);
    if (!codigo || seen.has(codigo)) continue;
    seen.add(codigo);
    const isPrincipal = codigo === principalCodigo;
    const confianca: "alta"|"media"|"baixa" = isPrincipal
      ? base.catalogo.confianca
      : x.compat.avaliados >= 2 && x.score >= 0.18 ? "media" : "baixa";
    escolhidos.push({
      tipo: "CATMAT",
      codigo,
      descricao: x.descricao,
      pdm: Number(x.item.codigoPdm || base.catalogo.pdm),
      nomePdm: String(x.item.nomePdm || base.catalogo.nomePdm || ""),
      principal: isPrincipal,
      confianca,
      requisitosComparados: x.compat.avaliados,
      nota: isPrincipal
        ? base.catalogo.nota
        : `${x.compat.avaliados ? `${x.compat.avaliados} requisito(s) explícito(s) foram comparados sem conflito.` : "Variante oficial da mesma família; faltam requisitos explícitos para diferenciar com segurança."} Compare a descrição oficial antes de confirmar.`,
      diferencas: isPrincipal ? [] : diferencasPrincipais(x.descricao),
    });
    if (escolhidos.length >= 5) break;
  }

  return {
    principalCodigo,
    opcoes: escolhidos,
    alerta: escolhidos.length > 1 ? "Há mais de uma classificação oficial plausível. Compare as diferenças antes de confirmar." : null,
    estimativaPreliminar: base.estimativa,
  };
}

export interface DfdEnriquecimento {
  consultadoEm: string;
  termoPesquisa: string;
  catalogo: null | {
    tipo: "CATMAT" | "CATSER";
    codigo: number;
    descricao: string;
    pdm?: number | null;
    nomePdm?: string;
    grupo?: string;
    classe?: string;
    confianca: "alta" | "media" | "baixa";
    nota: string;
    fonte: string;
  };
  estimativa: null | {
    valorUnitario: number;
    valorTotal: number | null;
    quantidade: number | null;
    unidade: string | null;
    media: number;
    mediana: number;
    minimo: number;
    maximo: number;
    referencias: number;
    metodo: string;
    escopoAmostra: string;
    fontePrincipal: string;
  };
  referenciasPreco: Array<{
    fonte: string;
    orgao: string;
    descricao: string;
    valorUnitario: number | null;
    quantidade: number | null;
    data: string | null;
    codigoCatmat: number | null;
    documento: string | null;
  }>;
  referenciasPncp: Array<{
    orgao: string;
    descricao: string;
    valorTotalEstimado: number | null;
    data: string | null;
    numeroControle: string | null;
    link: string | null;
  }>;
  apoioControle: Array<{
    tribunal: string;
    numero: string;
    ementa: string;
    link: string;
  }>;
  alertas: string[];
}

export async function enriquecerDFD(opts: {
  objeto: string;
  quantidade?: string | number | null;
  unidade?: string | null;
  localEntrega?: string | null;
  dadosContexto?: Record<string, string>;
}): Promise<DfdEnriquecimento> {
  const consultadoEm = new Date().toISOString();
  const dados = opts.dadosContexto || {};
  const contextoTecnico = [opts.objeto, dados.requisitos, dados.requisitosTecnicos, dados.especificacao, dados.escopo].filter(Boolean).join(" | ");
  const ufMatch = String(opts.localEntrega || dados.localEntrega || "").toUpperCase().match(/(?:\/|\b)(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  const uf = ufMatch?.[1];

  const termoPesquisa = await derivarTermoPesquisa(opts.objeto, contextoTecnico);
  const [precos, pncp, tcu] = await Promise.all([
    buscarPrecosAbertos({ termo: termoPesquisa, tamanhoPagina: 20, uf }),
    buscarPNCPSearch({ termo: termoPesquisa, tamanhoPagina: 20 }),
    buscarTCU("planejamento contratação necessidade pesquisa de preços", 4).catch(() => []),
  ]);

  const precosValidos = (precos.items || []).filter(r => Number(r.valorUnitario) > 0);

  // Candidatos CATMAT vindos dos próprios registros oficiais de preço.
  const grupos = new Map<number, { codigo: number; descricao: string; pdm?: number; nomePdm?: string; score: number; qtd: number }>();
  for (const r of precosValidos) {
    const raw: any = r.dadosBrutos || {};
    const codigo = Number(raw.codigoItemCatalogo || 0);
    if (!codigo) continue;
    const descricao = String(raw.descricaoItem || r.descricao || "");
    const sc = scoreDescricao(descricao, contextoTecnico || opts.objeto);
    const atual = grupos.get(codigo);
    if (!atual) grupos.set(codigo, { codigo, descricao, pdm: Number(raw.codigoPdm || 0) || undefined, nomePdm: raw.nomePdm || undefined, score: sc, qtd: 1 });
    else { atual.qtd += 1; atual.score = Math.max(atual.score, sc); }
  }

  const candidatos = Array.from(grupos.values()).sort((a, b) => (b.score * 100 + Math.min(b.qtd, 8)) - (a.score * 100 + Math.min(a.qtd, 8)));
  let catalogo: DfdEnriquecimento["catalogo"] = null;
  if (candidatos[0]) {
    const melhor = candidatos[0];
    const pdmProvavel = Number(melhor.pdm || 0);
    const oficial: any = pdmProvavel
      ? await selecionarCatmatOficial(pdmProvavel, contextoTecnico || opts.objeto, melhor.codigo)
      : await validarCatmat(melhor.codigo);
    const confianca: "alta" | "media" | "baixa" = oficial?._confianca || (melhor.score >= .55 ? "media" : "baixa");
    catalogo = {
      tipo: "CATMAT",
      codigo: oficial?.codigo || melhor.codigo,
      descricao: oficial?.descricao || melhor.descricao,
      pdm: oficial?.pdm ?? melhor.pdm ?? null,
      nomePdm: oficial?.nomePdm || melhor.nomePdm || "",
      grupo: oficial?.grupo || "",
      classe: oficial?.classe || "",
      confianca,
      nota: `${oficial?._motivo || "Código localizado em fonte oficial."} ${confianca === "alta" ? "Aderência alta; manter confirmação técnica antes da aprovação final." : "A área técnica deve confirmar a aderência antes da versão final."}`.trim(),
      fonte: "Compras.gov.br — Dados Abertos / CATMAT",
    };
  }

  // Se a busca textual muito específica não retornar PNCP, tenta pelo nome oficial do PDM.
  let pncpEfetivo = pncp;
  if ((!pncpEfetivo.items || pncpEfetivo.items.length === 0) && catalogo?.nomePdm) {
    try { pncpEfetivo = await buscarPNCPSearch({ termo: catalogo.nomePdm, tamanhoPagina: 20 }); } catch { /* mantém vazio */ }
  }

  // Prioriza preços do CATMAT escolhido; se houver poucos, amplia para o mesmo PDM/família.
  let basePreco = precosValidos;
  if (catalogo) {
    const exatos = precosValidos.filter(r => Number((r.dadosBrutos as any)?.codigoItemCatalogo) === catalogo!.codigo);
    const mesmoPdm = precosValidos.filter(r => catalogo!.pdm && Number((r.dadosBrutos as any)?.codigoPdm) === Number(catalogo!.pdm));
    const compativeisPdm = mesmoPdm.filter(r => compativelComContexto(contextoTecnico, r.descricao).compativel);
    if (exatos.length >= 3) basePreco = exatos;
    else if (compativeisPdm.length >= 3) basePreco = compativeisPdm.sort((a, b) => scoreDescricao(b.descricao, contextoTecnico) - scoreDescricao(a.descricao, contextoTecnico)).slice(0, 20);
    else if (exatos.length > 0) basePreco = exatos; // não dilui a amostra com configuração incompatível só para atingir 3 referências
  }
  basePreco = [...basePreco].sort((a, b) => scoreDescricao(b.descricao, contextoTecnico) - scoreDescricao(a.descricao, contextoTecnico)).slice(0, 20);
  const valsOriginais = basePreco.map(r => Number(r.valorUnitario)).filter(v => Number.isFinite(v) && v > 0);
  const vals = limparOutliers(valsOriginais);
  const qtd = numero(opts.quantidade ?? dados.quantidade);
  const unidade = String(opts.unidade || dados.unidade || "").trim() || null;

  let estimativa: DfdEnriquecimento["estimativa"] = null;
  if (vals.length >= 3) {
    const med = mediana(vals);
    const media = vals.reduce((a, b) => a + b, 0) / vals.length;
    estimativa = {
      valorUnitario: med,
      valorTotal: qtd ? med * qtd : null,
      quantidade: qtd,
      unidade,
      media,
      mediana: med,
      minimo: Math.min(...vals),
      maximo: Math.max(...vals),
      referencias: vals.length,
      metodo: "Mediana dos preços unitários comparáveis, após tratamento conservador de valores discrepantes pelo intervalo interquartil.",
      escopoAmostra: catalogo ? `Referências do ${catalogo.tipo} ${catalogo.codigo} e/ou do PDM ${catalogo.pdm || "correspondente"}, priorizadas por aderência ao objeto.` : "Referências oficiais priorizadas por aderência textual ao objeto.",
      fontePrincipal: "Compras.gov.br — módulo público de Pesquisa de Preços",
    };
  }

  const valoresUsados = new Set(vals.map(v => v.toFixed(6)));
  const amostraUsada = basePreco.filter(r => r.valorUnitario != null && valoresUsados.has(Number(r.valorUnitario).toFixed(6)));
  const referenciasPreco = amostraUsada.slice(0, 8).map(r => ({
    fonte: r.fonte,
    orgao: r.orgao,
    descricao: r.descricao,
    valorUnitario: r.valorUnitario,
    quantidade: r.quantidade,
    data: r.dataContrato,
    codigoCatmat: Number((r.dadosBrutos as any)?.codigoItemCatalogo || 0) || null,
    documento: r.documentoOrigem,
  }));

  const referenciasPncp = (pncpEfetivo.items || []).filter(r => r.valorTotal != null).slice(0, 6).map(r => ({
    orgao: r.orgao,
    descricao: r.descricao,
    valorTotalEstimado: r.valorTotal,
    data: r.dataContrato,
    numeroControle: r.documentoOrigem,
    link: r.linkEdital,
  }));

  const apoioControle = (tcu || []).slice(0, 4).map(j => ({ tribunal: "TCU", numero: j.numero, ementa: j.ementa, link: j.link }));
  const alertas: string[] = [];
  if (!catalogo) alertas.push("Não foi possível identificar CATMAT com segurança a partir das referências encontradas; pedir confirmação à área técnica.");
  if (!estimativa) alertas.push("Não houve pelo menos 3 preços unitários tecnicamente comparáveis para formar estimativa automática; manter a estimativa como pendência e ampliar a pesquisa sem misturar especificações incompatíveis.");
  if (catalogo?.confianca === "baixa") alertas.push("A aderência do CATMAT é baixa; não tratar o código sugerido como definitivo sem confirmação técnica.");
  if (qtd == null) alertas.push("Quantidade não definida: é possível estimar valor unitário, mas não o valor total da contratação.");

  return { consultadoEm, termoPesquisa, catalogo, estimativa, referenciasPreco, referenciasPncp, apoioControle, alertas };
}
