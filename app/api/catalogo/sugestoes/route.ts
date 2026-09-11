import { NextRequest, NextResponse } from "next/server";
import { sugerirOpcoesCatalogoPesquisa } from "@/lib/dfd-intelligence";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const descricao = String(body?.descricao || "").trim();
    if (descricao.length < 3) return NextResponse.json({ error: "Informe a descrição do item." }, { status: 400 });
    const data = await sugerirOpcoesCatalogoPesquisa({
      descricao,
      especificacao: String(body?.especificacao || "").trim(),
      quantidade: body?.quantidade,
      unidade: String(body?.unidade || "").trim(),
      localEntrega: String(body?.localEntrega || "").trim(),
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: "Não foi possível consultar o catálogo oficial agora.", detalhe: String(e?.message || e).slice(0,200) }, { status: 500 });
  }
}
