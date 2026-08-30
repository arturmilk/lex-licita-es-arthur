"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  detectarIntencao,
  iniciarProcessoPorIntencao,
  jornadaDoTipo,
  painelServidor,
  gerarAlertas,
  buscaInteligente,
  consultarNormas,
  painelGestor,
} from "@/lib/intencao";
import { tiposProcesso, tarefas, historicoProcesso, minutas, alertas, processos } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

/** Sessão autenticada com orgaoId. */
async function sessaoContexto() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const user = session.user as any;
  if (!user.orgaoId) throw new Error("Usuário sem órgão vinculado");
  return { userId: user.id as string, orgaoId: user.orgaoId as string, nome: user.nome as string };
}

/** 1. O que você precisa fazer? → detecta a intenção e sugere tipos. */
export async function entenderIntencao(texto: string) {
  const { orgaoId } = await sessaoContexto();
  const sugestoes = await detectarIntencao(texto);
  const tipos = await db.select().from(tiposProcesso).where(eq(tiposProcesso.ativo, true));
  return { sugestoes, tipos };
}

/** 2. Confirma o tipo e cria o processo + jornada guiada. */
export async function criarProcessoPorIntencao(texto: string, tipoProcessoId: string) {
  const { userId, orgaoId } = await sessaoContexto();
  const result = await iniciarProcessoPorIntencao({
    orgaoId,
    usuarioId: userId,
    textoIntencao: texto,
    tipoProcessoId,
  });
  revalidatePath("/painel");
  revalidatePath("/");
  return result;
}

/** 3. Jornada guiada: etapas do processo com checklists. */
export async function obterJornada(tipoProcessoId: string) {
  return jornadaDoTipo(tipoProcessoId);
}

/** 4. Tarefas do processo + etapa atual. */
export async function obterTarefasDoProcesso(processoId: string) {
  const rows = await db
    .select()
    .from(tarefas)
    .where(eq(tarefas.processoId, processoId))
    .orderBy(tarefas.createdAt);
  return rows;
}

/** 5. Avançar etapa (com validação de documentos/assinaturas pendentes). */
export async function avancarEtapa(tarefaId: string, docsAnexados: string[], assinado: boolean) {
  const { userId } = await sessaoContexto();

  const [tarefa] = await db.select().from(tarefas).where(eq(tarefas.id, tarefaId)).limit(1);
  if (!tarefa) throw new Error("Tarefa não encontrada");

  // Busca os documentos necessários da etapa correspondente
  const { etapasProcesso } = await import("@/lib/db/schema");
  const etapa = tarefa.etapa
    ? (await db.select().from(etapasProcesso).where(eq(etapasProcesso.titulo, tarefa.etapa)).limit(1))[0]
    : null;

  const pendentes: string[] = [];
  if (etapa?.documentosNecessarios?.length) {
    for (const doc of etapa.documentosNecessarios) {
      if (!docsAnexados.includes(doc)) pendentes.push(doc);
    }
  }
  if (etapa?.validacoes?.some((v: any) => v.tipo === "assinatura") && !assinado) {
    pendentes.push("Assinatura obrigatória");
  }

  if (pendentes.length > 0) {
    return { ok: false, pendentes, mensagem: `Validação: faltam ${pendentes.length} item(ns) antes de avançar.` };
  }

  // Avança: conclui esta tarefa e ativa a próxima
  await db.update(tarefas).set({ status: "concluida", concluidaEm: new Date() }).where(eq(tarefas.id, tarefaId));

  const proxima = await db
    .select()
    .from(tarefas)
    .where(and(eq(tarefas.processoId, tarefa.processoId!), eq(tarefas.status, "pendente")))
    .orderBy(tarefas.createdAt)
    .limit(1);
  if (proxima[0]) {
    await db.update(tarefas).set({ status: "em_andamento" }).where(eq(tarefas.id, proxima[0].id));
  }

  await db.insert(historicoProcesso).values({
    processoId: tarefa.processoId!,
    usuarioId: userId,
    acao: "etapa_concluida",
    descricao: `Etapa concluída: ${tarefa.titulo}`,
    etapa: tarefa.etapa ?? undefined,
  });

  revalidatePath("/painel");
  return { ok: true, mensagem: `Etapa "${tarefa.titulo}" concluída.${proxima[0] ? ` Próxima: ${proxima[0].titulo}.` : " Processo finalizado!"}` };
}

