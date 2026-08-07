import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { FONTES_CONFIG, sugerirFontes } from "@/lib/sources";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const termo = searchParams.get("termo");

  return NextResponse.json({
    fontes: FONTES_CONFIG,
    sugeridas: termo ? sugerirFontes(termo) : ["pncp", "painel_precos", "compras_gov"],
  });
}
