import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resultadosPesquisa } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  avaliacao: z.enum(["aceito", "rejeitado"]),
  justificativaRejeicao: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; resultadoId: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const [updated] = await db
      .update(resultadosPesquisa)
      .set(data)
      .where(eq(resultadosPesquisa.id, params.resultadoId))
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
