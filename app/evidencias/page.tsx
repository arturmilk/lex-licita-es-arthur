import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { evidencias, pesquisas, processos } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import EvidenciasClient from "@/components/EvidenciasClient";

export default async function EvidenciasPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const orgaoId = (session.user as any).orgaoId;

  const result = await db
    .select({
      id: evidencias.id,
      nome: evidencias.nome,
      tipo: evidencias.tipo,
      url: evidencias.url,
      origem: evidencias.origem,
      tamanhoBytes: evidencias.tamanhoBytes,
      createdAt: evidencias.createdAt,
      pesquisaId: evidencias.pesquisaId,
      processoNumero: processos.numero,
    })
    .from(evidencias)
    .leftJoin(pesquisas, eq(evidencias.pesquisaId, pesquisas.id))
    .leftJoin(processos, eq(pesquisas.processoId, processos.id))
    .where(eq(processos.orgaoId, orgaoId))
    .orderBy(desc(evidencias.createdAt));

  const links = result.filter((e) => e.tipo === "link" && e.origem === "PNCP");
  const docs = result.filter((e) => e.origem !== "PNCP" || e.tipo !== "link");

  return <EvidenciasClient links={links} docs={docs} />;
}
