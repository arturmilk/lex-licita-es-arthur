import { NextRequest, NextResponse } from "next/server";
import { resumirDocumento } from "@/lib/ia";

export const maxDuration = 120;

/**
 * POST /api/ia/documento
 * Recebe um arquivo (PDF/TXT) e devolve o resumo estruturado pela IA:
 * o que aconteceu, o que importa, o que falta, prazos e ação necessária.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const arquivo = form.get("arquivo") as File | null;
    if (!arquivo) {
      return NextResponse.json({ erro: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const nome = arquivo.name || "documento";
    const buffer = Buffer.from(await arquivo.arrayBuffer());

    let texto = "";
    if (nome.toLowerCase().endsWith(".txt") || nome.toLowerCase().endsWith(".md")) {
      texto = buffer.toString("utf-8");
    } else if (nome.toLowerCase().endsWith(".pdf")) {
      // Extrai texto do PDF (pdf-parse v2+: exporta PDFParse)
      const mod = await import("pdf-parse");
      const PDFParse = (mod as any).PDFParse || (mod as any).default;
      const parser = new PDFParse({ data: buffer });
      const resultado = await parser.getText();
      texto = typeof resultado === "string" ? resultado : (resultado?.text ?? "");
    } else {
      return NextResponse.json({ erro: "Formato não suportado. Envie PDF ou TXT." }, { status: 400 });
    }

    if (texto.trim().length < 40) {
      return NextResponse.json({ erro: "Não foi possível extrair texto do documento (pode ser um PDF escaneado/imagem)." }, { status: 422 });
    }

    const resumo = await resumirDocumento(texto);
    return NextResponse.json({ nome, texto: texto.slice(0, 12000), resumo });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message || "Falha ao processar documento" }, { status: 500 });
  }
}
