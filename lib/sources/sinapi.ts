import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// SINAPI - Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil
// Dados disponíveis via API do IBGE / CEF
const BASE = "https://servicodados.ibge.gov.br/api/v3/agregados";

function calcSimilaridade(descricao: string, termos: string[]): number {
  const desc = descricao.toLowerCase();
  const matches = termos.filter((t) => desc.includes(t.toLowerCase()));
  return Math.round((matches.length / Math.max(termos.length, 1)) * 100);
}

const OBRAS_KEYWORDS = [
  "obra", "construção", "reforma", "pavimentação", "asfalto", "concreto",
  "alvenaria", "fundação", "estrutura", "elétrica", "hidráulica", "pintura",
  "revestimento", "cobertura", "mao de obra", "material de construção",
  "engenharia", "arquitetura", "infraestrutura", "saneamento",
];

export function ehItemObras(termo: string): boolean {
  const t = termo.toLowerCase();
  return OBRAS_KEYWORDS.some((k) => t.includes(k));
}

// SINAPI insumos via API CEF (dados públicos mensais)
const SINAPI_CEF_BASE = "https://www.caixa.gov.br/site/Paginas/downloads/sinapi";

export async function buscarSINAPI(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo } = params;
  const termos = termo.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

  try {
    // Endpoint público SINAPI de insumos desonerado
    const url = new URL("https://servicodados.ibge.gov.br/api/v3/pesquisas/sinapi/periodos/ultimo/variaveis");
    url.searchParams.set("localidades", "BR");

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
      next: { revalidate: 86400 }, // cache 24h - dados mensais
    });

    if (!res.ok) return { fonte: "sinapi", items: [], total: 0, erro: `HTTP ${res.status}` };

    const data = await res.json();
    const variaveis: any[] = Array.isArray(data) ? data : [];

    // Filtrar variáveis que batem com o termo buscado
    const filtered = variaveis.filter((v: any) => {
      const desc = (v?.variavel || v?.nome || "").toLowerCase();
      return termos.some((t) => desc.includes(t));
    });

    const items: ResultadoBruto[] = filtered.slice(0, 20).map((r: any) => {
      const resultado = r?.resultados?.[0];
      const serie = resultado?.series?.[0];
      const valorStr = serie?.serie ? Object.values(serie.serie as Record<string, string>)[0] : null;
      const valor = valorStr ? parseFloat(String(valorStr).replace(",", ".")) : null;

      return {
        fonte: "sinapi" as const,
        orgao: "SINAPI / IBGE / CEF",
        descricao: r?.variavel || r?.nome || "Insumo SINAPI",
        quantidade: 1,
        dataContrato: new Date().toISOString().slice(0, 7),
        valorUnitario: valor,
        valorTotal: valor,
        localizacao: "Nacional",
        similaridade: calcSimilaridade(r?.variavel || "", termos),
        documentoOrigem: String(r?.id || ""),
        linkEdital: "https://www.ibge.gov.br/estatisticas/economicas/precos/9270-sinapi.html",
        dadosBrutos: r,
      };
    });

    return {
      fonte: "sinapi",
      items: items.sort((a, b) => b.similaridade - a.similaridade),
      total: items.length,
    };
  } catch (err) {
    return { fonte: "sinapi", items: [], total: 0, erro: String(err) };
  }
}
