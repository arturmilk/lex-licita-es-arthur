import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agent-auth";
import { db } from "@/lib/db";
import { sessoesAgente } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["aguardando", "executando", "concluido", "erro", "cancelado"]).optional(),
  totalEncontrado: z.number().int().optional(),
  progresso: z.number().int().min(0).max(100).optional(),
  mensagem: z.string().optional(),
  erro: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sessaoId: string } }
) {
  const context = await authenticateAgent(req);
  if (!context) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const updates: Record<string, unknown> = { ...data };
    if (data.status === "concluido" || data.status === "erro") {
      updates.concluidoEm = new Date();
    }

    const [updated] = await db
      .update(sessoesAgente)
      .set(updates)
      .where(eq(sessoesAgente.id, params.sessaoId))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
