import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Banco de Preços em Saúde - BPS/MS
// https://bps.saude.gov.br
const BASE = "https://bps.saude.gov.br/bps/api/v1";

function calcSimilaridade(descricao: string, termos: string[]): number {
  const desc = descricao.toLowerCase();
  const matches = termos.filter((t) => desc.includes(t.toLowerCase()));
  return Math.round((matches.length / Math.max(termos.length, 1)) * 100);
}

const SAUDE_KEYWORDS = [
  "medicamento", "remedio", "farmaco", "hospitalar", "medico", "clinico",
  "cirurgico", "laboratorial", "diagnostico", "equipamento medico", "epi",
  "mascara", "luva", "seringa", "cateter", "soro", "vacina", "insumo",
];

export function ehItemSaude(termo: string): boolean {
  const t = termo.toLowerCase();
  return SAUDE_KEYWORDS.some((k) => t.includes(k));
}

export async function buscarBPS(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20 } = params;
  const termos = termo.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

  try {
    const url = new URL(`${BASE}/produto/preco`);
    url.searchParams.set("descricao", termo);
    url.searchParams.set("page", String(pagina - 1));
    url.searchParams.set("size", String(tamanhoPagina));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "EstimaIA/2.0" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return { fonte: "bps", items: [], total: 0, erro: `HTTP ${res.status}` };

    const data = await res.json();
    const raw: any[] = data?.content || data?.resultado || [];

    const items: ResultadoBruto[] = raw.map((r: any) => ({
      fonte: "bps" as const,
      orgao: r?.nomeEstabelecimento || r?.orgao || "Estabelecimento de Saúde",
      descricao: r?.descricaoProduto || r?.descricao || "Sem descrição",
      quantidade: r?.quantidade || null,
      dataContrato: r?.dataCompra || r?.competencia || null,
      valorUnitario: parseFloat(r?.precoUnitario || r?.preco || 0) || null,
      valorTotal: parseFloat(r?.valorTotal || 0) || null,
      localizacao: r?.uf || r?.municipio || null,
      similaridade: calcSimilaridade(r?.descricaoProduto || "", termos),
      documentoOrigem: r?.numeroProcesso || r?.codigoProduto || null,
      linkEdital: null,
      dadosBrutos: r,
    }));

    return {
      fonte: "bps",
      items: items.sort((a, b) => b.similaridade - a.similaridade),
      total: data?.totalElements || items.length,
    };
  } catch (err) {
    return { fonte: "bps", items: [], total: 0, erro: String(err) };
  }
}
