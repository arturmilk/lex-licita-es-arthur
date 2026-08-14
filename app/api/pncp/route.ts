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
  const uf = searchParams.get("uf") || undefined;
  const dataInicial = searchParams.get("dataInicial") || undefined;
  const dataFinal = searchParams.get("dataFinal") || undefined;

  if (!termo) return NextResponse.json({ error: "Parâmetro 'termo' obrigatório" }, { status: 400 });

  const inicio = Date.now();
  const result = await buscarFonte(fonte, { termo, pagina, tamanhoPagina, uf, dataInicial, dataFinal });
  const { logEvento } = await import("@/lib/logger");
  logEvento("consulta_fonte", { fonte, termo: termo.slice(0, 120), uf, total: result?.total ?? 0, items: result?.items?.length ?? 0, erro: result?.erro ?? null, ms: Date.now() - inicio });
  return NextResponse.json(result);
}
