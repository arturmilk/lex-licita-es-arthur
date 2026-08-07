import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { configuracoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  similaridadeMinima: z.number().int().min(0).max(100),
  cvAlerta: z.number().int().min(0).max(100),
  periodoPadrao: z.string(),
  metodoPadrao: z.enum(["media_aritmetica", "mediana", "media_ponderada", "menor_preco"]),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const orgaoId = (session.user as any).orgaoId;
  const result = await db
    .select()
    .from(configuracoes)
    .where(eq(configuracoes.orgaoId, orgaoId))
    .limit(1);

  return NextResponse.json(result[0] || {
    similaridadeMinima: 75,
    cvAlerta: 25,
    periodoPadrao: "12_meses",
    metodoPadrao: "media_aritmetica",
  });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if ((session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const orgaoId = (session.user as any).orgaoId;

    const [updated] = await db
      .insert(configuracoes)
      .values({ ...data, orgaoId })
      .onConflictDoUpdate({
        target: configuracoes.orgaoId,
        set: { ...data, updatedAt: new Date() },
      })
      .returning();

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
