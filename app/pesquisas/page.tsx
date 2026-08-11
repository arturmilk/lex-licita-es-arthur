import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { pesquisas, processos, resultadosPesquisa } from "@/lib/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import Link from "next/link";
import { Eye } from "lucide-react";

function formatMoeda(v: string | number | null) {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v));
}

export default async function PesquisasPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const orgaoId = (session.user as any).orgaoId;

  const result = await db
    .select({
      id: pesquisas.id,
      objeto: pesquisas.objeto,
      quantidade: pesquisas.quantidade,
      unidadeMedida: pesquisas.unidadeMedida,
      status: pesquisas.status,
      precoUnitarioEstimado: pesquisas.precoUnitarioEstimado,
      precoTotalEstimado: pesquisas.precoTotalEstimado,
      metodoCalculo: pesquisas.metodoCalculo,
      createdAt: pesquisas.createdAt,
      processoNumero: processos.numero,
      processoId: pesquisas.processoId,
    })
    .from(pesquisas)
    .leftJoin(processos, eq(pesquisas.processoId, processos.id))
    .where(eq(processos.orgaoId, orgaoId))
    .orderBy(desc(pesquisas.createdAt));

  const referencias = await Promise.all(
    result.map((p) =>
      db
        .select({ c: count() })
        .from(resultadosPesquisa)
        .where(and(eq(resultadosPesquisa.pesquisaId, p.id), eq(resultadosPesquisa.avaliacao, "aceito")))
        .then((r) => ({ pesquisaId: p.id, total: Number(r[0]?.c ?? 0) }))
    )
  );
  const refMap = Object.fromEntries(referencias.map((r) => [r.pesquisaId, r.total]));

  const STATUS_COLOR: Record<string, string> = {
    em_andamento: "bg-blue-100 text-blue-700",
    concluida: "bg-green-100 text-green-700",
    cancelada: "bg-red-100 text-red-600",
  };
  const STATUS_LABEL: Record<string, string> = {
    em_andamento: "Em andamento",
    concluida: "Concluída",
    cancelada: "Cancelada",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Pesquisas de Preço</h1>
          <p className="text-sm text-neutral-500 mt-1">{result.length} pesquisa(s)</p>
        </div>
        <Link
          href="/pesquisa/nova"
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          Nova pesquisa
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200">
        {result.length === 0 ? (
          <div className="px-6 py-12 text-center text-neutral-400 text-sm">
            Nenhuma pesquisa realizada ainda.{" "}
            <Link href="/pesquisa/nova" className="text-neutral-700 underline">Iniciar pesquisa</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left">
                <th className="px-6 py-3 font-medium text-neutral-500">Processo</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Objeto</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Refs aceitas</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Preço unit.</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Status</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Data</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {result.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-neutral-500">{p.processoNumero || "—"}</td>
                  <td className="px-6 py-3 text-neutral-800 max-w-xs truncate">{p.objeto}</td>
                  <td className="px-6 py-3 text-neutral-600 text-center">{refMap[p.id] ?? 0}</td>
                  <td className="px-6 py-3 font-medium text-neutral-800">{formatMoeda(p.precoUnitarioEstimado)}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[p.status] || "bg-neutral-100"}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-neutral-400 text-xs">
                    {new Date(p.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-3">
                    <Link href={`/pesquisas/${p.id}`} className="p-1.5 hover:bg-neutral-100 rounded-lg inline-flex text-neutral-500 hover:text-neutral-800 transition-colors">
                      <Eye className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
