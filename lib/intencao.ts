import { db } from "./db";
import { tiposProcesso, etapasProcesso, tarefas, alertas, historicoProcesso, processos, baseConhecimento, usuarios, orgaos } from "./db/schema";
import { eq, and, desc, ilike, or, isNotNull } from "drizzle-orm";

/**
 * Núcleo do sistema orientado à intenção.
 *
 * A premissa: "O servidor não precisa aprender o sistema. O sistema precisa
 * aprender como o servidor trabalha."
 *
 * Em vez de navegar por menus, o servidor diz o que PRECISA FAZER em linguagem
 * natural e o sistema: identifica o procedimento → monta a jornada → conduz
 * etapa por etapa → valida antes de avançar.
 */

export interface IntencaoDetectada {
  tipoProcessoId: string;
  nomeTipo: string;
  confianca: number;
  palavrasChave: string[];
}

const PALAVRAS_CHAVE: Record<string, string[]> = {
  "Contratação de bens": ["contratar", "aquisição", "compra", "adquirir", "comprar", "bens", "material", "equipamento", "fornecimento", "ar-condicionado", "papel", "cadeira", "computador"],
  "Dispensa de licitação (baixo valor)": ["dispensa", "cotação", "baixo valor", "urgente", "direta", "r$ 50", "50 mil"],
  "Diárias e passagens": ["diária", "diárias", "passagem", "viagem", "deslocamento", "missão", "transporte"],
  "Licença e afastamento do servidor": ["licença", "afastamento", "férias", "maternidade", "paternidade", "saúde", "capacitação", "tratamento"],
};

/**
 * Detecta o tipo de processo a partir da intenção em linguagem natural.
 * Faz scoring por palavras-chave (determinístico, rápido) — sem chamada de IA.
 */
