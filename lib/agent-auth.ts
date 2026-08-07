import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiKeys, orgaos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function authenticateAgent(req: NextRequest): Promise<{
  orgaoId: string;
  orgaoNome: string;
} | null> {
  const authHeader = req.headers.get("Authorization");
  const apiKeyHeader = req.headers.get("X-API-Key");

  const key = apiKeyHeader || authHeader?.replace("Bearer ", "");
  if (!key) return null;

  // Check master key (for admin/system use)
  if (key === process.env.AGENT_API_KEY) {
    // Return a system context - you'd typically require orgaoId in query params
    const orgaoIdParam = new URL(req.url).searchParams.get("orgaoId");
    if (orgaoIdParam) {
      const orgao = await db
        .select({ id: orgaos.id, nome: orgaos.nome })
        .from(orgaos)
        .where(eq(orgaos.id, orgaoIdParam))
        .limit(1);
      if (orgao[0]) return { orgaoId: orgao[0].id, orgaoNome: orgao[0].nome };
    }
    return null;
  }

  // Check per-org API keys
  const result = await db
    .select({
      orgaoId: apiKeys.orgaoId,
      orgaoNome: orgaos.nome,
    })
    .from(apiKeys)
    .leftJoin(orgaos, eq(apiKeys.orgaoId, orgaos.id))
    .where(and(eq(apiKeys.chave, key), eq(apiKeys.ativo, true)))
    .limit(1);

  if (!result[0]?.orgaoId || !result[0]?.orgaoNome) return null;

  // Update last use
  await db
    .update(apiKeys)
    .set({ ultimoUso: new Date() })
    .where(eq(apiKeys.chave, key));

  return { orgaoId: result[0].orgaoId, orgaoNome: result[0].orgaoNome };
}
