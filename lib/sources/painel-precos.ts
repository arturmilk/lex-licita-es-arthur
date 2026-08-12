import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Painel de Preços - API pública do Governo Federal
// Documentação: https://www.gov.br/compras/pt-br/acesso-a-informacao/apis
const BASES = [
  "https://paineldeprecos.planejamento.gov.br/api",
  "https://compras.dados.gov.br/precos/v1",
];

const HEADERS = {
  Accept: "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; EstimaIA/2.0)",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Referer: "https://paineldeprecos.planejamento.gov.br/",
};

function calcSimilaridade(descricao: string, termos: string[]): number {
  const desc = descricao.toLowerCase();
  const matches = termos.filter((t) => desc.includes(t.toLowerCase()));
  return Math.round((matches.length / Math.max(termos.length, 1)) * 100);
}

async function tentarEndpoint(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (res.ok) return res;
    return null;
  } catch {
    return null;
  }
}

export async function buscarPainelPrecos(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20 } = params;
  const termos = termo.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  // Tenta múltiplas combinações de endpoint/base
  const tentativas = [
    `${BASES[0]}/material/preco?descricao=${encodeURIComponent(termo)}&pagina=${pagina}&tamanhoPagina=${tamanhoPagina}`,
    `${BASES[0]}/servico/preco?descricao=${encodeURIComponent(termo)}&pagina=${pagina}&tamanhoPagina=${tamanhoPagina}`,
    `${BASES[1]}/materiais?q=${encodeURIComponent(termo)}&page=${pagina - 1}&size=${tamanhoPagina}`,
  ];

  for (const tentativa of tentativas) {
    try {
      const res = await tentarEndpoint(tentativa);
      if (res) {
        const data = await res.json();
        const result = processarResposta(data, termos);
        if (result.items.length > 0) return result;
      }
    } catch {
      continue;
    }
  }

  return {
    fonte: "painel_precos",
    items: [],
    total: 0,
    erro: "API do Painel de Preços indisponível ou requer autenticação (HTTP 403)",
  };
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
