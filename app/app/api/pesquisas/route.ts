import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pesquisas, processos } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  processoId: z.string().uuid(),
  objeto: z.string().min(5),
  especificacoes: z.array(z.object({
    item: z.string(),
    especificacao: z.string(),
    obrigatorio: z.boolean(),
  })).optional(),
  quantidade: z.number().int().positive().default(1),
  unidadeMedida: z.string().default("unidade"),
  localEntrega: z.string().optional(),
  formaParcelamento: z.string().default("item"),
  periodoPesquisa: z.string().default("12_meses"),
  regiaoPesquisa: z.string().default("brasil"),
  metodoCalculo: z.enum(["media_aritmetica", "mediana", "media_ponderada", "menor_preco"]).default("media_aritmetica"),
  qtdMinReferencias: z.number().int().default(3),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const orgaoId = (session.user as any).orgaoId;

  const result = await db
    .select({
      id: pesquisas.id,
      objeto: pesquisas.objeto,
      quantidade: pesquisas.quantidade,
      status: pesquisas.status,
      precoUnitarioEstimado: pesquisas.precoUnitarioEstimado,
      createdAt: pesquisas.createdAt,
      processoNumero: processos.numero,
      processoId: pesquisas.processoId,
    })
    .from(pesquisas)
    .leftJoin(processos, eq(pesquisas.processoId, processos.id))
    .where(eq(processos.orgaoId, orgaoId))
    .orderBy(desc(pesquisas.createdAt));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const usuarioId = (session.user as any).id as string;

    const [pesquisa] = await db
      .insert(pesquisas)
      .values({ ...data, usuarioId })
      .returning();

    return NextResponse.json(pesquisa, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
