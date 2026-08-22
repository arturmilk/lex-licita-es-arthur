import fs from "fs";
import path from "path";

// Log estruturado para monitoramento no painel admin.
// Grava no banco (logs_sistema — persistente); se o banco falhar,
// cai para arquivo em LOG_DIR (fallback, ex: /tmp/logs).
const LOG_DIR = process.env.LOG_DIR || "/tmp/logs";
const LOG_FILE = path.join(LOG_DIR, "estimaia.log");

export function logEvento(evento: string, dados: Record<string, unknown> = {}) {
  try {
    // Fire-and-forget: nunca bloqueia nem derruba o fluxo da rota
    void (async () => {
      try {
        const { db } = await import("./db");
        const { logsSistema } = await import("./db/schema");
        await db.insert(logsSistema).values({ evento, dados });
      } catch {
        gravarArquivo(evento, dados);
      }
    })();
  } catch {
    gravarArquivo(evento, dados);
  }
}

function gravarArquivo(evento: string, dados: Record<string, unknown>) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const linha = JSON.stringify({ ts: new Date().toISOString(), evento, ...dados });
    fs.appendFileSync(LOG_FILE, linha + "\n");
  } catch {
    // nunca deixar o log derrubar o fluxo
  }
}

// Fallback: lê do arquivo quando o banco ainda não tem logs (migração pendente etc.)
export async function lerLogsArquivo(linhas = 400): Promise<string> {
  try {
    const t = fs.readFileSync(LOG_FILE, "utf8");
    return t.split("\n").filter(Boolean).slice(-linhas).join("\n");
  } catch {
    return "";
  }
}
