import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// API de Consulta Pública do PNCP (diferente da API de Registro)
const CONSULTA_BASE = "https://pncp.gov.br/api/consulta/v1";

function calcSimilaridade(descricao: string, termos: string[]): number {
  const desc = descricao.toLowerCase();
  const matches = termos.filter((t) => desc.includes(t.toLowerCase()));
  return Math.round((matches.length / Math.max(termos.length, 1)) * 100);
}

// Retorna data no formato YYYYMMDD esperado pelo PNCP
function dataFormatada(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function buscarPNCP(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20 } = params;
  const termos = termo.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  try {
    // Endpoint correto da API de Consulta do PNCP
    const url = new URL(`${CONSULTA_BASE}/contratacoes/publicacoes`);
    url.searchParams.set("dataInicial", params.dataInicial || dataFormatada(365));
    url.searchParams.set("dataFinal", params.dataFinal || dataFormatada(0));
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("tamanhoPagina", String(tamanhoPagina));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return { fonte: "pncp", items: [], total: 0, erro: `HTTP ${res.status}` };

    const data = await res.json();
    const raw: any[] = Array.isArray(data) ? data : data?.data || data?.items || [];

    // Filtra por termo no lado do servidor já que a API não tem busca por palavra
    const filtrados = raw.filter((r: any) => {
      const texto = (r?.objetoCompra || r?.descricao || "").toLowerCase();
      return termos.some((t) => texto.includes(t));
    });

    const items: ResultadoBruto[] = filtrados.map((r: any) => ({
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
      total: data?.totalRegistros || raw.length,
    };
  } catch (err) {
    return { fonte: "pncp", items: [], total: 0, erro: String(err) };
  }
}
