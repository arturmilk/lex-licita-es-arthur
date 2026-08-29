"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  processos,
  pesquisas,
  resultadosPesquisa,
  evidencias,
  configuracoes,
  usuarios,
} from "@/lib/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function listarProcessos() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const user = session.user as any;
  const orgaoId = user.orgaoId;
  const perfil: string = user.perfil || "pesquisador";

  // Gestor e administrador veem processos de toda a equipe do órgão
  // Pesquisador vê apenas os próprios
  const query = db.select().from(processos).where(
    perfil === "pesquisador"
      ? and(eq(processos.orgaoId, orgaoId), eq(processos.usuarioId, user.id))
      : eq(processos.orgaoId, orgaoId)
  );
  return query.orderBy(desc(processos.updatedAt));
}

export async function criarProcesso(data: { numero: string; objeto: string; unidade?: string }) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;
  const usuarioId = (session.user as any).id as string;
  const [processo] = await db.insert(processos).values({ ...data, orgaoId, usuarioId }).returning();
  revalidatePath("/processos");
  return processo;
}

export async function criarPesquisa(data: {
  processoId: string;
  objeto: string;
  quantidade: number;
  unidadeMedida?: string;
  localEntrega?: string;
  formaParcelamento?: string;
  especificacoes?: unknown;
  itens?: unknown;
  pesquisaMercado?: unknown;
  cvLimite?: number;
  parametrosRelatorio?: unknown;
  meEpp?: unknown;
  decomposicaoCustos?: unknown;
  premissas?: unknown;
  caracteristicasIA?: unknown;
  periodoPesquisa?: string;
  regiaoPesquisa?: string;
  metodoCalculo?: "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
  fontesAtivas?: string[];
}) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const usuarioId = (session.user as any).id as string;
  const [pesquisa] = await db.insert(pesquisas).values({ ...data, usuarioId } as any).returning();
  revalidatePath("/pesquisas");
  return pesquisa;
}

export async function atualizarPesquisa(id: string, data: Partial<typeof pesquisas.$inferInsert>) {
  const [updated] = await db.update(pesquisas).set({ ...data, updatedAt: new Date() } as any).where(eq(pesquisas.id, id)).returning();
  return updated;
}

export async function listarPesquisas() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const user = session.user as any;
  const orgaoId = user.orgaoId;
  const perfil: string = user.perfil || "pesquisador";

  try {
    // Gestor e administrador veem pesquisas de toda a equipe do órgão
    // Pesquisador vê apenas as próprias
    const condicao = perfil === "pesquisador"
      ? and(eq(processos.orgaoId, orgaoId), eq(pesquisas.usuarioId, user.id))
      : eq(processos.orgaoId, orgaoId);

    const result = await db
      .select({
        id: pesquisas.id,
        objeto: pesquisas.objeto,
        quantidade: pesquisas.quantidade,
        status: pesquisas.status,
        precoUnitarioEstimado: pesquisas.precoUnitarioEstimado,
        precoTotalEstimado: pesquisas.precoTotalEstimado,
        estatisticas: pesquisas.estatisticas,
        createdAt: pesquisas.createdAt,
        processoId: pesquisas.processoId,
        processoNumero: processos.numero,
      })
      .from(pesquisas)
      .leftJoin(processos, eq(pesquisas.processoId, processos.id))
      .where(condicao)
      .orderBy(desc(pesquisas.createdAt));

    const ids = result.map((r) => r.id);
    let contagens: Record<string, number> = {};
    if (ids.length) {
      const rows = await db
        .select({ pesquisaId: resultadosPesquisa.pesquisaId, avaliacao: resultadosPesquisa.avaliacao })
        .from(resultadosPesquisa)
        .where(inArray(resultadosPesquisa.pesquisaId, ids));
      contagens = rows.reduce((acc, r) => {
        acc[r.pesquisaId] = (acc[r.pesquisaId] || 0) + (r.avaliacao === "aceito" ? 1 : 0);
        return acc;
      }, {} as Record<string, number>);
    }

    return result.map((r) => ({ ...r, referenciasAceitas: contagens[r.id] || 0 }));
  } catch (err: any) {
    throw new Error(err?.message || "Erro ao listar pesquisas");
  }
}

