import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  senha: z.string().min(8).optional(),
  perfil: z.enum(["pesquisador", "administrador", "gestor"]).default("pesquisador"),
  cargo: z.string().optional(),
  matricula: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if ((session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const orgaoId = (session.user as any).orgaoId;
  const result = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      perfil: usuarios.perfil,
      cargo: usuarios.cargo,
      matricula: usuarios.matricula,
      ativo: usuarios.ativo,
      createdAt: usuarios.createdAt,
    })
    .from(usuarios)
    .where(eq(usuarios.orgaoId, orgaoId));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if ((session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const orgaoId = (session.user as any).orgaoId;

    const senhaHash = await bcrypt.hash(data.senha || "Trocar@123", 12);
    const [usuario] = await db
      .insert(usuarios)
      .values({ ...data, senhaHash, orgaoId })
      .returning({
        id: usuarios.id,
        nome: usuarios.nome,
        email: usuarios.email,
        perfil: usuarios.perfil,
      });

    return NextResponse.json(usuario, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
