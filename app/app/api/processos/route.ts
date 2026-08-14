import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { processos, usuarios, orgaos } from "@/lib/db/schema";
import { eq, and, desc, like, or } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  numero: z.string().min(1),
  objeto: z.string().min(5),
  unidade: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const orgaoId = (session.user as any).orgaoId;
  const { searchParams } = new URL(req.url);
  const busca = searchParams.get("busca");
  const status = searchParams.get("status");

  let query = db
    .select({
      id: processos.id,
      numero: processos.numero,
      objeto: processos.objeto,
      unidade: processos.unidade,
      status: processos.status,
      createdAt: processos.createdAt,
      updatedAt: processos.updatedAt,
      usuarioNome: usuarios.nome,
    })
    .from(processos)
    .leftJoin(usuarios, eq(processos.usuarioId, usuarios.id))
    .where(eq(processos.orgaoId, orgaoId))
    .orderBy(desc(processos.updatedAt));

  const result = await query;

  let filtered = result;
  if (busca) {
    const b = busca.toLowerCase();
    filtered = result.filter(
      (p) =>
        p.numero.toLowerCase().includes(b) || p.objeto.toLowerCase().includes(b)
    );
  }
  if (status) {
    filtered = filtered.filter((p) => p.status === status);
  }

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const orgaoId = (session.user as any).orgaoId;
    const usuarioId = (session.user as any).id as string;

    const [processo] = await db
      .insert(processos)
      .values({ ...data, orgaoId, usuarioId })
      .returning();

    return NextResponse.json(processo, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
