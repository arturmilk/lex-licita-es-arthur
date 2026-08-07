import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agent-auth";
import { db } from "@/lib/db";
import { sessoesAgente } from "@/lib/db/schema";
import { z } from "zod";

const createSchema = z.object({
  pesquisaId: z.string().uuid(),
  nomeAgente: z.string().min(1),
  fonte: z.enum(["pncp", "painel_precos", "compras_gov", "bps", "sinapi", "sicro", "manual"]),
});

export async function POST(req: NextRequest) {
  const context = await authenticateAgent(req);
  if (!context) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = createSchema.parse(body);

    const [sessao] = await db
      .insert(sessoesAgente)
      .values({
        ...data,
        status: "executando",
        iniciadoEm: new Date(),
      })
      .returning();

    return NextResponse.json(sessao, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
