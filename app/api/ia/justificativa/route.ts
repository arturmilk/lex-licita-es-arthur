import { NextRequest, NextResponse } from "next/server";
import { gerarJustificativa } from "@/lib/openclaw-client";

// Rota interna: liga o wizard ao Agente Justificador (server-side)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { estatisticas, metodo, quantidade, referenciasAceitas } = body;
    if (!estatisticas || !metodo) {
      return NextResponse.json({ error: "estatisticas e metodo são obrigatórios" }, { status: 400 });
    }
    const resultado = await gerarJustificativa(estatisticas, metodo, quantidade ?? 1, referenciasAceitas ?? estatisticas.n ?? 0);
    return NextResponse.json(resultado);
  } catch (err: any) {
    return NextResponse.json({ error: "Erro no agente justificador", detalhe: err?.message }, { status: 500 });
  }
}
