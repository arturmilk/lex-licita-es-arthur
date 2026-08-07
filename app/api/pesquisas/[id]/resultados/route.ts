import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resultadosPesquisa } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const itemSchema = z.object({
  fonte: z.enum(["pncp", "painel_precos", "compras_gov", "bps", "sinapi", "sicro", "manual"]).default("pncp"),
  orgao: z.string(),
  descricao: z.string(),
  quantidade: z.number().nullable().optional(),
  dataContrato: z.string().nullable().optional(),
  valorUnitario: z.number().nullable().optional(),
  valorTotal: z.number().nullable().optional(),
  localizacao: z.string().nullable().optional(),
  similaridade: z.number().default(0),
  documentoOrigem: z.string().nullable().optional(),
  linkEdital: z.string().nullable().optional(),
  dadosBrutos: z.record(z.unknown()).optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fonte = searchParams.get("fonte");

  let query = db.select().from(resultadosPesquisa).where(eq(resultadosPesquisa.pesquisaId, params.id));

  const results = await query;
  const filtered = fonte ? results.filter((r) => r.fonte === fonte) : results;

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const validated = items.map((i) => itemSchema.parse(i));

    const inserted = await db
      .insert(resultadosPesquisa)
      .values(validated.map((v) => ({ ...v, pesquisaId: params.id } as any)))
      .returning();

    return NextResponse.json(inserted, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
