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
import { tiposProcesso, tarefas, historicoProcesso, minutas, alertas, processos, julgadosProcesso, modelosDocumento } from "@/lib/db/schema";
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

/** 18. Busca julgados (TCU + TCE-RO) pelo objeto do processo. */
export async function buscarJulgadosDoProcesso(processoId: string) {
  await sessaoContexto();
  const { buscarJulgadosMulti } = await import("@/lib/julgados");
  const [proc] = await db.select({ objeto: processos.objeto }).from(processos).where(eq(processos.id, processoId)).limit(1);
  if (!proc) throw new Error("Processo não encontrado");
  return buscarJulgadosMulti(proc.objeto);
}

/** 19. Adiciona um julgado ao processo (link guardado como parâmetro de apoio). */
export async function adicionarJulgado(processoId: string, j: {
  tribunal: string; numero: string; relator?: string; orgaoJulgador?: string;
  ementa?: string; link: string; assunto?: string;
}) {
  const { orgaoId } = await sessaoContexto();
  const [linha] = await db.insert(julgadosProcesso).values({
    orgaoId, processoId,
    tribunal: j.tribunal,
    numero: j.numero?.slice(0, 60),
    relator: j.relator?.slice(0, 255),
    orgaoJulgador: j.orgaoJulgador?.slice(0, 120),
    ementa: j.ementa,
    link: j.link,
    assunto: j.assunto?.slice(0, 255),
  }).returning();
  return linha;
}

/** 20. Lista julgados vinculados ao processo. */
export async function listarJulgados(processoId: string) {
  await sessaoContexto();
  return db.select().from(julgadosProcesso).where(eq(julgadosProcesso.processoId, processoId)).orderBy(desc(julgadosProcesso.createdAt));
}

/** 21. Marca/desmarca julgado como usado na justificativa. */
export async function alternarJulgadoUsado(julgadoId: string, usado: boolean) {
  await sessaoContexto();
  await db.update(julgadosProcesso).set({ usado }).where(eq(julgadosProcesso.id, julgadoId));
  return { ok: true };
}

/** 22. Remove julgado do processo. */
export async function removerJulgado(julgadoId: string) {
  await sessaoContexto();
  await db.delete(julgadosProcesso).where(eq(julgadosProcesso.id, julgadoId));
  return { ok: true };
}

/** 23. Lista modelos de documentos (AGU etc.) disponíveis. */
export async function listarModelosDocumento() {
  await sessaoContexto();
  return db.select().from(modelosDocumento).where(eq(modelosDocumento.ativo, true)).orderBy(modelosDocumento.categoria, modelosDocumento.nome);
}

/** 24. Auto-preenche um modelo com dados do processo + julgados marcados como usados. */
export async function preencherModeloDocumento(processoId: string, modeloId: string) {
  const { orgaoId } = await sessaoContexto();
  const { sugerirDotacao } = await import("@/lib/dotacao");

  const [proc] = await db.select().from(processos).where(eq(processos.id, processoId)).limit(1);
  if (!proc) throw new Error("Processo não encontrado");
  const [modelo] = await db.select().from(modelosDocumento).where(eq(modelosDocumento.id, modeloId)).limit(1);
  if (!modelo) throw new Error("Modelo não encontrado");

  const julgados = await db.select().from(julgadosProcesso).where(and(eq(julgadosProcesso.processoId, processoId), eq(julgadosProcesso.usado, true)));
  const dotacao = sugerirDotacao(proc.objeto)[0]?.classificacao || "—";

  const txt = (s: string) => s || "—";
  const dataHoje = new Date().toLocaleDateString("pt-BR");
  const julgadosTxt = julgados.length
    ? julgados.map((j) => `  • ${j.tribunal === "tcu" ? "TCU" : "TCE-RO"} — Acórdão ${j.numero} (${j.relator || "—"})\n    ${j.link}`).join("\n")
    : "  (nenhum julgado marcado como usado — adicione na seção Julgados)";

  const substituicoes: Record<string, string> = {
    "{{objeto}}": txt(proc.objeto),
    "{{numeroProcesso}}": txt(proc.numero || ""),
    "{{orgao}}": "Órgão solicitante",
    "{{unidade}}": "—",
    "{{dotacao}}": dotacao,
    "{{modalidade}}": "Pregão Eletrônico",
    "{{justificativa}}": `A presente contratação visa atender à necessidade de ${txt(proc.objeto).toLowerCase()}, conforme demanda da unidade, estando em conformidade com a Lei nº 14.133/2021 e com os princípios da legalidade, impessoalidade, moralidade, publicidade e eficiência.`,
    "{{julgados}}": julgadosTxt,
    "{{data}}": dataHoje,
    "{{responsavel}}": "Servidor responsável",
  };

  let conteudo = modelo.conteudoTemplate;
  for (const [k, v] of Object.entries(substituicoes)) {
    conteudo = conteudo.split(k).join(v);
  }

  return { ...modelo, conteudoPreenchido: conteudo, julgadosUsados: julgados.length };
}
