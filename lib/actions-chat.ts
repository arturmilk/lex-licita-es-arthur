"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { conversasChat, memoriaOrgao, processos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { estadoInicial, responder, mensagemAbertura, type EstadoChat } from "@/lib/chat";

async function sessao() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const user = session.user as any;
  return { userId: user.id as string, orgaoId: user.orgaoId as string, nome: user.nome as string };
}

/** Lê as preferências aprendidas do órgão (memória) + dados do cadastro. */
export async function lerMemoriaOrgao() {
  const { orgaoId } = await sessao();
  const rows = await db.select().from(memoriaOrgao).where(eq(memoriaOrgao.orgaoId, orgaoId));
  const mapa: Record<string, string> = {};
  for (const r of rows) mapa[r.chave] = r.valor;
  // Auto-preenchimento: dados do cadastro do órgão já entram na memória
  try {
    const { orgaos, usuarios } = await import("@/lib/db/schema");
    const { auth } = await import("@/auth");
    const session = await auth();
    const user = session?.user as any;
    if (user?.orgaoId) {
      const [orgao] = await db.select({ nome: orgaos.nome }).from(orgaos).where(eq(orgaos.id, user.orgaoId)).limit(1);
      if (orgao?.nome) mapa.orgao_nome = orgao.nome;
      if (user.ug) mapa.ug_preferida = user.ug;
    }
  } catch { /* cadastro indisponível — segue sem */ }
  return mapa;
}

/** Registra/aprende uma preferência do órgão (auto-aprendizado). */
export async function registrarMemoria(chave: string, valor: string) {
  const { orgaoId } = await sessao();
  if (!valor || !chave) return;
  const [existente] = await db.select().from(memoriaOrgao)
    .where(and(eq(memoriaOrgao.orgaoId, orgaoId), eq(memoriaOrgao.chave, chave))).limit(1);
  if (existente) {
    await db.update(memoriaOrgao)
      .set({ valor, usos: existente.usos + 1, ultimoUso: new Date() })
      .where(eq(memoriaOrgao.id, existente.id));
  } else {
    await db.insert(memoriaOrgao).values({ orgaoId, chave, valor });
  }
}

/** Cria uma nova conversa (capa do chat). */
export async function novaConversaChat() {
  const { orgaoId, userId } = await sessao();
  const memorias = await lerMemoriaOrgao();
  const abertura = mensagemAbertura(Object.keys(memorias).length > 0, memorias);
  const [conversa] = await db.insert(conversasChat).values({
    orgaoId, usuarioId: userId,
    mensagens: [abertura],
    statusDocumentos: {},
    etapaAtual: "intencao",
  }).returning();
  return { conversa, memorias };
}

/** Lista conversas do órgão. */
export async function listarConversasChat() {
  const { orgaoId } = await sessao();
  return db.select().from(conversasChat).where(eq(conversasChat.orgaoId, orgaoId))
    .orderBy(conversasChat.updatedAt);
}

/** Carrega uma conversa existente. */
export async function carregarConversaChat(conversaId: string) {
  const { orgaoId } = await sessao();
  const [conversa] = await db.select().from(conversasChat)
    .where(and(eq(conversasChat.id, conversaId), eq(conversasChat.orgaoId, orgaoId))).limit(1);
  if (!conversa) throw new Error("Conversa não encontrada");
  const memorias = await lerMemoriaOrgao();
  return { conversa, memorias };
}

/**
 * Envia uma mensagem do servidor (texto/voz transcrita) e devolve as respostas.
 * Estado da conversa é reconstruído das mensagens (etapaAtual + statusDocumentos persistidos).
 */
export async function enviarMensagemChat(conversaId: string, texto: string) {
  const { orgaoId } = await sessao();
  const [conversa] = await db.select().from(conversasChat)
    .where(and(eq(conversasChat.id, conversaId), eq(conversasChat.orgaoId, orgaoId))).limit(1);
  if (!conversa) throw new Error("Conversa não encontrada");

  const memorias = await lerMemoriaOrgao();

  // Reconstrói estado do chat a partir do estado completo persistido
  const estadoSalvo = (conversa.statusDocumentos as any) || {};
  const estado: EstadoChat = {
    etapa: (conversa.etapaAtual as string) || "intencao",
    objeto: estadoSalvo.objeto,
    tipoProcesso: estadoSalvo.tipoProcesso,
    ug: estadoSalvo.ug,
    documentoAtual: estadoSalvo.documentoAtual,
    documentos: estadoSalvo.documentos || {},
    perguntaAtual: estadoSalvo.perguntaAtual,
    docColeta: estadoSalvo.docColeta,   // coleta guiada (PC/ETP campo a campo)
    catmat: estadoSalvo.catmat,
    minuta: estadoSalvo.minuta,
  };

  // Mensagem do servidor
  const msgServidor = {
    id: Math.random().toString(36).slice(2, 10),
    papel: "servidor", tipo: "texto" as const,
    conteudo: texto, criadaEm: new Date().toISOString(),
  };

  const { mensagens, estado: novoEstado } = await responder(texto, estado, memorias);

  const todas = [...(conversa.mensagens || []), msgServidor, ...mensagens];
  await db.update(conversasChat)
    .set({
      mensagens: todas,
      etapaAtual: novoEstado.etapa,
      statusDocumentos: novoEstado as any,
      titulo: novoEstado.objeto ? novoEstado.objeto.slice(0, 60) : conversa.titulo,
      updatedAt: new Date(),
    })
    .where(eq(conversasChat.id, conversaId));

  return { mensagens, estado: novoEstado };
}

/** Cria um processo a partir da conversa (quando o servidor confirma). */
export async function criarProcessoDaConversa(conversaId: string, tipoProcessoId: string) {
  const { orgaoId, userId } = await sessao();
  const [conversa] = await db.select().from(conversasChat).where(eq(conversasChat.id, conversaId)).limit(1);
  if (!conversa) throw new Error("Conversa não encontrada");

  const objeto = (conversa.mensagens || []).find((m: any) => m.papel === "servidor" && m.tipo === "texto")?.conteudo || "Contratação";
  // Cria o processo e vincula o tipo via iniciarProcessoPorIntencao (jornada guiada)
  const { iniciarProcessoPorIntencao } = await import("@/lib/intencao");
  const processo = await iniciarProcessoPorIntencao({
    orgaoId,
    usuarioId: userId,
    textoIntencao: objeto.slice(0, 500),
    tipoProcessoId,
    objeto: objeto.slice(0, 500),
  });

  await db.update(conversasChat)
    .set({ processoId: processo.processo.id, updatedAt: new Date() })
    .where(eq(conversasChat.id, conversaId));

  return processo;
}
