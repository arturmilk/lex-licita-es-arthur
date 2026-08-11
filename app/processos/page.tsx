import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { processos, usuarios } from "@/lib/db/schema";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import ProcessosBusca from "@/components/ProcessosBusca";

const STATUS_COLOR: Record<string, string> = {
  rascunho: "bg-neutral-100 text-neutral-600",
  pesquisando: "bg-blue-100 text-blue-700",
  estimado: "bg-green-100 text-green-700",
  concluido: "bg-emerald-100 text-emerald-700",
  cancelado: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pesquisando: "Pesquisando",
  estimado: "Estimado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export default async function ProcessosPage({
  searchParams,
}: {
  searchParams: { busca?: string; status?: string };
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const orgaoId = (session.user as any).orgaoId;

  const conditions = [eq(processos.orgaoId, orgaoId)];
  if (searchParams.status && searchParams.status !== "todos") {
    conditions.push(eq(processos.status, searchParams.status as any));
  }

  let result = await db
    .select({
      id: processos.id,
      numero: processos.numero,
      objeto: processos.objeto,
      unidade: processos.unidade,
      status: processos.status,
      updatedAt: processos.updatedAt,
      usuarioNome: usuarios.nome,
    })
    .from(processos)
    .leftJoin(usuarios, eq(processos.usuarioId, usuarios.id))
    .where(and(...conditions))
    .orderBy(desc(processos.updatedAt));

  if (searchParams.busca) {
    const b = searchParams.busca.toLowerCase();
    result = result.filter(
      (p) =>
        p.numero.toLowerCase().includes(b) ||
        p.objeto.toLowerCase().includes(b)
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Processos</h1>
          <p className="text-sm text-neutral-500 mt-1">{result.length} processo(s) encontrado(s)</p>
        </div>
        <Link
          href="/pesquisa/nova"
          className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova pesquisa
        </Link>
      </div>

      <ProcessosBusca initialBusca={searchParams.busca} initialStatus={searchParams.status} />

      <div className="bg-white rounded-xl border border-neutral-200 mt-4">
        {result.length === 0 ? (
          <div className="px-6 py-12 text-center text-neutral-400 text-sm">
            Nenhum processo encontrado.{" "}
            <Link href="/pesquisa/nova" className="text-neutral-700 underline">
              Criar novo
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left">
                <th className="px-6 py-3 font-medium text-neutral-500">Número</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Objeto</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Status</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Responsável</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Atualizado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {result.map((p) => (
                <tr key={p.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-neutral-600">{p.numero}</td>
                  <td className="px-6 py-3 text-neutral-800 max-w-xs truncate">{p.objeto}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[p.status] || "bg-neutral-100"}`}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-neutral-600">{p.usuarioNome || "—"}</td>
                  <td className="px-6 py-3 text-neutral-400 text-xs">
                    {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
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
