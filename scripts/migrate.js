// migrate.js — aplica scripts/migrations/*.sql na inicialização (produção e dev)
// Usa o driver `postgres` (já dependência de produção). Idempotente.
const { readdirSync, readFileSync } = require("fs");
const { join } = require("path");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate] DATABASE_URL ausente — pulando migrações");
    process.exit(0);
  }
  const postgres = require("postgres");
  const sql = postgres(url, { max: 1 });

  const dir = join(__dirname, "migrations");
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    console.error("[migrate] diretório de migrações não encontrado:", dir);
    process.exit(0);
  }

  for (const f of files) {
    const content = readFileSync(join(dir, f), "utf8");
    try {
      await sql.unsafe(content);
      console.log(`[migrate] aplicada: ${f}`);
    } catch (e) {
      console.error(`[migrate] erro em ${f}:`, e.message);
      process.exit(1);
    }
  }
  await sql.end();
  console.log("[migrate] todas as migrações aplicadas com sucesso");
}

main().catch((e) => {
  console.error("[migrate] falha:", e);
  process.exit(1);
});
