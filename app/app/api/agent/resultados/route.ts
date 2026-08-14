import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agent-auth";
import { db } from "@/lib/db";
import { resultadosPesquisa } from "@/lib/db/schema";
import { z } from "zod";

const itemSchema = z.object({
  pesquisaId: z.string().uuid(),
  sessaoAgenteId: z.string().uuid().optional(),
  fonte: z.enum(["pncp", "painel_precos", "compras_gov", "bps", "sinapi", "sicro", "manual"]),
  orgao: z.string(),
  descricao: z.string(),
  quantidade: z.number().nullable().optional(),
  dataContrato: z.string().nullable().optional(),
  valorUnitario: z.number().nullable().optional(),
  valorTotal: z.number().nullable().optional(),
  localizacao: z.string().nullable().optional(),
  similaridade: z.number().int().default(0),
  documentoOrigem: z.string().nullable().optional(),
  linkEdital: z.string().nullable().optional(),
  dadosBrutos: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const context = await authenticateAgent(req);
  if (!context) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const items = Array.isArray(body) ? body : [body];
    const validated = items.map((i) => itemSchema.parse(i));

    const inserted = await db
      .insert(resultadosPesquisa)
      .values(validated as any)
      .returning({ id: resultadosPesquisa.id, fonte: resultadosPesquisa.fonte });

    return NextResponse.json({ inseridos: inserted.length, ids: inserted.map((i) => i.id) }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
