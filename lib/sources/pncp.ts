import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

const BASE = process.env.PNCP_BASE_URL || "https://pncp.gov.br/api/pncp/v1";

function calcSimilaridade(descricao: string, termos: string[]): number {
  const desc = descricao.toLowerCase();
  const matches = termos.filter((t) => desc.includes(t.toLowerCase()));
  return Math.round((matches.length / Math.max(termos.length, 1)) * 100);
}

export async function buscarPNCP(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20 } = params;
  const termos = termo.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

  try {
    const url = new URL(`${BASE}/consulta/arquivos`);
    url.searchParams.set("q", termo);
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("tamanhoPagina", String(tamanhoPagina));
    if (params.dataInicial) url.searchParams.set("dataInicial", params.dataInicial);
    if (params.dataFinal) url.searchParams.set("dataFinal", params.dataFinal);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "EstimaIA/2.0" },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return { fonte: "pncp", items: [], total: 0, erro: `HTTP ${res.status}` };

    const data = await res.json();
    const raw: any[] = Array.isArray(data) ? data : data?.data || data?.items || [];

    const items: ResultadoBruto[] = raw.map((r: any) => ({
      fonte: "pncp" as const,
      orgao: r?.unidadeOrgao?.nomeUnidade || r?.orgaoEntidade?.razaoSocial || "Não informado",
      descricao: r?.objetoCompra || r?.descricao || r?.nomeItem || "Sem descrição",
      quantidade: r?.quantidadeItem || r?.quantidade || null,
      dataContrato: r?.dataPublicacaoPncp || r?.dataAssinatura || null,
      valorUnitario: r?.valorUnitarioEstimado || r?.valorUnitario || null,
      valorTotal: r?.valorTotal || r?.valorGlobalEstimado || null,
      localizacao: r?.unidadeOrgao?.ufSigla || r?.uf || null,
      similaridade: calcSimilaridade(r?.objetoCompra || r?.descricao || "", termos),
      documentoOrigem: r?.numeroControlePNCP || r?.sequencialCompra || null,
      linkEdital: r?.linkSistemaOrigem || r?.urlArquivoPdf || null,
      dadosBrutos: r,
    }));

    return {
      fonte: "pncp",
      items: items.sort((a, b) => b.similaridade - a.similaridade),
      total: data?.totalRegistros || items.length,
    };
  } catch (err) {
    return { fonte: "pncp", items: [], total: 0, erro: String(err) };
  }
}
