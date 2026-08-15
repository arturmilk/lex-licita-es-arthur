import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// ─── PNCP — Busca textual via /api/search ────────────────────────────────────
// Endpoint: https://pncp.gov.br/api/search/?q=TERMO&tipos_documento=edital&pagina=P&tam=N
// Link do edital: https://pncp.gov.br/app + item.item_url  (já vem montado pela API)
//
// Baseado na solução validada em buscadorPncp.html / buscadorPncp.js

const SEARCH_URL = "https://pncp.gov.br/api/search/";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function calcSimilaridade(descricao: string, termos: string[]): number {
  const d = norm(descricao);
  if (!termos.length) return 0;
  const hits = termos.filter(t => d.includes(t));
  return Math.round((hits.length / termos.length) * 100);
}

export async function buscarPNCPSearch(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20 } = params;
  const termos = norm(termo).split(/\s+/).filter(t => t.length > 2);

  try {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("q", termo);
    url.searchParams.set("tipos_documento", "edital");
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("tam", String(Math.min(tamanhoPagina, 50)));

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return { fonte: "pncp", items: [], total: 0, erro: `PNCP HTTP ${res.status}` };
    }

    const data = await res.json();
    const raw: any[] = data?.items || [];

    const items: ResultadoBruto[] = raw.map((item: any) => {
      // Link direto: a API retorna item_url com o caminho completo.
      // Garante que o segmento seja sempre /editais/ (nunca /compras/)
      const rawUrl = item.item_url ? String(item.item_url).replace(/\/compras\//, "/editais/") : null;
      const linkEdital = rawUrl ? `https://pncp.gov.br/app${rawUrl}` : null;

      const loc = item.municipio_nome && item.uf
        ? `${item.municipio_nome}/${item.uf}`
        : item.uf || null;

      return {
        fonte: "pncp" as const,
        orgao: item.orgao_nome || "Órgão público",
        descricao: item.description || item.title || "Sem descrição",
        quantidade: null,
        dataContrato: item.data_publicacao_pncp || null,
        valorUnitario: null,
        valorTotal: item.valor_total_estimado != null ? Number(item.valor_total_estimado) : null,
        localizacao: loc,
        similaridade: calcSimilaridade(item.description || item.title || "", termos),
        documentoOrigem: item.numero_controle_pncp || null,
        linkEdital,
        dadosBrutos: item as unknown as Record<string, unknown>,
      };
    });

    items.sort((a, b) => b.similaridade - a.similaridade);

    return {
      fonte: "pncp",
      items,
      total: data?.total ?? items.length,
    };
  } catch (err: any) {
    return {
      fonte: "pncp",
      items: [],
      total: 0,
      erro: String(err?.message || err),
    };
  }
}
