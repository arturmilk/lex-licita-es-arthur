import { NextRequest, NextResponse } from "next/server";
import { resumirDocumento, extrairDadosDocumento } from "@/lib/ia";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";
import { execFile } from "child_process";

export const maxDuration = 120;

const execFileAsync = promisify(execFile);
const MAX_TEXTO_IA = 30000;
const MAX_PLANILHA_LINHAS = 500;
const MAX_OCR_PAGINAS = 20;

function ext(nome: string) {
  return path.extname(nome || "").toLowerCase();
}

async function ocrImagem(buffer: Buffer, extensao: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lex-ocr-img-"));
  try {
    const origem = path.join(dir, `imagem${extensao || ".png"}`);
    await fs.writeFile(origem, buffer);
    const { stdout } = await execFileAsync("tesseract", [origem, "stdout", "-l", "por+eng", "--psm", "6"], {
      maxBuffer: 20 * 1024 * 1024,
      timeout: 90000,
    });
    return stdout || "";
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function ocrPdf(buffer: Buffer): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "lex-ocr-pdf-"));
  try {
    const pdf = path.join(dir, "documento.pdf");
    const prefix = path.join(dir, "pagina");
    await fs.writeFile(pdf, buffer);
    await execFileAsync("pdftoppm", ["-jpeg", "-r", "180", "-f", "1", "-l", String(MAX_OCR_PAGINAS), pdf, prefix], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 90000,
    });
    const arquivos = (await fs.readdir(dir)).filter(f => /^pagina-.*\.jpg$/i.test(f)).sort();
    const partes: string[] = [];
    for (const arquivo of arquivos) {
      const { stdout } = await execFileAsync("tesseract", [path.join(dir, arquivo), "stdout", "-l", "por+eng", "--psm", "6"], {
        maxBuffer: 20 * 1024 * 1024,
        timeout: 90000,
      });
      if (stdout?.trim()) partes.push(stdout.trim());
    }
    return partes.join("\n\n");
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function lerPlanilha(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const blocos: string[] = [];
  for (const nomeAba of wb.SheetNames.slice(0, 20)) {
    const ws = wb.Sheets[nomeAba];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    const linhas = csv.split(/\r?\n/).slice(0, MAX_PLANILHA_LINHAS);
    blocos.push(`ABA: ${nomeAba}\n${linhas.join("\n")}`);
  }
  return blocos.join("\n\n");
}

/**
 * POST /api/ia/documento — AGENTE LEITOR
 * Suporta texto, PDF textual/escaneado, DOCX, XLSX/XLS/CSV e imagens.
 * Todo conteúdo extraído segue para a mesma camada de assimilação documental.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const arquivo = form.get("arquivo") as File | null;
    if (!arquivo) return NextResponse.json({ erro: "Nenhum arquivo enviado" }, { status: 400 });

    const nome = arquivo.name || "documento";
    const extensao = ext(nome);
    const buffer = Buffer.from(await arquivo.arrayBuffer());
    let texto = "";
    let modoLeitura = "texto";

    if ([".txt", ".md", ".csv"].includes(extensao)) {
      texto = buffer.toString("utf-8");
      modoLeitura = extensao === ".csv" ? "planilha-csv" : "texto";
    } else if (extensao === ".docx") {
      const mammoth = await import("mammoth");
      const resultado = await mammoth.extractRawText({ buffer });
      texto = resultado.value || "";
      modoLeitura = "docx";
    } else if ([".xlsx", ".xls"].includes(extensao)) {
      texto = await lerPlanilha(buffer);
      modoLeitura = "planilha";
    } else if (extensao === ".pdf") {
      const mod = await import("pdf-parse");
      const PDFParse = (mod as any).PDFParse || (mod as any).default;
      const parser = new PDFParse({ data: buffer });
      const resultado = await parser.getText();
      texto = typeof resultado === "string" ? resultado : (resultado?.text ?? "");
      modoLeitura = "pdf-texto";
      if (texto.trim().length < 80) {
        texto = await ocrPdf(buffer);
        modoLeitura = "pdf-ocr";
      }
    } else if ([".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp"].includes(extensao)) {
      texto = await ocrImagem(buffer, extensao);
      modoLeitura = "imagem-ocr";
    } else {
      return NextResponse.json({
        erro: "Formato não suportado. Envie PDF, DOCX, XLSX/XLS, CSV, TXT/MD ou imagem (PNG/JPG/TIFF/BMP/WEBP).",
      }, { status: 400 });
    }

    texto = texto.replace(/\u0000/g, "").trim();
    if (texto.length < 40) {
      return NextResponse.json({ erro: "Não foi possível extrair conteúdo suficiente deste arquivo." }, { status: 422 });
    }

    const textoIA = texto.slice(0, MAX_TEXTO_IA);
    const resumo = await resumirDocumento(textoIA);
    const dados = await extrairDadosDocumento(textoIA);

    return NextResponse.json({
      nome,
      modoLeitura,
      texto: textoIA,
      textoTruncado: texto.length > MAX_TEXTO_IA,
      resumo,
      dados,
    });
  } catch (e: any) {
    return NextResponse.json({ erro: e?.message || "Falha ao processar documento" }, { status: 500 });
  }
}
