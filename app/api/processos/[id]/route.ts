import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { processos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const orgaoId = (session.user as any).orgaoId;
  const result = await db
    .select()
    .from(processos)
    .where(and(eq(processos.id, params.id), eq(processos.orgaoId, orgaoId)))
    .limit(1);

  if (!result[0]) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(result[0]);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const orgaoId = (session.user as any).orgaoId;
  const body = await req.json();

  const [updated] = await db
    .update(processos)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(processos.id, params.id), eq(processos.orgaoId, orgaoId)))
    .returning();

  if (!updated) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const orgaoId = (session.user as any).orgaoId;
  await db
    .delete(processos)
    .where(and(eq(processos.id, params.id), eq(processos.orgaoId, orgaoId)));

  return NextResponse.json({ ok: true });
}
