"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  processos,
  pesquisas,
  resultadosPesquisa,
  evidencias,
  configuracoes,
} from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function listarProcessos() {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;
  return db.select().from(processos).where(eq(processos.orgaoId, orgaoId)).orderBy(desc(processos.updatedAt));
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
  especificacoes?: unknown;
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
  const orgaoId = (session.user as any).orgaoId;

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
    .where(eq(processos.orgaoId, orgaoId))
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
    dadosBrutos?: Record<string, unknown>;
  }>
) {
  if (resultados.length === 0) return [];
  return db.insert(resultadosPesquisa).values(resultados.map((r) => ({ ...r, pesquisaId } as any))).returning();
}

// Keep old name as alias
export const salvarResultadosPNCP = salvarResultadosPesquisa;

export async function buscarPesquisa(id: string) {
  const session = await auth();
  if (!session) throw new Error("Não autorizado");
  const orgaoId = (session.user as any).orgaoId;

  const [pesquisa] = await db
    .select({
      id: pesquisas.id,
      objeto: pesquisas.objeto,
      especificacoes: pesquisas.especificacoes,
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
