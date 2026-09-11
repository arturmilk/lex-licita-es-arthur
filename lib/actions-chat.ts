"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { conversasChat, memoriaOrgao, processos, baseConhecimento } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { estadoInicial, responder, mensagemAbertura, type EstadoChat } from "@/lib/chat";

async function sessao() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const user = session.user as any;
  return { userId: user.id as string, orgaoId: user.orgaoId as string, nome: user.nome as string };
}

/**
 * Procura processos anteriores com objeto semanticamente próximo usando os
 * termos do próprio objeto. É uma memória de apoio: serve para antecipar
 * perguntas, nunca para copiar decisões da contratação anterior.
 */
async function buscarHistoricoSemelhante(orgaoId: string, referencia: string) {
  const stop = new Set(["para", "como", "uma", "uns", "umas", "com", "sem", "que", "dos", "das", "por", "pelo", "pela", "preciso", "quero"]);
  const termos = (v: string) => new Set(
    (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").split(/\s+/)
      .filter(x => x.length >= 4 && !stop.has(x))
  );
  const base = termos(referencia);
  if (base.size === 0) return [] as { numero: string; objeto: string; status: string; score: number }[];

  const rows = await db.select({ numero: processos.numero, objeto: processos.objeto, status: processos.status })
    .from(processos).where(eq(processos.orgaoId, orgaoId)).limit(80);

  return rows.map(r => {
    const alvo = termos(r.objeto || "");
    const comuns = Array.from(base).filter(t => alvo.has(t)).length;
    const score = comuns / Math.max(1, Math.min(base.size, alvo.size || 1));
    return { numero: r.numero, objeto: r.objeto, status: String(r.status), score };
  })
    .filter(r => r.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
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
export async function novaConversaChat(modo?: string) {
  const { orgaoId, userId } = await sessao();
  const memorias = await lerMemoriaOrgao();
  const abertura = mensagemAbertura(Object.keys(memorias).length > 0, memorias, modo);
  const [conversa] = await db.insert(conversasChat).values({
    orgaoId, usuarioId: userId,
    mensagens: [abertura],
    statusDocumentos: modo ? { modoSolicitado: modo, modoIndice: 0, modoRespostas: {} } : {},
    etapaAtual: modo ? "modo_guiado" : "intencao",
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
    descoberta: estadoSalvo.descoberta,
    documentoAtual: estadoSalvo.documentoAtual,
    documentos: estadoSalvo.documentos || {},
    perguntaAtual: estadoSalvo.perguntaAtual,
    docColeta: estadoSalvo.docColeta,   // coleta guiada (PC/ETP campo a campo)
    catmat: estadoSalvo.catmat,
    minuta: estadoSalvo.minuta,
    documentosGerados: estadoSalvo.documentosGerados,  // Redator encadeado (PC→ETP)
    modoSolicitado: estadoSalvo.modoSolicitado,
    modoIndice: estadoSalvo.modoIndice,
    modoRespostas: estadoSalvo.modoRespostas || {},
  };

  // Memória contextual: procura contratações anteriores parecidas enquanto
  // ainda estamos entendendo o objeto. O LEX usa como referência, não como regra.
  if (estado.etapa === "intencao" || estado.etapa === "descoberta") {
    try {
      const similares = await buscarHistoricoSemelhante(orgaoId, estado.objeto || texto);
      if (similares.length) {
        memorias.historico_qtd = String(similares.length);
        memorias.historico_semelhante = similares
          .map(s => `${s.numero}: ${s.objeto.slice(0, 180)} [${s.status}]`)
          .join(" | ");
      }
    } catch { /* histórico nunca bloqueia o atendimento */ }
  }

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


/**
 * Melhora UMA seção de um documento com base na documentação interna do LEX
 * e, quando pertinente, em referências reais de controle. Nunca inventa fatos do órgão.
 */
export async function melhorarTrechoDocumento(
  conversaId: string,
  trecho: string,
  complemento = "",
  tituloSecao = "Seção do documento",
  tipoDocumento = "documento",
) {
  const { orgaoId } = await sessao();
  const [conversa] = await db.select().from(conversasChat)
    .where(and(eq(conversasChat.id, conversaId), eq(conversasChat.orgaoId, orgaoId))).limit(1);
  if (!conversa) throw new Error("Conversa não encontrada");
  if (!trecho?.trim()) throw new Error("Trecho vazio");

  const estado = (conversa.statusDocumentos as any) || {};
  const consulta = `${tituloSecao} ${trecho} ${complemento}`.slice(0, 5000);
  const stop = new Set(["para", "como", "uma", "com", "sem", "que", "dos", "das", "por", "pela", "pelo", "este", "esta", "isso", "documento", "seção", "secao"]);
  const toks = (v: string) => new Set(
    (v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, " ").split(/\s+/)
      .filter(x => x.length >= 4 && !stop.has(x))
  );
  const q = toks(consulta);

  let guiaEtp = "";
  if (tipoDocumento === "etp") {
    try {
      const { CAMPOS_ETP } = await import("@/lib/etp-model");
      const alvo = toks(tituloSecao);
      const relacionados = CAMPOS_ETP.map(c => {
        const ct = toks(`${c.titulo} ${c.chave}`);
        const score = Array.from(alvo).filter(t => ct.has(t)).length;
        return { c, score };
      }).sort((a,b)=>b.score-a.score).filter(x=>x.score>0).slice(0,3).map(x=>x.c);
      const nl = String.fromCharCode(10);
      guiaEtp = relacionados.length
        ? relacionados.map(c => `- ${c.titulo}: ${c.explicacao} | Fundamento: ${c.fundamento} | ${c.obrigatorio ? "elemento mínimo obrigatório" : "avaliar e justificar se não aplicável"}`).join(nl)
        : CAMPOS_ETP.map(c => `- ${c.titulo}: ${c.fundamento}`).join(nl);
    } catch { guiaEtp = ""; }
  }

  // Base institucional: normas, procedimentos, modelos e regras internas.
  const rows = await db.select().from(baseConhecimento).limit(120);
  const disponiveis = rows.filter((r: any) => !r.orgaoId || r.orgaoId === orgaoId);
  const docs = disponiveis.map((r: any) => {
    const alvo = toks(`${r.titulo} ${r.conteudo} ${(r.tags || []).join(" ")}`);
    const comuns = Array.from(q).filter(t => alvo.has(t)).length;
    let bonus = 0;
    if (/pre[cç]o|estimativa|valor|catmat|catser/i.test(consulta) && /art\.?.?\s*23|pesquisa de pre[cç]os|valor estimado/i.test(`${r.titulo} ${r.conteudo}`)) bonus += 5;
    if (/planejamento|pca|necessidade|dfd|formaliza/i.test(consulta) && /planejamento|demanda|contrata/i.test(`${r.titulo} ${r.conteudo}`)) bonus += 3;
    return { r, score: comuns + bonus };
  }).sort((a, b) => b.score - a.score).filter(x => x.score > 0).slice(0, 6);

  let julgados: any[] = [];
  if (/justific|planejamento|necessidade|pre[cç]o|estimativa|pesquisa|risco|economic/i.test(consulta)) {
    try {
      const { buscarTCU } = await import("@/lib/julgados");
      const termo = /pre[cç]o|estimativa|pesquisa/i.test(consulta)
        ? "pesquisa de preços planejamento contratação"
        : "planejamento contratação necessidade justificativa";
      julgados = await buscarTCU(termo, 3);
    } catch { julgados = []; }
  }

  const fontesInternas = docs.map(({ r }: any) => ({ titulo: r.titulo, fonte: r.fonte || "Base LEX", conteudo: String(r.conteudo || "").slice(0, 2500) }));
  const fontesControle = julgados.map((j: any) => ({ titulo: `TCU ${j.numero}`, fonte: "TCU", conteudo: j.ementa, link: j.link }));

  const { chat } = await import("@/lib/ia");
  const texto = await chat([
    {
      role: "system",
      content: `Você é o Editor Técnico do LEX Licitações, especializado em documentos da fase preparatória da Lei 14.133/2021.

Sua tarefa é melhorar SOMENTE a seção recebida, mantendo o sentido e todos os dados factuais já existentes.

REGRAS OBRIGATÓRIAS:
- Incorpore o complemento do servidor de forma natural e profissional.
- Use a documentação fornecida apenas quando for realmente pertinente.
- Preserve números, CATMAT/CATSER, valores, quantidades, datas, nomes, prazos e fatos; não altere dados por conta própria.
- NUNCA invente que a contratação está no PCA, que existe estoque insuficiente, consumo histórico, urgência, demanda reprimida, laudo, contrato anterior ou qualquer outro fato interno se isso não estiver no contexto.
- Se o complemento pede demonstrar necessidade, desenvolva causalidade: situação atual → problema → impacto → resultado esperado → pertinência da solução, usando apenas fatos disponíveis.
- Se houver lacuna essencial, mantenha [A DEFINIR] ou [A CONFIRMAR] em vez de preencher com ficção.
- Quando usar uma norma ou acórdão, mencione a fonte com precisão e apenas para sustentar a regra/princípio correspondente; acórdão não prova fato interno do órgão.
- Escreva texto administrativo substancial, claro e defensável. Não use elogios, marketing ou frases vazias.
- Retorne APENAS a seção revisada, inteira, sem comentários antes ou depois.`
    },
    {
      role: "user",
      content: `SEÇÃO: ${tituloSecao}

TEXTO ATUAL:
${trecho.slice(0, 12000)}

COMPLEMENTO DO SERVIDOR:
${complemento?.trim() || "Nenhum complemento adicional; apenas melhorar tecnicamente sem criar fatos."}

CONTEXTO DA CONTRATAÇÃO SALVO NO CHAT:
Objeto: ${estado.objeto || "não informado"}
UG: ${estado.ug || "não informada"}
Dados: ${JSON.stringify({ descoberta: estado.descoberta, documentosGerados: estado.documentosGerados }).slice(0, 8000)}

MODELO NORMATIVO DO ETP PARA ESTA SEÇÃO:
${tipoDocumento === "etp" ? (guiaEtp || "Aplicar a IN SEGES 58/2022 e preservar lacunas factuais.") : "Não se aplica."}

DOCUMENTAÇÃO INTERNA DISPONÍVEL:
${fontesInternas.length ? fontesInternas.map((f: any) => `- ${f.titulo} (${f.fonte}): ${f.conteudo}`).join("\n") : "Nenhuma referência específica encontrada."}

REFERÊNCIAS DE CONTROLE DISPONÍVEIS:
${fontesControle.length ? fontesControle.map((f: any) => `- ${f.titulo}: ${f.conteudo} ${f.link || ""}`).join("\n") : "Nenhuma referência externa usada."}`
    },
  ], 0.2, 2600);

  return {
    texto,
    fontes: [
      ...fontesInternas.map((f: any) => ({ titulo: f.titulo, fonte: f.fonte })),
      ...fontesControle.map((f: any) => ({ titulo: f.titulo, fonte: f.fonte, link: f.link })),
    ],
  };
}

/** Persiste uma versão editada do documento dentro da conversa. */
export async function salvarDocumentoEditado(conversaId: string, texto: string, titulo = "Documento editado") {
  const { orgaoId } = await sessao();
  const [conversa] = await db.select().from(conversasChat)
    .where(and(eq(conversasChat.id, conversaId), eq(conversasChat.orgaoId, orgaoId))).limit(1);
  if (!conversa) throw new Error("Conversa não encontrada");
  if (!texto?.trim()) throw new Error("Documento vazio");

  const mensagem = {
    id: Math.random().toString(36).slice(2, 10),
    papel: "sistema" as const,
    tipo: "documento" as const,
    conteudo: `**${titulo}**\n\n${texto}`,
    completo: texto,
    criadaEm: new Date().toISOString(),
  };
  const mensagens = [...(conversa.mensagens || []), mensagem] as any;
  await db.update(conversasChat)
    .set({ mensagens, updatedAt: new Date() })
    .where(eq(conversasChat.id, conversaId));
  return mensagem;
}