/** 6. Histórico completo do processo. */
export async function obterHistorico(processoId: string) {
  const { orgaoId } = await sessaoContexto();
  const { usuarios } = await import("@/lib/db/schema");
  const rows = await db
    .select({ h: historicoProcesso, usuarioNome: usuarios.nome })
    .from(historicoProcesso)
    .leftJoin(usuarios, eq(historicoProcesso.usuarioId, usuarios.id))
    .where(eq(historicoProcesso.processoId, processoId))
    .orderBy(desc(historicoProcesso.createdAt));
  return rows.map((r) => ({ ...r.h, usuarioNome: r.usuarioNome }));
}

/** 7. Painel do servidor. */
export async function obterPainelServidor() {
  const { userId, orgaoId } = await sessaoContexto();
  const painel = await painelServidor(userId, orgaoId);
  const alertasNaoLidos = await db.select().from(alertas).where(and(eq(alertas.orgaoId, orgaoId), eq(alertas.lido, false))).orderBy(desc(alertas.createdAt)).limit(20);
  await gerarAlertas(orgaoId);
  return { ...painel, alertas: alertasNaoLidos };
}

/** 8. Marcar alerta como lido. */
export async function marcarAlertaLido(alertaId: string) {
  await db.update(alertas).set({ lido: true }).where(eq(alertas.id, alertaId));
  return { ok: true };
}

/** 9. Busca inteligente por linguagem natural. */
export async function buscarTudo(consulta: string) {
  const { orgaoId } = await sessaoContexto();
  return buscaInteligente(orgaoId, consulta);
}

/** 10. Consulta de normas/legislação. */
export async function consultarLegislacao(pergunta: string) {
  const { orgaoId } = await sessaoContexto();
  return consultarNormas(orgaoId, pergunta);
}

/** 11. Minuta: gera documento administrativo (despacho/parecer/ofício) para o processo. */
export async function gerarMinuta(opts: { processoId: string; tipo: string; titulo?: string; contexto?: string }) {
  const { userId, orgaoId, nome } = await sessaoContexto();

  const [processo] = await db
    .select({ id: processos.id, numero: processos.numero, objeto: processos.objeto })
    .from(processos)
    .where(eq(processos.id, opts.processoId))
    .limit(1);

  const contexto = opts.contexto || "";
  const tipo = opts.tipo;

  // Monta a minuta com base no tipo (minuta determinística + dados do processo)
  let conteudo = "";
  const hoje = new Date().toLocaleDateString("pt-BR");
  const numero = processo?.numero ?? "—";
  const objeto = processo?.objeto ?? "—";

  if (tipo === "despacho") {
    conteudo = `DESPACHO\n\nProcesso: ${numero}\n\nNos termos do art. 53 da Lei nº 14.133/2021, encaminhe-se o presente processo para as providências cabíveis, considerando o objeto: ${objeto}.\n\n${contexto ? `\n${contexto}\n` : ""}\n\n${nome}\n${hoje}`;
  } else if (tipo === "parecer") {
    conteudo = `PARECER TÉCNICO\n\nProcesso: ${numero}\n\nI — RELATÓRIO: ${objeto}\n\nII — ANÁLISE: ${contexto || "Análise em elaboração."}\n\nIII — CONCLUSÃO: opinamos pelo prosseguimento do feito, observadas as formalidades legais.\n\n${nome}\n${hoje}`;
  } else if (tipo === "memorando") {
    conteudo = `MEMORANDO Nº ${Math.floor(1000 + Math.random() * 9000)}/${new Date().getFullYear()}\n\nProcesso: ${numero}\n\n${contexto || `Comunicamos sobre o processo relativo a: ${objeto}.`}\n\nAtenciosamente,\n${nome}\n${hoje}`;
  } else if (tipo === "oficio") {
    conteudo = `OFÍCIO\n\nProcesso: ${numero}\n\n${contexto || `Trata-se do processo referente a: ${objeto}.`}\n\nAtenciosamente,\n${nome}\n${hoje}`;
  } else if (tipo === "justificativa") {
    conteudo = `JUSTIFICATIVA\n\nProcesso: ${numero}\n\n${contexto || `Justificativa relativa ao processo: ${objeto}.`}\n\n${nome}\n${hoje}`;
  } else {
    conteudo = `RELATÓRIO\n\nProcesso: ${numero}\n\n${contexto || objeto}\n\n${nome}\n${hoje}`;
  }

  const [minuta] = await db
    .insert(minutas)
    .values({
      orgaoId,
      processoId: opts.processoId,
      usuarioId: userId,
      tipo,
      titulo: opts.titulo || `${tipo} — ${numero}`,
      conteudo,
      status: "rascunho",
    })
    .returning();

  await db.insert(historicoProcesso).values({
    processoId: opts.processoId,
    usuarioId: userId,
    acao: "minuta_gerada",
    descricao: `Minuta de ${tipo} gerada`,
  });

  return minuta;
}

