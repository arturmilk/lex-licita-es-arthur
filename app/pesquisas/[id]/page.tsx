import { auth } from "@/auth";
import { db } from "@/lib/db";
import { pesquisas, processos, resultadosPesquisa, evidencias } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Check, X, FileText, Paperclip } from "lucide-react";

function formatarMoeda(v: number | string | null) {
  if (v == null) return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function PesquisaDetailPage({ params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) redirect("/login");

  const orgaoId = (session.user as any).orgaoId;

  const pesquisa = await db.query.pesquisas.findFirst({
    where: eq(pesquisas.id, params.id),
    with: {
      processo: true,
      resultados: { orderBy: (r, { desc }) => [desc(r.similaridade)] },
      evidencias: true,
    },
  });

  if (!pesquisa) notFound();
  if (pesquisa.processo.orgaoId !== orgaoId) notFound();

  const aceitos = pesquisa.resultados.filter(r => r.avaliacao === "aceito");
  const rejeitados = pesquisa.resultados.filter(r => r.avaliacao === "rejeitado");
  const pendentes = pesquisa.resultados.filter(r => r.avaliacao === "pendente");

  const statusColor: Record<string, string> = {
    rascunho: "bg-neutral-100 text-neutral-600",
    em_andamento: "bg-blue-100 text-blue-700",
    concluida: "bg-green-100 text-green-700",
    cancelada: "bg-red-100 text-red-700",
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/pesquisas" className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-medium">{pesquisa.objeto.substring(0, 80)}{pesquisa.objeto.length > 80 ? "..." : ""}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor[pesquisa.status] || "bg-neutral-100 text-neutral-600"}`}>
              {pesquisa.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">
            Processo {pesquisa.processo.numero} — {pesquisa.processo.orgaoId ? "" : ""}{new Date(pesquisa.createdAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-neutral-800">{pesquisa.resultados.length}</p>
          <p className="text-xs text-neutral-500 mt-1">Total de referências</p>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{aceitos.length}</p>
          <p className="text-xs text-green-600 mt-1">Aceitas</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{rejeitados.length}</p>
          <p className="text-xs text-red-500 mt-1">Rejeitadas</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-neutral-800">
            {pesquisa.precoUnitarioEstimado ? formatarMoeda(pesquisa.precoUnitarioEstimado) : "—"}
          </p>
          <p className="text-xs text-neutral-500 mt-1">Preço unit. estimado</p>
        </div>
      </div>

      {/* Preço total */}
      {pesquisa.precoTotalEstimado && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-800">Preço total estimado</p>
            <p className="text-xs text-blue-600">{pesquisa.quantidade} {pesquisa.unidadeMedida} × {formatarMoeda(pesquisa.precoUnitarioEstimado)}</p>
          </div>
          <p className="text-2xl font-bold text-blue-800">{formatarMoeda(pesquisa.precoTotalEstimado)}</p>
        </div>
      )}

      {/* Referências aceitas */}
      {aceitos.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white mb-6">
          <div className="flex items-center gap-2 p-4 border-b border-neutral-100">
            <Check className="w-4 h-4 text-green-500" />
            <h2 className="text-sm font-medium">Referências aceitas ({aceitos.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Órgão</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Descrição</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Qtd</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Valor unit.</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Fonte</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Sim.</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Link</th>
                </tr>
              </thead>
              <tbody>
                {aceitos.map(r => (
                  <tr key={r.id} className="border-t border-neutral-100 bg-green-50/20">
                    <td className="px-4 py-2 text-xs">{r.orgao}</td>
                    <td className="px-4 py-2 text-xs max-w-[200px] truncate" title={r.descricao}>{r.descricao}</td>
                    <td className="px-4 py-2 text-xs">{r.quantidade ?? "—"}</td>
                    <td className="px-4 py-2 text-xs font-medium">{formatarMoeda(r.valorUnitario)}</td>
                    <td className="px-4 py-2 text-xs font-mono">{r.fonte?.toUpperCase()}</td>
                    <td className="px-4 py-2 text-xs">{r.similaridade}%</td>
                    <td className="px-4 py-2 text-xs">
                      {r.linkEdital ? (
                        <a href={r.linkEdital} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
                          <ExternalLink className="w-3 h-3" /> Ver
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pendentes */}
      {pendentes.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white mb-6">
          <div className="flex items-center justify-between p-4 border-b border-neutral-100">
            <h2 className="text-sm font-medium">Referências pendentes de avaliação ({pendentes.length})</h2>
            <Link href={`/pesquisa/nova`} className="text-xs text-blue-600 hover:text-blue-800">Avaliar →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Órgão</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Descrição</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Valor unit.</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Fonte</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Sim.</th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map(r => (
                  <tr key={r.id} className="border-t border-neutral-100">
                    <td className="px-4 py-2 text-xs">{r.orgao}</td>
                    <td className="px-4 py-2 text-xs max-w-[200px] truncate">{r.descricao}</td>
                    <td className="px-4 py-2 text-xs font-medium">{formatarMoeda(r.valorUnitario)}</td>
                    <td className="px-4 py-2 text-xs font-mono">{r.fonte?.toUpperCase()}</td>
                    <td className="px-4 py-2 text-xs">{r.similaridade}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evidências */}
      {pesquisa.evidencias.length > 0 && (
        <div className="rounded-xl border border-neutral-200 bg-white mb-6">
          <div className="flex items-center gap-2 p-4 border-b border-neutral-100">
            <Paperclip className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-medium">Evidências ({pesquisa.evidencias.length})</h2>
          </div>
          <ul className="p-4 space-y-2">
            {pesquisa.evidencias.map(ev => (
              <li key={ev.id} className="flex items-center gap-2 text-sm">
                <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 truncate">
                  {ev.nome}
                </a>
                <span className="text-xs text-neutral-400 flex-shrink-0">{ev.tipo}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Info do processo */}
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-medium mb-3">Informações do processo</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-neutral-500">Processo</p><p className="font-medium">{pesquisa.processo.numero}</p></div>
          <div><p className="text-xs text-neutral-500">Quantidade</p><p className="font-medium">{pesquisa.quantidade} {pesquisa.unidadeMedida}</p></div>
          <div><p className="text-xs text-neutral-500">Método de cálculo</p><p className="font-medium">{pesquisa.metodoCalculo?.replace(/_/g, " ") || "—"}</p></div>
          <div><p className="text-xs text-neutral-500">Criada em</p><p className="font-medium">{new Date(pesquisa.createdAt).toLocaleDateString("pt-BR")}</p></div>
        </div>
      </div>
    </div>
  );
}
