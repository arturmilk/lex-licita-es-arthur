import fs from "fs";
import path from "path";

// Log estruturado (JSON lines) para monitorizacao no painel admin
const LOG_DIR = "/app/logs";
const LOG_FILE = path.join(LOG_DIR, "estimaia.log");

export function logEvento(evento: string, dados: Record<string, unknown> = {}) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const linha = JSON.stringify({ ts: new Date().toISOString(), evento, ...dados });
    fs.appendFileSync(LOG_FILE, linha + "\n");
  } catch {
    // nunca deixar o log derrubar o fluxo
  }
}

export function lerLogs(linhas = 400): string {
  try {
    const t = fs.readFileSync(LOG_FILE, "utf8");
    return t.split("\n").filter(Boolean).slice(-linhas).join("\n");
  } catch {
    return "";
  }
}
