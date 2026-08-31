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

/**
 * AGENTE HISTORIADOR: analisa o histórico de contratações do órgão
 * (processos + conversas) e devolve padrões que ANTECIPAM o trabalho:
 * objetos mais recorrentes, documentos que sempre faltam, valores típicos,
 * e sugestões de auto-preenchimento para a próxima contratação.
 */
export async function historiarPadroesOrgao() {
  const { orgaoId } = await sessao();
  const [procs, conversas, memorias] = await Promise.all([
    db.select({ objeto: processos.objeto, createdAt: processos.createdAt, status: processos.status })
      .from(processos).where(eq(processos.orgaoId, orgaoId)).orderBy(processos.createdAt).limit(50),
    db.select({ titulo: conversasChat.titulo, etapaAtual: conversasChat.etapaAtual, statusDocumentos: conversasChat.statusDocumentos })
      .from(conversasChat).where(eq(conversasChat.orgaoId, orgaoId)).limit(50),
    db.select().from(memoriaOrgao).where(eq(memoriaOrgao.orgaoId, orgaoId)),
  ]);

  const padroes = {
    totalProcessos: procs.length,
    totalConversas: conversas.length,
    objetosRecorrentes: [] as { objeto: string; vezes: number }[],
    documentosFaltantes: [] as { doc: string; vezes: number }[],
    fontesPreferidas: [] as { fonte: string; vezes: number }[],
    ultimoObjeto: procs.length > 0 ? procs[procs.length - 1].objeto : null,
  };

  // Objetos recorrentes (por prefixo de 30 chars)
  const contagemObjetos: Record<string, number> = {};
  for (const p of procs) {
    const chave = (p.objeto || "").slice(0, 30).toLowerCase();
    if (chave.length > 5) contagemObjetos[chave] = (contagemObjetos[chave] || 0) + 1;
  }
  padroes.objetosRecorrentes = Object.entries(contagemObjetos)
    .map(([objeto, vezes]) => ({ objeto, vezes }))
    .sort((a, b) => b.vezes - a.vezes).slice(0, 5);

  // Documentos que sempre faltam (das conversas — status "falta")
  const contagemDocs: Record<string, number> = {};
  for (const c of conversas) {
    const docs = (c.statusDocumentos as any)?.documentos || {};
    for (const [chave, v] of Object.entries(docs)) {
      if ((v as any)?.status === "falta") contagemDocs[chave] = (contagemDocs[chave] || 0) + 1;
    }
  }
  padroes.documentosFaltantes = Object.entries(contagemDocs)
    .map(([doc, vezes]) => ({ doc, vezes }))
    .sort((a, b) => b.vezes - a.vezes).slice(0, 5);

  // Fontes de preço preferidas (memória)
  const contagemFontes: Record<string, number> = {};
  for (const m of memorias) {
    if (m.chave === "fonte_preco") contagemFontes[m.valor] = (contagemFontes[m.valor] || 0) + 1;
  }
  padroes.fontesPreferidas = Object.entries(contagemFontes)
    .map(([fonte, vezes]) => ({ fonte, vezes }))
    .sort((a, b) => b.vezes - a.vezes).slice(0, 5);

  return padroes;
}

/**
 * AGENTE HISTORIADOR (IA): a partir dos padrões estatísticos + memórias,
 * escreve um briefing de auto-preenchimento para a próxima contratação.
 */
export async function briefingHistoriador() {
  const padroes = await historiarPadroesOrgao();
  const memorias = await lerMemoriaOrgao();

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || padroes.totalProcessos + padroes.totalConversas === 0) {
    return {
      padroes,
      briefing: null,
      memorias,
    };
  }

  const system = `Você é o AGENTE HISTORIADOR de um sistema de licitações públicas (Lei 14.133/2021).

Com base nos padrões históricos do órgão abaixo, escreva um BRIEFING curto (máximo 200 palavras) para ANTECIPAR o trabalho do servidor na próxima contratação:
1. O que este órgão costuma contratar (objetos recorrentes).
2. Quais documentos SEMPRE faltam — avise para já vir preparado.
3. Qual fonte de preço ele prefere.
4. Uma sugestão prática de auto-preenchimento.
Responda em português claro, sem emojis, em bullets curtos.`;

  const user = `Padrões do órgão:
- Processos registrados: ${padroes.totalProcessos}
- Objetos recorrentes: ${padroes.objetosRecorrentes.map(o => `${o.objeto} (${o.vezes}x)`).join(", ") || "nenhum repetido"}
- Documentos que mais faltam: ${padroes.documentosFaltantes.map(d => `${d.doc} (${d.vezes}x)`).join(", ") || "nenhum"}
- Fontes preferidas: ${padroes.fontesPreferidas.map(f => `${f.fonte} (${f.vezes}x)`).join(", ") || "nenhuma registrada"}
- Memórias atuais: ${Object.entries(memorias).map(([k, v]) => `${k}=${v}`).join("; ") || "nenhuma"}`;

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(40_000),
    });
    const data = await res.json().catch(() => null);
    const briefing = data?.choices?.[0]?.message?.content || null;
    return { padroes, briefing, memorias };
  } catch {
    return { padroes, briefing: null, memorias };
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
    documentosGerados: estadoSalvo.documentosGerados,  // Redator encadeado (PC→ETP)
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
