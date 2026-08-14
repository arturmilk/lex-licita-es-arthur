import crypto from "crypto";
import fs from "fs";

// Cliente BigQuery minimalista (JWT com a service account — sem dependencias externas)
// Credenciais: env GOOGLE_SA_JSON (conteudo JSON) ou ficheiro GOOGLE_SA_FILE (default /app/service-account.json)

interface SA {
  client_email: string;
  private_key: string;
  project_id: string;
}

function getSA(): SA {
  const env = process.env.GOOGLE_SA_JSON;
  if (env) return JSON.parse(env) as SA;
  const p = process.env.GOOGLE_SA_FILE || "/app/service-account.json";
  return JSON.parse(fs.readFileSync(p, "utf8")) as SA;
}

async function obterToken(sa: SA): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const claims = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/bigquery",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  ).toString("base64url");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(`${header}.${claims}`);
  const sig = sign.sign(sa.private_key, "base64url");
  const assertion = `${header}.${claims}.${sig}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}`,
  });
  const d = await res.json();
  if (!d.access_token) throw new Error("Falha no token GCP: " + JSON.stringify(d).slice(0, 200));
  return d.access_token;
}

export async function bqQuery(sql: string, maxResults = 2000): Promise<any[]> {
  const sa = getSA();
  const tok = await obterToken(sa);
  const res = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${sa.project_id}/queries`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ query: sql, useLegacySql: false, maxResults }),
    }
  );
  const d = await res.json();
  if (d.error) throw new Error("BigQuery: " + (d.error.message || "erro"));
  const rows = d.rows || [];
  const fields = (d.schema?.fields || []) as { name: string }[];
  return rows.map((r: any) =>
    Object.fromEntries(fields.map((f, i) => [f.name, r.f[i]?.v ?? null]))
  );
}

export async function bqTabelasDoDataset(dataset: string): Promise<string[]> {
  const rows = await bqQuery(
    `SELECT table_name FROM \`${dataset}.INFORMATION_SCHEMA.TABLES\` ORDER BY table_name`,
    500
  );
  return rows.map((r) => r.table_name).filter(Boolean);
}
