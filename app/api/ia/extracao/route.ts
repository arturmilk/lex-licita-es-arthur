import { NextRequest, NextResponse } from "next/server";
import { extrairCaracteristicas } from "@/lib/openclaw-client";

// Rota interna: liga o wizard ao Agente Extrator (server-side)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { descricao, especificacoes } = body;
    if (!descricao || typeof descricao !== "string" || descricao.trim().length < 10) {
      return NextResponse.json({ error: "Descrição do objeto é obrigatória (mín. 10 caracteres)" }, { status: 400 });
    }
    const inicio = Date.now();
    const resultado = await extrairCaracteristicas(descricao, especificacoes || []);
    const { logEvento } = await import("@/lib/logger");
    logEvento("ia_extracao", { ok: true, carac: resultado?.caracteristicas?.length ?? 0, ms: Date.now() - inicio });
    return NextResponse.json(resultado);
  } catch (err: any) {
    const { logEvento } = await import("@/lib/logger");
    logEvento("ia_extracao", { ok: false, erro: err?.message?.slice(0, 300) });
    return NextResponse.json({ error: "Erro no agente extrator", detalhe: err?.message }, { status: 500 });
  }
}
