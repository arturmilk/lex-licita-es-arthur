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
import { eq, desc } from "drizzle-orm";
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
    dadosBrutos?: Record<string, unknown>;
  }>
) {
  if (resultados.length === 0) return [];
  return db.insert(resultadosPesquisa).values(resultados.map((r) => ({ ...r, pesquisaId } as any))).returning();
}

// Keep old name as alias
export const salvarResultadosPNCP = salvarResultadosPesquisa;

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
