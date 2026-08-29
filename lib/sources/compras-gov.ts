import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Compras.gov.br — Dados Abertos (dadosabertos.compras.gov.br)
// O domínio antigo (compras.dados.gov.br) está morto (301 → dadosabertos.compras.gov.br).
// Endpoint validado: /modulo-legado/1_consultarLicitacao (janela máx. 365 dias).
// ATENÇÃO: o portal parou de publicar ~jun/2025 neste endpoint — janelas recentes
// retornam 0; a estratégia é recuar a janela mês a mês até encontrar dados.

const BASE = "https://dadosabertos.compras.gov.br";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

function calcSimilaridade(descricao: string, termos: string[]): number {
  const desc = descricao.toLowerCase();
  const matches = termos.filter((t) => desc.includes(t.toLowerCase()));
  return Math.round((matches.length / Math.max(termos.length, 1)) * 100);
}

/** Busca licitações com janela que recua até achar dados (cut ~jun/2025). */
async function buscarComJanela(termo: string, pagina: number, tamanhoPagina: number) {
  const hoje = new Date();
  const janelas: [string, string][] = [];
  for (let m = 0; m < 14; m++) {
    const fim = new Date(hoje); fim.setMonth(fim.getMonth() - m * 3); fim.setDate(0); // fim do mês
    const inicio = new Date(fim); inicio.setMonth(inicio.getMonth() - 2); inicio.setDate(1);
    janelas.push([inicio.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)]);
  }

  for (const [dataInicial, dataFinal] of janelas) {
    try {
      const url = new URL(`${BASE}/modulo-legado/1_consultarLicitacao`);
      url.searchParams.set("data_publicacao_inicial", dataInicial);
      url.searchParams.set("data_publicacao_final", dataFinal);
      url.searchParams.set("pagina", String(pagina));
      url.searchParams.set("tamanhoPagina", String(Math.min(Math.max(tamanhoPagina, 10), 500)));

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(15_000),
        next: { revalidate: 3600 },
      });
      if (!res.ok) continue;
      const data = await res.json();
      const resultado: any[] = data?.resultado || [];
      const total = data?.totalRegistros ?? 0;
      if (resultado.length > 0) return { resultado, total, janela: `${dataInicial} a ${dataFinal}` };
      if (total > 0) return { resultado, total, janela: `${dataInicial} a ${dataFinal}` };
    } catch {
      continue; // tenta a próxima janela
    }
  }
  return { resultado: [], total: 0, janela: "" };
}

export async function buscarComprasGov(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20 } = params;
  const termos = termo.toLowerCase().split(/\s+/).filter((t) => t.length > 3);

  try {
    const { resultado, total, janela } = await buscarComJanela(termo, pagina, tamanhoPagina);

    if (resultado.length === 0) {
      return { fonte: "compras_gov", items: [], total: 0, erro: total === 0 ? "Sem dados recentes (portal parou ~jun/2025)" : undefined };
    }

    const items: ResultadoBruto[] = resultado.map((r: any) => {
      const uf = r?.uf || (String(r?.codigo_municipio_uasg || "").slice(0, 2));
      return {
        fonte: "compras_gov" as const,
        orgao: r?.nome_uasg || r?.uasg || "Órgão Federal",
        descricao: r?.objeto || r?.descricao_objeto || "Sem descrição",
        quantidade: null,
        dataContrato: r?.data_abertura_proposta || r?.data_publicacao || null,
        valorUnitario: null,
        valorTotal: parseFloat(r?.valor_estimado_total || r?.valor_estimado || 0) || null,
        localizacao: uf || null,
        similaridade: calcSimilaridade(r?.objeto || "", termos),
        documentoOrigem: r?.numero_aviso || r?.numero_processo || null,
        linkEdital: null,
        dadosBrutos: { ...r, _janela: janela } as unknown as Record<string, unknown>,
      };
    });

    return {
      fonte: "compras_gov",
      items,
      total: total || items.length,
      aviso: janela ? `Dados da janela ${janela}` : undefined,
    };
  } catch (err: any) {
    return { fonte: "compras_gov", items: [], total: 0, erro: String(err?.message || err) };
  }
}
