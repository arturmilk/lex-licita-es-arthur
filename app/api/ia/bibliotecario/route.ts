import { NextRequest, NextResponse } from "next/server";
import { buscarJulgadosMulti } from "@/lib/julgados";
import { db } from "@/lib/db";
import { processos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

/**
 * POST /api/ia/bibliotecario — AGENTE BIBLIOTECÁRIO
 * Busca julgados TCU/TCE-RO sobre o objeto do processo e usa a IA para
 * selecionar os 3-5 MAIS ADERENTES ao caso, com explicação do porquê de
 * cada um — para o servidor citar na justificativa/recurso.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let objeto = body.objeto || "";

    // Se recebeu processoId, busca o objeto no banco
    if (!objeto && body.processoId) {
      const [proc] = await db.select({ objeto: processos.objeto }).from(processos).where(eq(processos.id, body.processoId)).limit(1);
      objeto = proc?.objeto || "";
    }

    if (!objeto || !objeto.trim()) {
      return NextResponse.json({ erro: "Objeto não informado." }, { status: 422 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ erro: "IA não configurada neste servidor." }, { status: 501 });

    // 1. Busca julgados reais (TCU + TCE-RO)
    const julgados = await buscarJulgadosMulti(objeto, 8);

    if (!julgados || julgados.length === 0) {
      return NextResponse.json({ sugestoes: [], mensagem: "Nenhum julgado encontrado para este objeto." });
    }

    // 2. IA ranqueia os mais aderentes
    const lista = julgados.map((j: any, i: number) =>
      `[${i + 1}] ${j.tribunal || ""} ${j.numero || ""} | Rel: ${j.relator || "—"} | Órgão: ${j.orgaoJulgador || "—"} | ${(j.assunto || "").slice(0, 80)} | Ementa: ${(j.ementa || "").slice(0, 300)}`
    ).join("\n\n");

    const system = `Você é o AGENTE BIBLIOTECÁRIO de um sistema de licitações públicas (Lei 14.133/2021).

O servidor está montando uma contratação cujo OBJETO é: "${objeto}".
Abaixo está a lista de julgados (TCU/TCE) encontrados por busca textual.

Sua função: selecionar os 3 a 5 julgados MAIS ADERENTES ao objeto (não só pela palavra, mas pelo TEMA jurídico: pesquisa de preços, inexigibilidade, dispensa, sobrepreço, serviço continuado, etc.) e explicar em linguagem simples por que cada um é relevante para este caso.

Responda APENAS com JSON:
{"sugestoes": [{"indice": 1, "motivo": "por que este julgado é relevante para este objeto (1-2 frases, linguagem simples)"}]}

Regras: use SOMENTE os julgados da lista (pelo índice). Máximo 5 sugestões. Não invente julgados.`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Julgados encontrados:\n\n${lista}` },
        ],
        temperature: 0.2,
        max_tokens: 700,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      // Fallback: devolve os primeiros como sugestão simples
      return NextResponse.json({ sugestoes: julgados.slice(0, 5).map((j: any, i: number) => ({ indice: i + 1, motivo: "Julgado relacionado ao objeto (sem análise IA disponível)." })), julgados });
    }
    const data = await res.json();
    const texto = data.choices?.[0]?.message?.content || "";
    let sugestoes = [];
    try {
      const inicio = texto.indexOf("{");
      const fim = texto.lastIndexOf("}");
      sugestoes = JSON.parse(texto.slice(inicio, fim + 1)).sugestoes || [];
    } catch {
      sugestoes = [];
    }
    // Garante que os índices são válidos e junta os dados dos julgados
    const resultado = sugestoes
      .filter((s: any) => s.indice >= 1 && s.indice <= julgados.length)
      .map((s: any) => ({ ...julgados[s.indice - 1], motivo: s.motivo }));

    return NextResponse.json({ sugestoes: resultado, julgados });
  } catch (e: any) {
    return NextResponse.json({ erro: String(e?.message || e).slice(0, 120) }, { status: 500 });
  }
}
