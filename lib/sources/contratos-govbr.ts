import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// Contratos.gov.br — preços REAIS pagos (melhor referência de preço unitário).
// Base: https://contratos.comprasnet.gov.br/api/contrato
// Estratégia: varre UGs com contratos ativos, lista contratos e extrai itens
// cuja descrição casa com o termo — devolve o preço unitário real pago.
// O valor: enquanto o PNCP dá "valor total do edital", aqui temos o
// preço unitário efetivamente pago (máxima defensabilidade em pesquisa de preços).

const API_BASE = "https://contratos.comprasnet.gov.br/api/contrato";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const CACHE_MS = 6 * 60 * 60 * 1000; // 6h

const g = globalThis as any;

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Cache das UGs com contratos ativos. */
async function listarUGs(): Promise<string[]> {
  const c = g.__contratosUgs;
  if (c?.ugs?.length && Date.now() - c.ts < CACHE_MS) return c.ugs;
  if (c?.promise) return c.promise;

  const promise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/unidades`, {
        headers: { Accept: "application/json", "User-Agent": UA },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return [];
      const data: any[] = await res.json();
      const ugs = (data || []).map((u) => String(u.codigo)).filter(Boolean);
      g.__contratosUgs = { ugs, ts: Date.now(), promise: undefined };
      return ugs;
    } catch {
      return [];
    }
  })();
  g.__contratosUgs = { ugs: [], ts: 0, promise };
  try { return await promise; } finally { if (g.__contratosUgs?.promise) g.__contratosUgs.promise = undefined; }
}

export async function buscarContratosGovBr(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo } = params;
  const termos = norm(termo).split(/\s+/).filter((t) => t.length > 3);
  if (termos.length === 0) return { fonte: "contratos_govbr", items: [], total: 0, erro: "Termo muito curto" };

  try {
    const ugs = await listarUGs();
    // Varredura PARALELA de 12 UGs em um único lote (timeout global ~8s) —
    // a fonte é um BÔNUS de preço real pago; nunca pode travar a pesquisa.
    const amostra = ugs.slice(0, 12);
    const resultados: ResultadoBruto[] = [];
    const vistos = new Set<string>();

    const examinarUg = async (ug: string) => {
      try {
        const res = await fetch(`${API_BASE}/ug/${ug}`, {
          headers: { Accept: "application/json", "User-Agent": UA },
          signal: AbortSignal.timeout(6_000),
        });
        if (!res.ok) return;
        const contratos: any[] = await res.json();
        if (!Array.isArray(contratos)) return;

        // Examina até 3 contratos por UG
        for (const contrato of contratos.slice(0, 3)) {
          const id = contrato?.id;
          if (!id) continue;
          const orgaoNome = contrato?.contratante?.orgao_origem?.nome
            || contrato?.contratante?.orgao?.nome
            || contrato?.orgao_nome
            || "Órgão público";

          const itensRes = await fetch(`${API_BASE}/${id}/itens`, {
            headers: { Accept: "application/json", "User-Agent": UA },
            signal: AbortSignal.timeout(6_000),
          });
          if (!itensRes.ok) continue;
          const itens: any[] = await itensRes.json();
          if (!Array.isArray(itens)) continue;

          for (const item of itens) {
            const desc = norm(item?.catmatseritem_id || item?.descricao_complementar || "");
            if (!desc) continue;
            const hits = termos.filter((t) => desc.includes(t));
            if (hits.length === 0) continue;

            const valorUnitario = parseFloat(String(item?.valorunitario || "").replace(/\./g, "").replace(",", "."));
            if (!valorUnitario || isNaN(valorUnitario)) continue;

            const chave = `${item?.id ?? ""}|${valorUnitario}`;
            if (vistos.has(chave)) continue;
            vistos.add(chave);

            resultados.push({
              fonte: "contratos_govbr",
              orgao: orgaoNome,
              descricao: item?.catmatseritem_id || item?.descricao_complementar || desc,
              quantidade: parseFloat(item?.quantidade) || null,
              dataContrato: item?.data_inicio_item?.date?.slice(0, 10) || contrato?.data_assinatura?.slice?.(0, 10) || null,
              valorUnitario,
              valorTotal: parseFloat(String(item?.valortotal || "").replace(/\./g, "").replace(",", ".")) || valorUnitario,
              localizacao: null,
              similaridade: Math.min(100, Math.round((hits.length / Math.max(termos.length, 1)) * 100)),
              documentoOrigem: contrato?.numero ? `${contrato.numero}/${String(contrato?.id ?? "")}` : String(id),
              linkEdital: `https://contratos.comprasnet.gov.br/transparencia/contrato/${id}`,
              dadosBrutos: { ug, contratoId: id } as unknown as Record<string, unknown>,
            });
            if (resultados.length >= 30) return;
          }
          if (resultados.length >= 30) return;
        }
      } catch {
        return;
      }
    };

    // Um único lote de 12 UGs em paralelo
    await Promise.all(amostra.map(examinarUg));

    resultados.sort((a, b) => b.similaridade - a.similaridade);
    return {
      fonte: "contratos_govbr",
      items: resultados,
      total: resultados.length,
      aviso: resultados.length ? "Preços unitários REAIS pagos (contratos.gov.br)" : "Nenhum contrato com o termo encontrado",
    };
  } catch (err: any) {
    return { fonte: "contratos_govbr", items: [], total: 0, erro: String(err?.message || err) };
  }
}
