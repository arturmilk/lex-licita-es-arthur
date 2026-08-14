import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const orgaoId = (session.user as any).orgaoId;
  const keys = await db
    .select({
      id: apiKeys.id,
      nome: apiKeys.nome,
      chave: apiKeys.chave,
      ativo: apiKeys.ativo,
      ultimoUso: apiKeys.ultimoUso,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.orgaoId, orgaoId));

  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { nome } = await req.json();
  if (!nome) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const orgaoId = (session.user as any).orgaoId;
  const chave = `eia_${randomBytes(32).toString("hex")}`;

  const [key] = await db
    .insert(apiKeys)
    .values({ nome, chave, orgaoId })
    .returning();

  return NextResponse.json(key, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await req.json();
  const orgaoId = (session.user as any).orgaoId;

  await db
    .update(apiKeys)
    .set({ ativo: false })
    .where(eq(apiKeys.id, id));

  return NextResponse.json({ ok: true });
}
