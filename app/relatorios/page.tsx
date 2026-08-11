import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { relatorios, pesquisas, processos } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { Download, FileText, Table } from "lucide-react";

export default async function RelatoriosPage() {
  const session = await auth();
  if (!session) redirect("/login");
  const orgaoId = (session.user as any).orgaoId;

  const result = await db
    .select({
      id: relatorios.id,
      nomeArquivo: relatorios.nomeArquivo,
      tipo: relatorios.tipo,
      url: relatorios.url,
      createdAt: relatorios.createdAt,
      processoNumero: processos.numero,
      pesquisaObjeto: pesquisas.objeto,
    })
    .from(relatorios)
    .leftJoin(pesquisas, eq(relatorios.pesquisaId, pesquisas.id))
    .leftJoin(processos, eq(pesquisas.processoId, processos.id))
    .where(eq(processos.orgaoId, orgaoId))
    .orderBy(desc(relatorios.createdAt));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-neutral-900">Relatórios</h1>
        <p className="text-sm text-neutral-500 mt-1">{result.length} relatório(s) gerado(s)</p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200">
        {result.length === 0 ? (
          <div className="px-6 py-12 text-center text-neutral-400 text-sm">
            Nenhum relatório gerado ainda. Conclua uma pesquisa para gerar relatórios.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left">
                <th className="px-6 py-3 font-medium text-neutral-500">Arquivo</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Processo</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Tipo</th>
                <th className="px-6 py-3 font-medium text-neutral-500">Gerado em</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {result.map((r) => (
                <tr key={r.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {r.tipo === "pdf" ? (
                        <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                      ) : (
                        <Table className="w-4 h-4 text-green-600 flex-shrink-0" />
                      )}
                      <span className="text-neutral-800 truncate max-w-xs">{r.nomeArquivo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 font-mono text-xs text-neutral-500">{r.processoNumero || "—"}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.tipo === "pdf" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                      {r.tipo.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-neutral-400 text-xs">
                    {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-3">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-neutral-100 rounded-lg inline-flex text-neutral-500 hover:text-neutral-800 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </a>
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