export async function salvarResultadosPesquisa(
  pesquisaId: string,
  resultados: Array<{
    fonte?: string;
    orgao: string;
    descricao: string;
    quantidade?: number | null;
    dataContrato?: string | null;
    valorUnitario?: number | null;
    valorTotal?: number | null;
    localizacao?: string | null;
    similaridade: number;
    documentoOrigem?: string | null;
    linkEdital?: string | null;
    avaliacao?: "pendente" | "aceito" | "rejeitado";
    justificativaRejeicao?: string | null;
    itemId?: string | null;
    cnpj?: string | null;
    fonteDados?: string | null;
    dadosBrutos?: Record<string, unknown>;
  }>
) {
  if (resultados.length === 0) return [];
  return db.insert(resultadosPesquisa).values(resultados.map((r) => ({
    ...r,
    pesquisaId,
    // dataContrato é VARCHAR(20) — truncar ISO timestamps longos (ex: "2024-03-15T14:30:00.000Z")
    dataContrato: r.dataContrato ? String(r.dataContrato).slice(0, 10) : null,
  } as any))).returning();
}

// Keep old name as alias
export const salvarResultadosPNCP = salvarResultadosPesquisa;

export async function buscarPesquisa(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;

  try {
  const [pesquisa] = await db
    .select({
      id: pesquisas.id,
      objeto: pesquisas.objeto,
      especificacoes: pesquisas.especificacoes,
      itens: pesquisas.itens,
      pesquisaMercado: pesquisas.pesquisaMercado,
      formaParcelamento: pesquisas.formaParcelamento,
      cvLimite: pesquisas.cvLimite,
      parametrosRelatorio: pesquisas.parametrosRelatorio,
      meEpp: pesquisas.meEpp,
      decomposicaoCustos: pesquisas.decomposicaoCustos,
      premissas: pesquisas.premissas,
      caracteristicasIA: pesquisas.caracteristicasIA,
      quantidade: pesquisas.quantidade,
      unidadeMedida: pesquisas.unidadeMedida,
      localEntrega: pesquisas.localEntrega,
      status: pesquisas.status,
      precoUnitarioEstimado: pesquisas.precoUnitarioEstimado,
      precoTotalEstimado: pesquisas.precoTotalEstimado,
      estatisticas: pesquisas.estatisticas,
      justificativa: pesquisas.justificativa,
      metodoCalculo: pesquisas.metodoCalculo,
      createdAt: pesquisas.createdAt,
      processoNumero: processos.numero,
      processoUnidade: processos.unidade,
    })
    .from(pesquisas)
    .innerJoin(processos, eq(pesquisas.processoId, processos.id))
    .where(and(eq(pesquisas.id, id), eq(processos.orgaoId, orgaoId)))
    .limit(1);

  if (!pesquisa) throw new Error("Pesquisa não encontrada");

  const resultados = await db
    .select()
    .from(resultadosPesquisa)
    .where(eq(resultadosPesquisa.pesquisaId, id))
    .orderBy(desc(resultadosPesquisa.createdAt));

  return { ...pesquisa, resultados };
  } catch (err: any) {
    throw new Error(err?.message || "Erro ao buscar pesquisa");
  }
}

export async function avaliarResultado(
  id: string,
  avaliacao: "aceito" | "rejeitado",
  justificativaRejeicao?: string
) {
  const [updated] = await db.update(resultadosPesquisa).set({ avaliacao, justificativaRejeicao }).where(eq(resultadosPesquisa.id, id)).returning();
  return updated;
}

export async function salvarEvidencia(data: {
  pesquisaId: string;
  nome: string;
  tipo: "pdf" | "xlsx" | "imagem" | "link" | "print" | "outro";
  url: string;
  origem?: string;
  tamanhoBytes?: number;
  mimeType?: string;
}) {
  const [ev] = await db.insert(evidencias).values(data).returning();
  return ev;
}

export async function buscarConfiguracoes() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;
  const result = await db.select().from(configuracoes).where(eq(configuracoes.orgaoId, orgaoId)).limit(1);
  return result[0] || { similaridadeMinima: 75, cvAlerta: 25, periodoPadrao: "12_meses", metodoPadrao: "media_aritmetica", fontesAtivas: ["pncp", "painel_precos"] };
}

export async function salvarConfiguracoes(data: {
  similaridadeMinima: number;
  cvAlerta: number;
  periodoPadrao: string;
  metodoPadrao: "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
}) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;
  const [updated] = await db
    .insert(configuracoes)
    .values({ ...data, orgaoId } as any)
    .onConflictDoUpdate({ target: configuracoes.orgaoId, set: { ...data, updatedAt: new Date() } })
    .returning();
  return updated;
}

