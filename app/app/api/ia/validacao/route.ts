import { NextRequest, NextResponse } from "next/server";
import { validarPesquisa } from "@/lib/openclaw-client";

// Rota interna: Agente Validador — 100% determinístico, sem custo de LLM
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { n, cv, min_referencias, cv_limite, similaridade_minima, menor_similaridade_aceita } = body;
    if (n === undefined || cv === undefined) {
      return NextResponse.json({ error: "n e cv são obrigatórios" }, { status: 400 });
    }
    const resultado = await validarPesquisa({
      n: Number(n),
      cv: Number(cv),
      min_referencias: Number(min_referencias ?? 5),
      cv_limite: Number(cv_limite ?? 25),
      similaridade_minima: Number(similaridade_minima ?? 75),
      menor_similaridade_aceita: Number(menor_similaridade_aceita ?? 100),
    });
    return NextResponse.json(resultado);
  } catch (err: any) {
    return NextResponse.json({ error: "Erro na validação", detalhe: err?.message }, { status: 500 });
  }
}
