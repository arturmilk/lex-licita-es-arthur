import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * POST /api/ia/transcrever
 * Recebe um áudio (webm/mp3/ogg) e devolve o texto transcrito (DeepSeek não
 * transcreve áudio — usamos o mesmo motor do Célia quando disponível; aqui
 * uma implementação via Whisper local (funil) com fallback amigável).
 */
export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const arquivo = fd.get("arquivo") as File | null;
    if (!arquivo) return NextResponse.json({ erro: "Arquivo não enviado" }, { status: 400 });

    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const ext = arquivo.name.split(".").pop()?.toLowerCase() || "webm";
    const caminho = `/tmp/voz_${Date.now()}.${ext}`;
    const { writeFileSync } = await import("fs");
    writeFileSync(caminho, bytes);

    // Tenta whisper.cpp local (modelo pequeno instalado no servidor)
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileP = promisify(execFile);

    const caminhos = [
      "/usr/local/bin/whisper-cli",
      "/usr/bin/whisper-cli",
      "/root/whisper.cpp/build/bin/whisper-cli",
      "/root/whisper.cpp/main",
    ];

    for (const bin of caminhos) {
      try {
        const model = "/root/whisper.cpp/models/ggml-small.bin";
        const { stdout } = await execFileP(bin, ["-m", model, "-f", caminho, "-otxt", "--no-prints"], { timeout: 45_000 });
        // whisper-cli imprime o texto no stdout com -otxt? garante: lê o arquivo .txt
        const txtPath = caminho + ".txt";
        const { readFileSync } = await import("fs");
        const texto = (readFileSync(txtPath, "utf-8") || stdout || "").trim();
        if (texto) {
          const { unlinkSync } = await import("fs");
          try { unlinkSync(caminho); unlinkSync(txtPath); } catch {}
          return NextResponse.json({ texto });
        }
      } catch { /* tenta o próximo binário */ }
    }

    // Sem whisper local: fallback via API (se houver chave de transcrição)
    const apiKey = process.env.TRANSCRIPT_API_KEY;
    if (apiKey) {
      try {
        const resp = await fetch("https://api.deepgram.com/v1/listen", {
          method: "POST",
          headers: { Authorization: `Token ${apiKey}`, "Content-Type": arquivo.type || "audio/webm" },
          body: bytes,
          signal: AbortSignal.timeout(30_000),
        });
        const data = await resp.json();
        const texto = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
        if (texto) return NextResponse.json({ texto });
      } catch { /* fallback final */ }
    }

    return NextResponse.json({ erro: "Não foi possível transcrever o áudio agora." }, { status: 422 });
  } catch (e: any) {
    return NextResponse.json({ erro: String(e?.message || e) }, { status: 500 });
  }
}