export async function listarEvidenciasOrg() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;
  // join evidencias → pesquisas → processos (para filtrar por orgao)
  const rows = await db
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
      pesquisaObjeto: pesquisas.objeto,
    })
    .from(evidencias)
    .innerJoin(pesquisas, eq(evidencias.pesquisaId, pesquisas.id))
    .leftJoin(processos, eq(pesquisas.processoId, processos.id))
    .where(eq(processos.orgaoId, orgaoId))
    .orderBy(desc(evidencias.createdAt));
  return rows;
}

export async function removerEvidencia(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  await db.delete(evidencias).where(eq(evidencias.id, id));
}

export async function listarDashboard() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;

  try {
  const [pesquisasRecentes, totais] = await Promise.all([
    db
      .select({
        id: pesquisas.id,
        objeto: pesquisas.objeto,
        status: pesquisas.status,
        precoTotalEstimado: pesquisas.precoTotalEstimado,
        createdAt: pesquisas.createdAt,
        processoNumero: processos.numero,
        usuarioNome: usuarios.nome,
      })
      .from(pesquisas)
      .leftJoin(processos, eq(pesquisas.processoId, processos.id))
      .leftJoin(usuarios, eq(pesquisas.usuarioId, usuarios.id))
      .where(eq(processos.orgaoId, orgaoId))
      .orderBy(desc(pesquisas.createdAt))
      .limit(8),
    db
      .select({
        id: pesquisas.id,
        status: pesquisas.status,
        precoTotalEstimado: pesquisas.precoTotalEstimado,
      })
      .from(pesquisas)
      .leftJoin(processos, eq(pesquisas.processoId, processos.id))
      .where(eq(processos.orgaoId, orgaoId)),
  ]);

  const total = totais.length;
  const concluidas = totais.filter(p => p.status === "concluida").length;
  const emAndamento = totais.filter(p => p.status === "em_andamento").length;
  const valorTotal = totais.reduce((acc, p) => acc + (p.precoTotalEstimado ? Number(p.precoTotalEstimado) : 0), 0);

  return { pesquisasRecentes, total, concluidas, emAndamento, valorTotal };
  } catch (err: any) {
    throw new Error(err?.message || "Erro ao carregar dashboard");
  }
}

/**
 * Histórico do próprio órgão (melhoria): valores já pagos pelo órgão em
 * pesquisas anteriores para objetos semelhantes. Para o funcionário que
 * realiza a licitação, o histórico do próprio órgão é a referência mais
 * defensável — o TCU valoriza a comparação com contratações do mesmo órgão.
 */
export async function historicoOrgao(termo: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;
  if (!orgaoId) return [];

  const termoNorm = (termo || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (termoNorm.length < 4) return [];

  try {
    const rows = await db
      .select({
        id: pesquisas.id,
        objeto: pesquisas.objeto,
        status: pesquisas.status,
        precoUnitarioEstimado: pesquisas.precoUnitarioEstimado,
        precoTotalEstimado: pesquisas.precoTotalEstimado,
        quantidade: pesquisas.quantidade,
        unidadeMedida: pesquisas.unidadeMedida,
        metodoCalculo: pesquisas.metodoCalculo,
        createdAt: pesquisas.createdAt,
        processoNumero: processos.numero,
      })
      .from(pesquisas)
      .leftJoin(processos, eq(pesquisas.processoId, processos.id))
      .where(eq(processos.orgaoId, orgaoId))
      .orderBy(desc(pesquisas.createdAt))
      .limit(200);

    // Filtra por semelhança textual simples (objeto contém termos do termo pesquisado)
    const termos = termoNorm.split(/\s+/).filter(w => w.length > 3);
    const relevantes = rows
      .filter(p => {
        const obj = (p.objeto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return termos.some(t => obj.includes(t));
      })
      .slice(0, 15);

    return relevantes.map(p => ({
      id: p.id,
      objeto: p.objeto,
      processoNumero: p.processoNumero,
      precoUnitario: p.precoUnitarioEstimado ? Number(p.precoUnitarioEstimado) : null,
      precoTotal: p.precoTotalEstimado ? Number(p.precoTotalEstimado) : null,
      quantidade: p.quantidade,
      unidadeMedida: p.unidadeMedida,
      metodo: p.metodoCalculo,
      data: p.createdAt ? p.createdAt.toISOString().slice(0, 10) : null,
    }));
  } catch {
    return [];
  }
}