export async function detectarIntencao(texto: string): Promise<IntencaoDetectada[]> {
  const t = (texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const tipos = await db.select().from(tiposProcesso).where(eq(tiposProcesso.ativo, true));

  const resultados: IntencaoDetectada[] = [];
  for (const tipo of tipos) {
    const chaves = PALAVRAS_CHAVE[tipo.nome] ?? [];
    const encontradas = chaves.filter((k) => t.includes(k));
    if (encontradas.length > 0) {
      resultados.push({
        tipoProcessoId: tipo.id,
        nomeTipo: tipo.nome,
        confianca: Math.min(0.95, 0.45 + encontradas.length * 0.12),
        palavrasChave: encontradas,
      });
    }
  }
  // Fallback: se nada bater, sugere contratação como padrão
  if (resultados.length === 0 && tipos.length > 0) {
    resultados.push({
      tipoProcessoId: tipos[0].id,
      nomeTipo: tipos[0].nome,
      confianca: 0.3,
      palavrasChave: [],
    });
  }
  return resultados.sort((a, b) => b.confianca - a.confianca);
}

/** Retorna a jornada completa (etapas guiadas) de um tipo de processo. */
export async function jornadaDoTipo(tipoProcessoId: string) {
  const etapas = await db
    .select()
    .from(etapasProcesso)
    .where(eq(etapasProcesso.tipoProcessoId, tipoProcessoId))
    .orderBy(etapasProcesso.ordem);
  return etapas;
}

/**
 * Inicia um processo a partir de uma intenção:
 * cria o processo, as tarefas de todas as etapas e registra no histórico.
 */
export async function iniciarProcessoPorIntencao(opts: {
  orgaoId: string;
  usuarioId: string;
  textoIntencao: string;
  tipoProcessoId: string;
  numero?: string;
  objeto?: string;
}) {
  const { orgaoId, usuarioId, textoIntencao, tipoProcessoId } = opts;

  const [tipo] = await db.select().from(tiposProcesso).where(eq(tiposProcesso.id, tipoProcessoId)).limit(1);
  if (!tipo) throw new Error("Tipo de processo não encontrado.");

  const numero = opts.numero || `PROC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const objeto = opts.objeto || textoIntencao.slice(0, 200);

  // Cria o processo
  const [processo] = await db
    .insert(processos)
    .values({ numero, objeto, orgaoId, usuarioId, status: "rascunho" })
    .returning();

  // Cria as tarefas guiadas (uma por etapa)
  const etapas = await jornadaDoTipo(tipoProcessoId);
  for (const etapa of etapas) {
    await db.insert(tarefas).values({
      orgaoId,
      processoId: processo.id,
      tipoProcessoId,
      responsavelId: usuarioId,
      titulo: etapa.titulo,
      descricao: etapa.instrucao,
      etapa: etapa.titulo,
      status: etapa.ordem === 1 ? "em_andamento" : "pendente",
      prioridade: etapa.ordem === 1 ? "alta" : "media",
    });
  }

  // Registra no histórico
  await db.insert(historicoProcesso).values({
    processoId: processo.id,
    usuarioId,
    acao: "processo_criado",
    descricao: `Processo criado a partir da intenção: "${textoIntencao.slice(0, 150)}" — tipo: ${tipo.nome}`,
    dados: { tipoProcesso: tipo.nome, totalEtapas: etapas.length },
  });

  return { processo, tipo, totalEtapas: etapas.length };
}

/** Painel do servidor: tarefas de hoje, atrasadas, pendências, aguardando outros. */
export async function painelServidor(usuarioId: string, orgaoId: string) {
  const agora = new Date();
  // Só tarefas de PROCESSOS REAIS (exclui templates de jornada sem processo vinculado)
  const tarefasDoUsuario = await db
    .select()
    .from(tarefas)
    .where(and(
      eq(tarefas.responsavelId, usuarioId),
      isNotNull(tarefas.processoId),
    ));

  const tarefasHoje = tarefasDoUsuario.filter((t) => {
    if (t.status === "concluida") return false;
    if (t.prazo) {
      const d = new Date(t.prazo);
      return d.toDateString() === agora.toDateString();
    }
    return t.status === "em_andamento" || t.status === "pendente";
  });

  const atrasadas = tarefasDoUsuario.filter((t) => {
    if (t.status === "concluida" || !t.prazo) return false;
    return new Date(t.prazo) < agora && t.status !== "aguardando_outro";
  });

  const aguardandoOutro = tarefasDoUsuario.filter((t) => t.status === "aguardando_outro");
  const pendentes = tarefasDoUsuario.filter((t) => t.status === "pendente");

  // Alerta: etapa parada há mais de 5 dias
  const paradas5dias = tarefasDoUsuario.filter((t) => {
    if (t.status === "concluida" || t.status === "aguardando_outro") return false;
    const criada = new Date(t.createdAt);
    return (agora.getTime() - criada.getTime()) > 5 * 86400_000 && t.status === "pendente";
  });

  return {
    tarefasHoje,
    atrasadas,
    aguardandoOutro,
    pendentes,
    paradas5dias,
    totalAtivas: tarefasDoUsuario.filter((t) => t.status !== "concluida").length,
  };
}

/** Gera alertas inteligentes para o órgão. */
export async function gerarAlertas(orgaoId: string): Promise<number> {
  const agora = new Date();
  // Só tarefas de processos reais (exclui templates de jornada)
  const tarefasAtivas = await db.select().from(tarefas)
    .where(and(eq(tarefas.orgaoId, orgaoId), isNotNull(tarefas.processoId)));
  let criados = 0;

  for (const t of tarefasAtivas) {
    if (t.status === "concluida" || t.status === "aguardando_outro") continue;

    // Prazo vence amanhã
    if (t.prazo) {
      const diffDias = Math.ceil((new Date(t.prazo).getTime() - agora.getTime()) / 86400_000);
      if (diffDias === 1) {
        await db.insert(alertas).values({
          orgaoId, tarefaId: t.id, processoId: t.processoId,
          tipo: "prazo", mensagem: `"${t.titulo}" vence amanhã.`, severidade: "alta",
        });
        criados++;
      } else if (diffDias < 0 && t.status !== "atrasada") {
        await db.insert(alertas).values({
          orgaoId, tarefaId: t.id, processoId: t.processoId,
          tipo: "prazo", mensagem: `"${t.titulo}" está ATRASADA (venceu há ${Math.abs(diffDias)} dia(s)).`, severidade: "alta",
        });
        criados++;
      }
    }

    // Etapa parada há 5+ dias
    const criada = new Date(t.createdAt);
    if (t.status === "pendente" && (agora.getTime() - criada.getTime()) > 5 * 86400_000) {
      await db.insert(alertas).values({
        orgaoId, tarefaId: t.id, processoId: t.processoId,
        tipo: "parado", mensagem: `A etapa "${t.titulo}" está parada há mais de 5 dias.`, severidade: "media",
      });
      criados++;
    }
  }
  return criados;
}

/** Busca por linguagem natural em processos, documentos, normas e modelos. */
export async function buscaInteligente(orgaoId: string, consulta: string) {
  const q = consulta?.trim() || "";
  if (q.length < 3) return { processos: [], normas: [], tarefas: [] };

  // Busca em processos (objeto/número)
  const processosEncontrados = await db
    .select({ id: processos.id, numero: processos.numero, objeto: processos.objeto, status: processos.status })
    .from(processos)
    .where(and(eq(processos.orgaoId, orgaoId), or(ilike(processos.objeto, `%${q}%`), ilike(processos.numero, `%${q}%`))))
    .limit(10);

  // Busca na base de conhecimento
  const normas = await db
    .select()
    .from(baseConhecimento)
    .where(or(ilike(baseConhecimento.titulo, `%${q}%`), ilike(baseConhecimento.conteudo, `%${q}%`)))
    .limit(10);

  // Busca em tarefas
  const tarefasEncontradas = await db
    .select()
    .from(tarefas)
    .where(and(eq(tarefas.orgaoId, orgaoId), ilike(tarefas.titulo, `%${q}%`)))
    .limit(10);

  return { processos: processosEncontrados, normas, tarefas: tarefasEncontradas };
}

/** Consulta simplificada à legislação/base de conhecimento (com fonte). */
export async function consultarNormas(orgaoId: string | null, pergunta: string) {
  const q = pergunta?.trim() || "";
  if (q.length < 3) return [];

  const rows = await db
    .select()
    .from(baseConhecimento)
    .where(or(ilike(baseConhecimento.titulo, `%${q}%`), ilike(baseConhecimento.conteudo, `%${q}%`)))
    .limit(6);
  return rows.map((r) => ({ titulo: r.titulo, categoria: r.categoria, conteudo: r.conteudo, fonte: r.fonte }));
}

/** Painel do gestor: gargalos, atrasos, carga de trabalho, produtividade. */
export async function painelGestor(orgaoId: string) {
  const todasTarefas = await db.select().from(tarefas).where(eq(tarefas.orgaoId, orgaoId));
  const todosUsuarios = await db.select({ id: usuarios.id, nome: usuarios.nome, cargo: usuarios.cargo }).from(usuarios);

  const atrasadas = todasTarefas.filter((t) => t.status === "atrasada" || (t.prazo && new Date(t.prazo) < new Date() && t.status !== "concluida"));
  const aguardandoOutro = todasTarefas.filter((t) => t.status === "aguardando_outro");
  const paradas = todasTarefas.filter((t) => t.status === "pendente" && (new Date().getTime() - new Date(t.createdAt).getTime()) > 5 * 86400_000);

  // Carga por servidor
  const carga = todosUsuarios
    .map((u) => {
      const doServidor = todasTarefas.filter((t) => t.responsavelId === u.id);
      return {
        nome: u.nome,
        cargo: u.cargo,
        ativas: doServidor.filter((t) => t.status !== "concluida").length,
        concluidas: doServidor.filter((t) => t.status === "concluida").length,
        atrasadas: doServidor.filter((t) => t.status === "atrasada").length,
      };
    })
    .filter((c) => c.ativas > 0 || c.concluidas > 0)
    .sort((a, b) => b.ativas - a.ativas);

  return {
    totalTarefas: todasTarefas.length,
    atrasadas,
    aguardandoOutro,
    paradas,
    carga,
    conclusao: todasTarefas.filter((t) => t.status === "concluida").length,
    taxaConclusao: todasTarefas.length > 0 ? Math.round((todasTarefas.filter((t) => t.status === "concluida").length / todasTarefas.length) * 100) : 0,
  };
}
