/**
 * Busca de CATMAT (Catálogo de Materiais) e CATSER (Catálogo de Serviços)
 * do Governo Federal — API Compras.gov.br (dados abertos, sem chave).
 *
 * Endpoint validado (2026-08):
 *   GET https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial
 *       ?descricao=<termo>&pagina=10&tamanhoPagina=N
 *   GET https://dadosabertos.compras.gov.br/modulo-servico/6_consultarItemServico
 *       ?descricao=<termo>&pagina=10&tamanhoPagina=N
 *
 * ⚠️ A API exige pagina entre 10 e 500 e tamanhoPagina entre 10 e 500.
 */

const BASE_MATERIAL = "https://dadosabertos.compras.gov.br/modulo-material/4_consultarItemMaterial";
const BASE_SERVICO = "https://dadosabertos.compras.gov.br/modulo-servico/6_consultarItemServico";

export interface CatItem {
  tipo: "CATMAT" | "CATSER";
  codigo: number;
  grupo: string;
  descricao: string;
  unidade?: string;
  ativo?: boolean;
}

async function get(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Estima.IA)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json();
}

/** Busca itens CATMAT (materiais) por termo. */
export async function buscarCatmat(termo: string, limite = 5): Promise<CatItem[]> {
  const url = `${BASE_MATERIAL}?descricao=${encodeURIComponent(termo)}&pagina=10&tamanhoPagina=${Math.min(Math.max(limite, 10), 20)}`;
  const data = await get(url);
  return (data?.resultado || []).slice(0, limite).map((i: any) => ({
    tipo: "CATMAT" as const,
    codigo: i.codigoItem,
    grupo: `${i.codigoGrupo || ""} ${i.nomeGrupo || ""}`.trim(),
    descricao: i.descricaoItem || i.descricao || "",
    unidade: i.unidadeMedida || "",
    ativo: i.statusItem !== false,
  }));
}

/** Busca itens CATSER (serviços) por termo. */
export async function buscarCatser(termo: string, limite = 5): Promise<CatItem[]> {
  const url = `${BASE_SERVICO}?descricao=${encodeURIComponent(termo)}&pagina=10&tamanhoPagina=${Math.min(Math.max(limite, 10), 20)}`;
  const data = await get(url);
  return (data?.resultado || []).slice(0, limite).map((i: any) => ({
    tipo: "CATSER" as const,
    codigo: i.codigoServico,
    grupo: `${i.codigoGrupo || ""} ${i.nomeGrupo || ""}`.trim(),
    descricao: i.descricaoServico || i.descricao || "",
    unidade: i.unidadeMedida || "",
    ativo: i.statusItem !== false,
  }));
}

/**
 * Busca o CATMAT/CATSER provável para o objeto da contratação.
 * Tenta material primeiro; se nada achar, tenta serviço.
 */
export async function catmatProvavel(objeto: string, limite = 5): Promise<{ itens: CatItem[]; tipo: "CATMAT" | "CATSER" }> {
  // Extrai o núcleo do objeto (remove verbos/artigos genéricos)
  const limpo = objeto
    .replace(/contratação de|contratacao de|aquisição de|aquisicao de|fornecimento de|prestação de|prestacao de|empresa especializada|especializada em/gi, "")
    .replace(/\b(para|com|em|de|do|da|dos|das|a|o|e)\b/gi, "")
    .trim()
    .slice(0, 60);

  try {
    const materiais = await buscarCatmat(limpo, limite);
    if (materiais.length) return { itens: materiais, tipo: "CATMAT" };
  } catch { /* tenta serviço */ }
  try {
    const servicos = await buscarCatser(limpo, limite);
    if (servicos.length) return { itens: servicos, tipo: "CATSER" };
  } catch { /* sem resultado */ }
  return { itens: [], tipo: "CATMAT" };
}
