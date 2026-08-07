import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agent-auth";
import { db } from "@/lib/db";
import { pesquisas, processos } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

export async function GET(req: NextRequest) {
  const context = await authenticateAgent(req);
  if (!context) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const result = await db
    .select({
      id: pesquisas.id,
      objeto: pesquisas.objeto,
      quantidade: pesquisas.quantidade,
      status: pesquisas.status,
      precoUnitarioEstimado: pesquisas.precoUnitarioEstimado,
      precoTotalEstimado: pesquisas.precoTotalEstimado,
      estatisticas: pesquisas.estatisticas,
      createdAt: pesquisas.createdAt,
      processoNumero: processos.numero,
    })
    .from(pesquisas)
    .leftJoin(processos, eq(pesquisas.processoId, processos.id))
    .where(eq(processos.orgaoId, context.orgaoId))
    .orderBy(desc(pesquisas.createdAt))
    .limit(50);

  return NextResponse.json({ pesquisas: result, orgao: context.orgaoNome });
}

export async function POST(req: NextRequest) {
  const context = await authenticateAgent(req);
  if (!context) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();

    const schema = z.object({
      processoNumero: z.string(),
      processoObjeto: z.string(),
      objeto: z.string(),
      quantidade: z.number().default(1),
      unidadeMedida: z.string().default("unidade"),
      usuarioId: z.string().uuid(),
    });

    const data = schema.parse(body);

    // Create or find process
    const existingProcesso = await db
      .select({ id: processos.id })
      .from(processos)
      .where(eq(processos.numero, data.processoNumero))
      .limit(1);

    let processoId: string;
    if (existingProcesso[0]) {
      processoId = existingProcesso[0].id;
    } else {
      const [newProcesso] = await db
        .insert(processos)
        .values({
          numero: data.processoNumero,
          objeto: data.processoObjeto,
          orgaoId: context.orgaoId,
          usuarioId: data.usuarioId,
        })
        .returning({ id: processos.id });
      processoId = newProcesso.id;
    }

    const [pesquisa] = await db
      .insert(pesquisas)
      .values({
        processoId,
        usuarioId: data.usuarioId,
        objeto: data.objeto,
        quantidade: data.quantidade,
        unidadeMedida: data.unidadeMedida,
      })
      .returning();

    return NextResponse.json(pesquisa, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
