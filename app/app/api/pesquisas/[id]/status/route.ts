import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sessoesAgente, resultadosPesquisa } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) {
    return new Response("Não autorizado", { status: 401 });
  }

  const pesquisaId = params.id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      }

      // Poll every 2 seconds for up to 5 minutes
      let attempts = 0;
      const maxAttempts = 150;

      async function poll() {
        try {
          const sessoes = await db
            .select()
            .from(sessoesAgente)
            .where(eq(sessoesAgente.pesquisaId, pesquisaId));

          const [{ total }] = await db
            .select({ total: count() })
            .from(resultadosPesquisa)
            .where(eq(resultadosPesquisa.pesquisaId, pesquisaId));

          const allDone = sessoes.length > 0 &&
            sessoes.every((s) => s.status === "concluido" || s.status === "erro" || s.status === "cancelado");

          send({
            sessoes: sessoes.map((s) => ({
              id: s.id,
              nomeAgente: s.nomeAgente,
              fonte: s.fonte,
              status: s.status,
              totalEncontrado: s.totalEncontrado,
              progresso: s.progresso,
              mensagem: s.mensagem,
              erro: s.erro,
            })),
            totalResultados: Number(total),
            concluido: allDone,
          });

          attempts++;
          if (!allDone && attempts < maxAttempts) {
            setTimeout(poll, 2000);
          } else {
            controller.close();
          }
        } catch {
          controller.close();
        }
      }

      poll();
    },
    cancel() {
      // Client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
