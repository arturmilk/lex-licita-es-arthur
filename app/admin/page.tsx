import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { usuarios, configuracoes, apiKeys } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import AdminClient from "@/components/AdminClient";

export default async function AdminPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const user = session.user as any;
  if (user.perfil !== "administrador") redirect("/dashboard");

  const orgaoId = user.orgaoId;

  const [listaUsuarios, config, chaves] = await Promise.all([
    db.select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      perfil: usuarios.perfil,
      cargo: usuarios.cargo,
      ativo: usuarios.ativo,
      createdAt: usuarios.createdAt,
    }).from(usuarios).where(eq(usuarios.orgaoId, orgaoId)),
    db.select().from(configuracoes).where(eq(configuracoes.orgaoId, orgaoId)).limit(1),
    db.select({
      id: apiKeys.id,
      nome: apiKeys.nome,
      chave: apiKeys.chave,
      ativo: apiKeys.ativo,
      ultimoUso: apiKeys.ultimoUso,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).where(eq(apiKeys.orgaoId, orgaoId)),
  ]);

  const configAtual = config[0] || {
    similaridadeMinima: 75,
    cvAlerta: 25,
    periodoPadrao: "12_meses",
    metodoPadrao: "media_aritmetica",
    fontesAtivas: ["pncp", "painel_precos"],
  };

  return <AdminClient usuarios={listaUsuarios} config={configAtual} apiKeys={chaves} orgaoId={orgaoId} />;
}
