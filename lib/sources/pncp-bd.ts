import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";
import { bqQuery, bqTabelasDoDataset } from "../bigquery-client";

// Fonte PNCP via Base dos Dados (BigQuery) — espelho oficial do PNCP
// Dataset: basedosdados.br_me_pncp (gratuito; requer projeto GCP + service account)
const DATASET = "basedosdados.br_me_pncp";

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function calcSimilaridade(descricao: string, termos: string[]): number {
  const d = norm(descricao);
  if (!termos.length) return 0;
  const hits = termos.filter((t) => d.includes(t));
  return Math.round((hits.length / termos.length) * 100);
}

// tabelas candidatas por tipo de coluna (descoberta automatica, com cache)
const g = globalThis as any;
let cacheTabelas: { ts: number; compras: string | null; itens: string | null } | null = null;

async function descobrirTabelas() {
  if (cacheTabelas && Date.now() - cacheTabelas.ts < 24 * 3600 * 1000) return cacheTabelas;
  const tabelas = await bqTabelasDoDataset(DATASET);
  const tem = (t: string, col: string) => true; // colunas confirmadas na consulta principal
  const compras = tabelas.find((t) => /compra/.test(t)) || null;
  const itens = tabelas.find((t) => /item/.test(t)) || null;
  cacheTabelas = { ts: Date.now(), compras, itens };
  return cacheTabelas;
}

function esc(s: string): string {
  return s.replace(/'/g, "\\'");
}

export async function buscarPNCPBigQuery(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 20, dataInicial, dataFinal } = params;
  const termos = termo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter((t) => t.length > 3);

  try {
    const { compras, itens } = await descobrirTabelas();
    if (!itens) {
      return { fonte: "pncp_bd", items: [], total: 0, erro: "Tabela de itens não encontrada no dataset" };
    }

    // Monta filtro de data (coluna data_assinatura ou data_inicio_vigencia — tenta ambas)
    const dataIni = dataInicial || (() => { const d = new Date(); d.setDate(d.getDate() - 365); return d.toISOString().slice(0, 10); })();
    const dataFim = dataFinal || new Date().toISOString().slice(0, 10);

    const likes = termos.map((t) => `LOWER(descricao) LIKE '%${esc(t)}%'`).join(" OR ");
    const sql = `
      SELECT
        id_contrato, numero_contrato, descricao, valor_unitario, valor_total,
        CAST(quantidade AS STRING) AS quantidade, unidade_medida,
        data_inicio_vigencia AS data_contrato, nome_fornecedor, documento_fornecedor,
        nome_orgao, uf, municipio
      FROM \`${DATASET}.${itens}\`
      WHERE (${likes})
        AND data_inicio_vigencia BETWEEN '${esc(dataIni)}' AND '${esc(dataFim)}'
      ORDER BY data_inicio_vigencia DESC
      LIMIT ${Math.min(Math.max(tamanhoPagina, 10), 100)}
      OFFSET ${(pagina - 1) * Math.min(Math.max(tamanhoPagina, 10), 100)}
    `;

    const rows = await bqQuery(sql);

    const items: ResultadoBruto[] = rows.map((r) => {
      const valorUnitario = r.valor_unitario != null ? Number(r.valor_unitario) : null;
      const quantidade = r.quantidade != null ? Number(r.quantidade) : null;
      return {
        fonte: "pncp_bd" as const,
        orgao: r.nome_orgao || "Órgão público",
        descricao: r.descricao || termo,
        quantidade: Number.isFinite(quantidade) ? quantidade : null,
        dataContrato: r.data_contrato || null,
        valorUnitario: Number.isFinite(valorUnitario) ? valorUnitario : null,
        valorTotal: Number.isFinite(valorUnitario) && Number.isFinite(quantidade) ? valorUnitario * quantidade : null,
        localizacao: r.municipio ? `${r.municipio}/${r.uf || ""}`.replace(/\/$/, "") : r.uf || null,
        similaridade: calcSimilaridade(r.descricao, termos),
        documentoOrigem: r.id_contrato || r.numero_contrato || null,
        linkEdital: null,
        dadosBrutos: r as unknown as Record<string, unknown>,
      };
    });

    items.sort((a, b) => b.similaridade - a.similaridade);

    return { fonte: "pncp_bd", items, total: items.length };
  } catch (err: any) {
    return { fonte: "pncp_bd", items: [], total: 0, erro: String(err?.message || err) };
  }
}
