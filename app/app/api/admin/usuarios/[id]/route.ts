import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if ((session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const orgaoId = (session.user as any).orgaoId;
  const body = await req.json();

  const updates: Record<string, unknown> = {
    nome: body.nome,
    perfil: body.perfil,
    cargo: body.cargo,
    matricula: body.matricula,
    ativo: body.ativo,
    updatedAt: new Date(),
  };

  if (body.senha) {
    updates.senhaHash = await bcrypt.hash(body.senha, 12);
  }

  const [updated] = await db
    .update(usuarios)
    .set(updates)
    .where(and(eq(usuarios.id, params.id), eq(usuarios.orgaoId, orgaoId)))
    .returning({ id: usuarios.id, nome: usuarios.nome, ativo: usuarios.ativo });

  if (!updated) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(updated);
}
