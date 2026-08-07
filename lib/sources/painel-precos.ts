import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Painel de Preços - Ministério do Planejamento
// https://paineldeprecos.planejamento.gov.br
const BASE = "https://paineldeprecos.planejamento.gov.br/api";

function calcSimilaridade(descricao: string, termos: string[]): number {
  const desc = descricao.toLowerCase();
  const matches = termos.filter((t) => desc.includes(t.toLowerCase()));
  return Math.round((matches.length / Math.max(termos.length, 1)) * 100);
}

export async function buscarPainelPrecos(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20 } = params;
  const termos = termo.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

  try {
    // Endpoint principal do Painel de Preços para materiais
    const url = new URL(`${BASE}/material/preco`);
    url.searchParams.set("descricao", termo);
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("tamanhoPagina", String(tamanhoPagina));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "EstimaIA/2.0",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      // Tentar endpoint de serviços
      const urlServico = new URL(`${BASE}/servico/preco`);
      urlServico.searchParams.set("descricao", termo);
      urlServico.searchParams.set("pagina", String(pagina));
      urlServico.searchParams.set("tamanhoPagina", String(tamanhoPagina));

      const res2 = await fetch(urlServico.toString(), {
        headers: { Accept: "application/json", "User-Agent": "EstimaIA/2.0" },
        next: { revalidate: 3600 },
      });

      if (!res2.ok) return { fonte: "painel_precos", items: [], total: 0, erro: `HTTP ${res.status}` };

      const data2 = await res2.json();
      return processarResposta(data2, termos);
    }

    const data = await res.json();
    return processarResposta(data, termos);
  } catch (err) {
    return { fonte: "painel_precos", items: [], total: 0, erro: String(err) };
  }
}

function processarResposta(data: any, termos: string[]): ResultadoFonte {
  const raw: any[] = Array.isArray(data) ? data : data?.resultado || data?.itens || data?.content || [];

  const items: ResultadoBruto[] = raw.map((r: any) => ({
    fonte: "painel_precos" as const,
    orgao: r?.nomeOrgao || r?.orgao || r?.uasg || "Órgão Federal",
    descricao: r?.descricaoItem || r?.descricao || r?.nome || "Sem descrição",
    quantidade: r?.quantidade || r?.qtd || null,
    dataContrato: r?.dataCompra || r?.data || r?.anoMes || null,
    valorUnitario: parseFloat(r?.precoUnitario || r?.valorUnitario || r?.preco || 0) || null,
    valorTotal: parseFloat(r?.valorTotal || r?.total || 0) || null,
    localizacao: r?.uf || r?.estado || r?.municipio || null,
    similaridade: calcSimilaridade(r?.descricaoItem || r?.descricao || "", termos),
    documentoOrigem: r?.numeroProcesso || r?.codigoItem || r?.id || null,
    linkEdital: r?.linkEdital || r?.url || null,
    dadosBrutos: r,
  }));

  return {
    fonte: "painel_precos",
    items: items.sort((a, b) => b.similaridade - a.similaridade),
    total: data?.total || data?.totalElements || items.length,
  };
}
