import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pesquisas, processos, sessoesAgente, usuarios } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { lerLogs } from "@/lib/logger";

// Painel admin: logs do sistema + atividade recente (apenas administradores)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if ((session.user as any).perfil !== "administrador") {
    return NextResponse.json({ error: "Acesso restrito a administradores" }, { status: 403 });
  }

  const orgaoId = (session.user as any).orgaoId;

  const [pesquisasRecentes, sessoes, usuariosOrg] = await Promise.all([
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
      .where(eq(processos.orgaoId, orgaoId))
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
      .limit(15),
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
  ]);

  return NextResponse.json({
    logs: lerLogs(400),
    pesquisas: pesquisasRecentes,
    sessoes,
    usuarios: usuariosOrg,
    horario: new Date().toISOString(),
  });
}