/** 12. Lista minutas de um processo. */
export async function listarMinutas(processoId: string) {
  return db.select().from(minutas).where(eq(minutas.processoId, processoId)).orderBy(desc(minutas.createdAt));
}

/** 13. Painel do gestor. */
export async function obterPainelGestor() {
  const { orgaoId } = await sessaoContexto();
  return painelGestor(orgaoId);
}

/** 14. Escrita assistida por IA: transforma um pedido em minuta administrativa. */
export async function escreverComIA(opts: { tipo: string; pedido: string; processoId?: string }) {
  const { userId, orgaoId, nome } = await sessaoContexto();
  const { escreverDocumento } = await import("@/lib/ia");

  let numero = "";
  let objeto = "";
  if (opts.processoId) {
    const [proc] = await db.select().from(processos).where(eq(processos.id, opts.processoId)).limit(1);
    numero = proc?.numero ?? "";
    objeto = proc?.objeto ?? "";
  }

  const conteudo = await escreverDocumento({
    tipo: opts.tipo,
    pedido: opts.pedido,
    contexto: { numeroProcesso: numero, objeto, servidor: nome, data: new Date().toLocaleDateString("pt-BR") },
  });

  const [minuta] = await db
    .insert(minutas)
    .values({
      orgaoId,
      processoId: opts.processoId ?? null,
      usuarioId: userId,
      tipo: opts.tipo,
      titulo: `${opts.tipo} — ${numero || "sem processo"}`,
      conteudo,
      status: "rascunho",
    })
    .returning();

  if (opts.processoId) {
    await db.insert(historicoProcesso).values({
      processoId: opts.processoId,
      usuarioId: userId,
      acao: "minuta_ia",
      descricao: `Minuta de ${opts.tipo} gerada por IA: "${opts.pedido.slice(0, 80)}"`,
    });
  }

  return minuta;
}

/** 15. Assistente contextual "Me ajuda". */
export async function meAjudaIA(opts: { pergunta: string; contextoPagina: string; dadosAdicionais?: string }) {
  const { meAjuda } = await import("@/lib/ia");
  return meAjuda(opts);
}

/** 16. Sugere dotação orçamentária com base no objeto do processo. */
export async function sugerirDotacaoOrcamentaria(processoId: string) {
  const { orgaoId } = await sessaoContexto();
  const { sugerirDotacao } = await import("@/lib/dotacao");

  const [proc] = await db.select({ objeto: processos.objeto }).from(processos).where(eq(processos.id, processoId)).limit(1);
  if (!proc) throw new Error("Processo não encontrado");
  return sugerirDotacao(proc.objeto);
}

/** 17. Sugere dotação com base em texto livre (sem processo). */
export async function sugerirDotacaoPorTexto(texto: string) {
  await sessaoContexto();
  const { sugerirDotacao } = await import("@/lib/dotacao");
  return sugerirDotacao(texto);
}
