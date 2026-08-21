import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { buscarFonte, buscarTodasFontes } from "@/lib/sources";
import type { FonteId, ResultadoBruto } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const termo = searchParams.get("termo");
  const fonte = (searchParams.get("fonte") || "pncp") as FonteId;
  // fontes=precos_abertos,compras_gov — busca múltiplas fontes em paralelo
  const fontesParam = searchParams.get("fontes");
  const pagina = Number(searchParams.get("pagina") || "1");
  const tamanhoPagina = Number(searchParams.get("tamanhoPagina") || "20");
  const uf = searchParams.get("uf") || undefined;
  const dataInicial = searchParams.get("dataInicial") || undefined;
  const dataFinal = searchParams.get("dataFinal") || undefined;

  if (!termo) return NextResponse.json({ error: "Parâmetro 'termo' obrigatório" }, { status: 400 });

  const inicio = Date.now();
  const { logEvento } = await import("@/lib/logger");
  const params = { termo, pagina, tamanhoPagina, uf, dataInicial, dataFinal };

  if (fontesParam) {
    // Busca múltiplas fontes em paralelo e mescla resultados
    const fonteIds = fontesParam.split(",").map(f => f.trim()).filter(Boolean) as FonteId[];
    const resultados = await buscarTodasFontes(fonteIds, params);

    // Mescla, desuplica por descrição+orgao e ordena por similaridade
    const vistos = new Set<string>();
    const items: ResultadoBruto[] = [];
    for (const r of resultados) {
      for (const it of r.items) {
        const chave = `${(it.descricao || "").slice(0, 60)}|${it.orgao}`;
        if (!vistos.has(chave)) { vistos.add(chave); items.push(it); }
      }
    }
    items.sort((a, b) => b.similaridade - a.similaridade);

    const totalItems = resultados.reduce((acc, r) => acc + r.total, 0);
    const erros = resultados.filter(r => r.erro).map(r => `${r.fonte}: ${r.erro}`);
    logEvento("consulta_fonte", { fonte: fontesParam, termo: termo.slice(0, 120), uf, total: totalItems, items: items.length, erro: erros.join("; ") || null, ms: Date.now() - inicio });
    return NextResponse.json({ fontes: fonteIds, items, total: items.length, erros: erros.length ? erros : undefined });
  }

  const result = await buscarFonte(fonte, params);
  logEvento("consulta_fonte", { fonte, termo: termo.slice(0, 120), uf, total: result?.total ?? 0, items: result?.items?.length ?? 0, erro: result?.erro ?? null, ms: Date.now() - inicio });
  return NextResponse.json(result);
}
