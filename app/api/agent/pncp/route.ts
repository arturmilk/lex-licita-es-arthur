import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/agent-auth";
import { buscarFonte, buscarTodasFontes, sugerirFontes } from "@/lib/sources";
import type { FonteId } from "@/lib/sources";
import { z } from "zod";

const schema = z.object({
  termo: z.string().min(3),
  fontes: z.array(z.enum(["pncp", "painel_precos", "compras_gov", "bps", "sinapi", "sicro", "manual"])).optional(),
  pagina: z.number().default(1),
  tamanhoPagina: z.number().default(20),
  dataInicial: z.string().optional(),
  dataFinal: z.string().optional(),
  sugerirFontes: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const context = await authenticateAgent(req);
  if (!context) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const params = schema.parse(body);

    const fontesParaBuscar: FonteId[] = params.fontes ||
      (params.sugerirFontes ? sugerirFontes(params.termo) : ["pncp", "painel_precos", "compras_gov"]);

    const resultados = await buscarTodasFontes(fontesParaBuscar, {
      termo: params.termo,
      pagina: params.pagina,
      tamanhoPagina: params.tamanhoPagina,
      dataInicial: params.dataInicial,
      dataFinal: params.dataFinal,
    });

    const todos = resultados.flatMap((r) => r.items);
    const totalPorFonte = resultados.map((r) => ({
      fonte: r.fonte,
      total: r.total,
      encontrados: r.items.length,
      erro: r.erro,
    }));

    return NextResponse.json({
      items: todos.sort((a, b) => b.similaridade - a.similaridade),
      total: todos.length,
      porFonte: totalPorFonte,
      fontesConsultadas: fontesParaBuscar,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
