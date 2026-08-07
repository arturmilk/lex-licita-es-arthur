import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Compras.gov.br - SIASG (antigo ComprasNet)
const BASE = "https://compras.dados.gov.br";

function calcSimilaridade(descricao: string, termos: string[]): number {
  const desc = descricao.toLowerCase();
  const matches = termos.filter((t) => desc.includes(t.toLowerCase()));
  return Math.round((matches.length / Math.max(termos.length, 1)) * 100);
}

export async function buscarComprasGov(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20 } = params;
  const termos = termo.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  const offset = (pagina - 1) * tamanhoPagina;

  try {
    // API aberta de licitações do compras.dados.gov.br
    const url = new URL(`${BASE}/licitacoes/v1/licitacoes.json`);
    url.searchParams.set("descricao_objeto", termo);
    url.searchParams.set("_limit", String(tamanhoPagina));
    url.searchParams.set("_offset", String(offset));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "EstimaIA/2.0" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return { fonte: "compras_gov", items: [], total: 0, erro: `HTTP ${res.status}` };

    const data = await res.json();
    const raw: any[] = Array.isArray(data) ? data : data?.licitacoes || data?.result || [];

    const items: ResultadoBruto[] = raw
      .filter((r: any) => r?.situacao_edital === "Encerrada" || r?.situacaoEdital === "Encerrada")
      .map((r: any) => ({
        fonte: "compras_gov" as const,
        orgao: r?.nome_orgao || r?.nomeOrgao || r?.uasg || "Órgão Federal",
        descricao: r?.objeto_compra || r?.descricaoObjeto || r?.objeto || "Sem descrição",
        quantidade: null,
        dataContrato: r?.data_abertura_proposta || r?.dataAbertura || null,
        valorUnitario: null,
        valorTotal: parseFloat(r?.valor_estimado || r?.valorEstimado || 0) || null,
        localizacao: r?.uf || null,
        similaridade: calcSimilaridade(r?.objeto_compra || r?.objeto || "", termos),
        documentoOrigem: r?.numero_edital || r?.numeroEdital || r?.id_licitacao || null,
        linkEdital: r?.link_edital || r?.linkEdital || null,
        dadosBrutos: r,
      }));

    return {
      fonte: "compras_gov",
      items: items.sort((a, b) => b.similaridade - a.similaridade),
      total: data?.total || items.length,
    };
  } catch (err) {
    return { fonte: "compras_gov", items: [], total: 0, erro: String(err) };
  }
}
