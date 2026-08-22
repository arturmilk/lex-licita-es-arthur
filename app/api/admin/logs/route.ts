import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pesquisas, processos, sessoesAgente, usuarios, logsSistema } from "@/lib/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { lerLogsArquivo } from "@/lib/logger";

// Painel admin: logs do sistema + atividade recente + stats para gráficos
// (apenas administradores). Visão GLOBAL do sistema (todas as orgs).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if ((session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const orgaoId = (session.user as any).orgaoId;

  const [pesquisasRecentes, sessoes, usuariosOrg, logs, totalPesquisas, totalSessoes, pesquisasPorDia, sessoesPorStatus, fontesUsadas, erros] =
    await Promise.all([
      db
        .select({
          id: pesquisas.id,
          objeto: pesquisas.objeto,
          status: pesquisas.status,
          precoTotalEstimado: pesquisas.precoTotalEstimado,
          createdAt: pesquisas.createdAt,
          processoNumero: processos.numero,
        })
        .from(pesquisas)
        .leftJoin(processos, eq(pesquisas.processoId, processos.id))
        .orderBy(desc(pesquisas.createdAt))
        .limit(15),
      db
        .select({
          id: sessoesAgente.id,
          nomeAgente: sessoesAgente.nomeAgente,
          fonte: sessoesAgente.fonte,
          status: sessoesAgente.status,
          totalEncontrado: sessoesAgente.totalEncontrado,
          mensagem: sessoesAgente.mensagem,
          erro: sessoesAgente.erro,
          concluidoEm: sessoesAgente.concluidoEm,
          createdAt: sessoesAgente.createdAt,
        })
        .from(sessoesAgente)
        .orderBy(desc(sessoesAgente.createdAt))
        .limit(20),
      db
        .select({
          id: usuarios.id,
          nome: usuarios.nome,
          email: usuarios.email,
          perfil: usuarios.perfil,
          cargo: usuarios.cargo,
          ativo: usuarios.ativo,
          createdAt: usuarios.createdAt,
        })
        .from(usuarios)
        .where(and(eq(usuarios.orgaoId, orgaoId)))
        .orderBy(desc(usuarios.createdAt)),
      db.select().from(logsSistema).orderBy(desc(logsSistema.ts)).limit(200),
      db.select({ n: sql<number>`count(*)::int` }).from(pesquisas).then((r) => r[0]?.n ?? 0),
      db.select({ n: sql<number>`count(*)::int` }).from(sessoesAgente).then((r) => r[0]?.n ?? 0),
      db.execute(
        sql`SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS dia, count(*)::int AS total
            FROM pesquisas WHERE created_at >= now() - interval '7 days'
            GROUP BY dia ORDER BY dia`
      ).then((r) => r as unknown as { dia: string; total: number }[]),
      db.execute(
        sql`SELECT status, count(*)::int AS total FROM sessoes_agente
            GROUP BY status ORDER BY total DESC`
      ).then((r) => r as unknown as { status: string; total: number }[]),
      db.execute(
        sql`SELECT fonte, count(*)::int AS total FROM sessoes_agente
            GROUP BY fonte ORDER BY total DESC LIMIT 8`
      ).then((r) => r as unknown as { fonte: string; total: number }[]),
      db.execute(
        sql`SELECT
              count(*) FILTER (WHERE dados->>'erro' IS NOT NULL)::int AS total,
              count(*) FILTER (WHERE dados->>'ok' = 'false')::int AS total_ok_false
            FROM logs_sistema`
      ).then((r) => {
        const rows = r as unknown as { total: number; total_ok_false: number }[];
        const row = rows[0];
        return { total: (row?.total ?? 0) + (row?.total_ok_false ?? 0) };
      }),
    ]);

  // Erros por dia: logs com erro + sessões com status erro (últimos 7 dias)
  const errosPorDiaRaw = await db.execute(
    sql`SELECT to_char(day, 'YYYY-MM-DD') AS dia, (logs + sessoes)::int AS total FROM (
        SELECT date_trunc('day', ts)::date AS day, count(*)::int AS logs
        FROM logs_sistema WHERE dados->>'erro' IS NOT NULL AND ts >= now() - interval '7 days' GROUP BY day
      ) l FULL JOIN (
        SELECT date_trunc('day', created_at)::date AS day, count(*)::int AS sessoes
        FROM sessoes_agente WHERE status = 'erro' AND created_at >= now() - interval '7 days' GROUP BY day
      ) s USING (day) ORDER BY day`
  ).then((r) => r as unknown as { dia: string; total: number }[]);

  // Fallback: se o banco ainda não tem logs (migração pendente), tenta o arquivo
  const logsArquivo = logs.length === 0 ? await lerLogsArquivo(400) : "";

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      ts: l.ts,
      evento: l.evento,
      dados: l.dados || {},
    })),
    logsArquivo,
    pesquisas: pesquisasRecentes,
    sessoes,
    usuarios: usuariosOrg,
    horario: new Date().toISOString(),
    stats: {
      totalPesquisas,
      totalSessoes,
      totalErros: erros.total,
      pesquisasPorDia,
      sessoesPorStatus,
      fontesUsadas,
      errosPorDia: errosPorDiaRaw,
    },
  });
}
