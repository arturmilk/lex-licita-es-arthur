import { NextRequest, NextResponse } from "next/server";
import { obterTarefasDoProcesso, obterHistorico, listarMinutas } from "@/lib/actions-intencao";
import { db } from "@/lib/db";
import { processos, julgadosProcesso } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

/**
 * POST /api/ia/revisor — AGENTE REVISOR
 * Lê o processo inteiro (dados, tarefas, minutas, julgados) e aponta
 * inconsistências: campos faltando, documentos contraditórios, riscos
 * jurídicos — como um assessor lendo o processo antes de assinar.
 */
export async function POST(req: NextRequest) {
  try {
    const { processoId } = await req.json();
    if (!processoId) return NextResponse.json({ revisao: "Processo não informado." }, { status: 422 });

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ revisao: "IA não configurada neste servidor." }, { status: 501 });

    // Dados do processo
    const [proc] = await db.select().from(processos).where(eq(processos.id, processoId)).limit(1);
    if (!proc) return NextResponse.json({ revisao: "Processo não encontrado." }, { status: 404 });

    const [tarefas, historico, minutas, julgados] = await Promise.all([
      obterTarefasDoProcesso(processoId),
      obterHistorico(processoId),
      listarMinutas(processoId),
      db.select().from(julgadosProcesso).where(eq(julgadosProcesso.processoId, processoId)),
    ]);

    const tarefasResumo = tarefas.map((t: any) => `${t.titulo}: ${t.status}`).join("\n");
    const historicoResumo = historico.map((h: any) => `- ${h.acao}: ${h.descricao?.slice(0, 100)}`).join("\n");
    const minutasResumo = minutas.map((m: any) => `- [${m.tipo}] ${m.conteudo?.slice(0, 200)}`).join("\n");
    const julgadosResumo = julgados.map((j: any) => `- ${j.tribunal} ${j.numero} (${j.assunto || "sem assunto"})${j.usado ? " — EM USO" : ""}`).join("\n");

    const system = `Você é o AGENTE REVISOR de um sistema de licitações públicas (Lei 14.133/2021).

Sua função: revisar o processo administrativo abaixo ANTES de sua publicação e apontar:
1. INCONSISTÊNCIAS: valores/documentos que se contradizem, dados faltando que podem anular o processo.
2. RISCOS JURÍDICOS: pontos que um auditor (TCU/TCE) apontaria.
3. AÇÕES RECOMENDADAS: o que o servidor deve fazer antes de publicar.

REGRAS:
- Baseie-se SOMENTE nos dados fornecidos. NUNCA invente documentos, valores ou fatos.
- Se faltar dado essencial (ex: pesquisa de preços, dotação), aponte como pendência.
- Liste em bullets curtos, seção "PENDÊNCIAS" e "OK". 
- Encerre com um VEREDITO: "APTO A PUBLICAR" ou "REVER ANTES DE PUBLICAR" com justificativa de 1 frase.
- Responda em português claro, sem emojis, máximo 400 palavras.`;

    const user = `PROCESSO: ${proc.numero || proc.id}
OBJETO: ${proc.objeto || "—"}
UNIDADE: ${proc.unidade || "—"}
STATUS: ${proc.status || "—"}

TAREFAS/ETAPAS:
${tarefasResumo || "—"}

HISTÓRICO:
${historicoResumo || "—"}

MINUTAS GERADAS:
${minutasResumo || "—"}

JULGADOS DE APOIO:
${julgadosResumo || "—"}`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) return NextResponse.json({ revisao: `Erro ao consultar a IA (${res.status}).` }, { status: 502 });
    const data = await res.json();
    const revisao = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ revisao });
  } catch (e: any) {
    return NextResponse.json({ revisao: `Erro: ${String(e?.message || e).slice(0, 120)}` }, { status: 500 });
  }
}
