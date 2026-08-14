import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { evidencias } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const schema = z.object({
  pesquisaId: z.string().uuid(),
  nome: z.string(),
  tipo: z.enum(["pdf", "xlsx", "imagem", "link", "print", "outro"]),
  url: z.string(),
  origem: z.string().default("upload"),
  tamanhoBytes: z.number().optional(),
  mimeType: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const pesquisaId = searchParams.get("pesquisaId");

  if (!pesquisaId) return NextResponse.json({ error: "pesquisaId obrigatório" }, { status: 400 });

  const result = await db.select().from(evidencias).where(eq(evidencias.pesquisaId, pesquisaId));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const data = schema.parse(body);
    const [evidencia] = await db.insert(evidencias).values(data).returning();
    return NextResponse.json(evidencia, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
