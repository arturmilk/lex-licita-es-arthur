import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pesquisas, sessoesAgente, resultadosPesquisa } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buscarTodasFontes, sugerirFontes, FONTES_CONFIG } from "@/lib/sources";
import type { FonteId } from "@/lib/sources";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const pesquisaId = params.id;

  // Load pesquisa
  const pesquisa = await db.query.pesquisas.findFirst({
    where: eq(pesquisas.id, pesquisaId),
    with: { processo: { columns: { orgaoId: true } } },
  });

  if (!pesquisa) return NextResponse.json({ error: "Pesquisa não encontrada" }, { status: 404 });

  // Determine which sources to use
  const fontesAtivas = (pesquisa.fontesAtivas as FonteId[]) || sugerirFontes(pesquisa.objeto);

  // Create agent sessions
  const sessoesCriadas = await db
    .insert(sessoesAgente)
    .values(
      fontesAtivas.map((fonte) => {
        const config = FONTES_CONFIG.find((f) => f.id === fonte);
        return {
          pesquisaId,
          nomeAgente: `Agente ${config?.nome || fonte}`,
          fonte,
          status: "executando" as const,
          iniciadoEm: new Date(),
        };
      })
    )
    .returning();

  // Run all source searches in parallel (fire and forget with tracking)
  const buscaParams = {
    termo: pesquisa.objeto,
    tamanhoPagina: 30,
  };

  // Execute searches asynchronously
  Promise.all(
    sessoesCriadas.map(async (sessao) => {
      try {
        const resultado = await buscarTodasFontes([sessao.fonte as FonteId], buscaParams);
        const r = resultado[0];

        if (r.items.length > 0) {
          await db.insert(resultadosPesquisa).values(
            r.items.map((item) => ({
              pesquisaId,
              sessaoAgenteId: sessao.id,
              fonte: item.fonte,
              orgao: item.orgao,
              descricao: item.descricao,
              quantidade: item.quantidade,
              dataContrato: item.dataContrato,
              valorUnitario: item.valorUnitario ? String(item.valorUnitario) : null,
              valorTotal: item.valorTotal ? String(item.valorTotal) : null,
              localizacao: item.localizacao,
              similaridade: item.similaridade,
              documentoOrigem: item.documentoOrigem,
              linkEdital: item.linkEdital,
              dadosBrutos: item.dadosBrutos,
            }))
          );
        }

        await db
          .update(sessoesAgente)
          .set({
            status: r.erro ? "erro" : "concluido",
            totalEncontrado: r.items.length,
            progresso: 100,
            mensagem: r.erro ? undefined : `${r.items.length} resultado(s) encontrado(s)`,
            erro: r.erro,
            concluidoEm: new Date(),
          })
          .where(eq(sessoesAgente.id, sessao.id));
      } catch (err) {
        await db
          .update(sessoesAgente)
          .set({
            status: "erro",
            erro: String(err),
            concluidoEm: new Date(),
          })
          .where(eq(sessoesAgente.id, sessao.id));
      }
    })
  ).catch(console.error);

  return NextResponse.json({
    sessoes: sessoesCriadas.map((s) => ({ id: s.id, fonte: s.fonte, nomeAgente: s.nomeAgente })),
    mensagem: `${sessoesCriadas.length} agente(s) iniciado(s)`,
  });
}
