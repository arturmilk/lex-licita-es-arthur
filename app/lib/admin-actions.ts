"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { usuarios, feedbacks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function getAdminSession() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const user = session.user as any;
  if (user.perfil !== "administrador") throw new Error("Acesso restrito a administradores");
  return user;
}

export async function listarUsuarios() {
  const user = await getAdminSession();
  return db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      perfil: usuarios.perfil,
      cargo: usuarios.cargo,
      matricula: usuarios.matricula,
      ativo: usuarios.ativo,
      createdAt: usuarios.createdAt,
    })
    .from(usuarios)
    .where(eq(usuarios.orgaoId, user.orgaoId))
    .orderBy(desc(usuarios.createdAt));
}

export async function criarUsuario(data: {
  nome: string;
  email: string;
  senha: string;
  perfil: "pesquisador" | "administrador" | "gestor";
  cargo?: string;
  matricula?: string;
}) {
  const user = await getAdminSession();
  const senhaHash = await bcrypt.hash(data.senha, 12);
  const [novo] = await db
    .insert(usuarios)
    .values({
      nome: data.nome,
      email: data.email,
      senhaHash,
      perfil: data.perfil,
      cargo: data.cargo || null,
      matricula: data.matricula || null,
      orgaoId: user.orgaoId,
    })
    .returning();
  revalidatePath("/admin");
  return novo;
}

export async function ativarDesativarUsuario(id: string, ativo: boolean) {
  await getAdminSession();
  await db.update(usuarios).set({ ativo }).where(eq(usuarios.id, id));
  revalidatePath("/admin");
}

export async function enviarFeedback(mensagem: string, pagina?: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const user = session.user as any;
  await db.insert(feedbacks).values({
    usuarioId: user.id,
    orgaoId: user.orgaoId,
    mensagem,
    pagina: pagina || null,
  });
}

export async function listarFeedbacks() {
  const user = await getAdminSession();
  const resultado = await db
    .select({
      id: feedbacks.id,
      mensagem: feedbacks.mensagem,
      pagina: feedbacks.pagina,
      lido: feedbacks.lido,
      createdAt: feedbacks.createdAt,
      usuarioId: feedbacks.usuarioId,
    })
    .from(feedbacks)
    .where(eq(feedbacks.orgaoId, user.orgaoId))
    .orderBy(desc(feedbacks.createdAt));

  // Busca nomes dos usuários separadamente
  const ids = [...new Set(resultado.map(f => f.usuarioId).filter(Boolean))] as string[];
  let nomes: Record<string, string> = {};
  if (ids.length > 0) {
    const users = await db
      .select({ id: usuarios.id, nome: usuarios.nome })
      .from(usuarios)
      .where(eq(usuarios.orgaoId, user.orgaoId));
    nomes = Object.fromEntries(users.map(u => [u.id, u.nome]));
  }

  return resultado.map(f => ({ ...f, usuarioNome: f.usuarioId ? nomes[f.usuarioId] || "—" : "—" }));
}

export async function marcarFeedbackLido(id: string) {
  await getAdminSession();
  await db.update(feedbacks).set({ lido: true }).where(eq(feedbacks.id, id));
  revalidatePath("/admin");
}
