import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pesquisas, processos, resultadosPesquisa, evidencias, relatorios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const orgaoId = (session.user as any).orgaoId;

  const result = await db.query.pesquisas.findFirst({
    where: eq(pesquisas.id, params.id),
    with: {
      processo: { columns: { numero: true, objeto: true, orgaoId: true } },
      resultados: true,
      evidencias: true,
      relatorios: true,
    },
  });

  if (!result) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  if (result.processo.orgaoId !== orgaoId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  return NextResponse.json(result);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const [updated] = await db
    .update(pesquisas)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(pesquisas.id, params.id))
    .returning();

  return NextResponse.json(updated);
}
