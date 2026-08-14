import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agent-auth";
import { calcularEstatisticas, calcularPrecoEstimado } from "@/lib/math";
import { z } from "zod";

const schema = z.object({
  valores: z.array(z.number()).min(1),
  metodo: z.enum(["media_aritmetica", "mediana", "media_ponderada", "menor_preco"]).default("media_aritmetica"),
  quantidade: z.number().default(1),
  pesos: z.array(z.number()).optional(),
});

export async function POST(req: NextRequest) {
  const context = await authenticateAgent(req);
  if (!context) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { valores, metodo, quantidade, pesos } = schema.parse(body);

    const estatisticas = calcularEstatisticas(valores);
    const resultado = calcularPrecoEstimado(valores, metodo, quantidade);
    const precoUnitario = resultado.unitario;
    const precoTotal = resultado.total;

    return NextResponse.json({
      estatisticas,
      precoUnitario,
      precoTotal,
      metodo,
      quantidade,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
