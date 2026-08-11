import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { processos, pesquisas, resultadosPesquisa } from "@/lib/db/schema";
import { eq, and, gte, count, sum, desc } from "drizzle-orm";
import { FileText, Search, TrendingUp, DollarSign } from "lucide-react";
import Link from "next/link";

function formatMoeda(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 }).format(v);
}

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pesquisando: "Pesquisando",
  estimado: "Estimado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  rascunho: "bg-neutral-100 text-neutral-600",
  pesquisando: "bg-blue-100 text-blue-700",
  estimado: "bg-green-100 text-green-700",
  concluido: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-red-100 text-red-600",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const orgaoId = (session.user as any).orgaoId;

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const [
    totalProcessos,
    pesquisasMes,
    ultimosProcessos,
    somaEstimadas,
    totalAceitos,
    totalResultados,
  ] = await Promise.all([
    db.select({ c: count() }).from(processos).where(
      and(eq(processos.orgaoId, orgaoId))
    ),
    db.select({ c: count() }).from(pesquisas)
      .leftJoin(processos, eq(pesquisas.processoId, processos.id))
      .where(and(eq(processos.orgaoId, orgaoId), gte(pesquisas.createdAt, inicioMes))),
    db.select({
      id: processos.id,
      numero: processos.numero,
      objeto: processos.objeto,
      status: processos.status,
      updatedAt: processos.updatedAt,
    }).from(processos)
      .where(eq(processos.orgaoId, orgaoId))
      .orderBy(desc(processos.updatedAt))
      .limit(8),
    db.select({ s: sum(pesquisas.precoTotalEstimado) }).from(pesquisas)
      .leftJoin(processos, eq(pesquisas.processoId, processos.id))
      .where(eq(processos.orgaoId, orgaoId)),
    db.select({ c: count() }).from(resultadosPesquisa)
      .leftJoin(pesquisas, eq(resultadosPesquisa.pesquisaId, pesquisas.id))
      .leftJoin(processos, eq(pesquisas.processoId, processos.id))
      .where(and(eq(processos.orgaoId, orgaoId), eq(resultadosPesquisa.avaliacao, "aceito"))),
    db.select({ c: count() }).from(resultadosPesquisa)
      .leftJoin(pesquisas, eq(resultadosPesquisa.pesquisaId, pesquisas.id))
      .leftJoin(processos, eq(pesquisas.processoId, processos.id))
      .where(and(eq(processos.orgaoId, orgaoId), eq(resultadosPesquisa.avaliacao, "rejeitado"))),
  ]);

  const nProcessos = Number(totalProcessos[0]?.c ?? 0);
  const nPesquisasMes = Number(pesquisasMes[0]?.c ?? 0);
  const valorTotal = Number(somaEstimadas[0]?.s ?? 0);
  const nAceitos = Number(totalAceitos[0]?.c ?? 0);
  const nRejeitados = Number(totalResultados[0]?.c ?? 0);
  const taxaAprovacao = nAceitos + nRejeitados > 0
    ? Math.round((nAceitos / (nAceitos + nRejeitados)) * 100)
    : 0;

  const stats = [
    { label: "Pesquisas no mês", value: nPesquisasMes, icon: Search, color: "text-blue-600" },
    { label: "Processos ativos", value: nProcessos, icon: FileText, color: "text-purple-600" },
    { label: "Taxa de aprovação", value: `${taxaAprovacao}%`, icon: TrendingUp, color: "text-green-600" },
    { label: "Valor estimado total", value: valorTotal > 0 ? formatMoeda(valorTotal) : "—", icon: DollarSign, color: "text-amber-600" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <p className="text-neutral-500 text-sm mt-1">
          Bem-vindo, {session.user?.name}. Aqui está um resumo do {(session.user as any).orgaoNome || "seu órgão"}.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-neutral-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{s.label}</p>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold text-neutral-900">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent processes */}
      <div className="bg-white rounded-xl border border-neutral-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-800">Processos recentes</h2>
          <Link href="/processos" className="text-sm text-neutral-500 hover:text-neutral-800">
            Ver todos →
          </Link>
        </div>
        {ultimosProcessos.length === 0 ? (
          <div className="px-6 py-12 text-center text-neutral-400 text-sm">
            Nenhum processo cadastrado ainda.{" "}
            <Link href="/pesquisa/nova" className="text-neutral-700 underline">Criar primeira pesquisa</Link>
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {ultimosProcessos.map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-6 py-3 hover:bg-neutral-50 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">{p.objeto}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Processo {p.numero}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${STATUS_COLOR[p.status] || "bg-neutral-100 text-neutral-600"}`}>
                  {STATUS_LABEL[p.status] || p.status}
                </span>
                <span className="text-xs text-neutral-400 flex-shrink-0">
                  {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
