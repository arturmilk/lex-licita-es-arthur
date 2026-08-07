import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buscarFonte } from "@/lib/sources";
import type { FonteId } from "@/lib/sources";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const termo = searchParams.get("termo");
  const fonte = (searchParams.get("fonte") || "pncp") as FonteId;
  const pagina = Number(searchParams.get("pagina") || "1");
  const tamanhoPagina = Number(searchParams.get("tamanhoPagina") || "20");

  if (!termo) return NextResponse.json({ error: "Parâmetro 'termo' obrigatório" }, { status: 400 });

  const result = await buscarFonte(fonte, { termo, pagina, tamanhoPagina });
  return NextResponse.json(result);
}
