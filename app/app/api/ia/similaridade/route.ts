import { NextRequest, NextResponse } from "next/server";
import { calcularSimilaridade } from "@/lib/openclaw-client";

// Rota interna: liga o wizard ao Agente Similaridade (server-side, em lote)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { objeto, especificacoes, candidatos } = body;
    if (!objeto || !Array.isArray(candidatos) || candidatos.length === 0) {
      return NextResponse.json({ error: "objeto e candidatos[] são obrigatórios" }, { status: 400 });
    }
    const resultados = await Promise.all(
      candidatos.map(async (c: any) => {
        const sim = await calcularSimilaridade(objeto, especificacoes || [], {
          descricao: c.descricao || "",
          orgao: c.orgao || "Não informado",
          localizacao: c.localizacao || "Não informada",
        });
        return { ...c, ...sim };
      })
    );
    return NextResponse.json({ resultados });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro no agente similaridade", detalhe: err?.message }, { status: 500 });
  }
}
