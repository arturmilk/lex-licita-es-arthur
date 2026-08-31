"use client";
import React, { useEffect, useState } from "react";
import { Loader2, FileText, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { listarProcessos } from "@/lib/actions";

interface ProcessoRow {
  id: string;
  numero: string;
  objeto: string;
  unidade: string | null;
  status: string;
  updatedAt: Date | string;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  rascunho:    { label: "Rascunho",    cls: "bg-slate-100 text-slate-600 border-slate-200" },
  pesquisando: { label: "Pesquisando", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  estimado:    { label: "Estimado",    cls: "bg-amber-50 text-amber-700 border-amber-200" },
  concluido:   { label: "Concluído",   cls: "bg-green-50 text-green-700 border-green-200" },
  cancelado:   { label: "Cancelado",   cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function ProcessosPage() {
  const [rows, setRows] = useState<ProcessoRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarProcessos()
      .then((r) => setRows(r as unknown as ProcessoRow[]))
      .catch((e) => setErro(String(e?.message || e)));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Processos</h1>
          <p className="text-sm text-slate-500 mt-0.5">Processos licitatórios vinculados ao órgão</p>
        </div>
        <Link
          href="/pesquisa/nova"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#032650] text-white text-sm font-medium hover:bg-[#032650] transition-colors"
        >
          <Plus className="w-4 h-4" /> Nova pesquisa
        </Link>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Erro: {erro}</div>
      )}

      {/* Métricas estilo dashboard */}
      {rows && rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl bg-[#032650] text-white p-5 shadow-sm">
            <p className="text-white/60 text-[11px] font-medium uppercase tracking-wide">Total de processos</p>
            <p className="text-4xl font-bold mt-1 tabular-nums">{rows.length}</p>
            <p className="text-white/50 text-xs mt-1">no órgão</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wide">Rascunho</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{rows.filter(r => r.status === "rascunho").length}</p>
            <p className="text-slate-400 text-xs mt-1">em início</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-blue-500 text-[11px] font-medium uppercase tracking-wide">Pesquisando</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{rows.filter(r => r.status === "pesquisando").length}</p>
            <p className="text-slate-400 text-xs mt-1">em andamento</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-green-500 text-[11px] font-medium uppercase tracking-wide">Concluídos</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{rows.filter(r => r.status === "concluido").length}</p>
            <p className="text-slate-400 text-xs mt-1">finalizados</p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {rows === null ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Nenhum processo encontrado</p>
              <p className="text-xs text-slate-400 mt-1">Os processos são criados automaticamente ao iniciar uma pesquisa</p>
            </div>
            <Link href="/pesquisa/nova" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#032650] text-white text-sm font-medium hover:bg-[#032650] transition-colors">
              <Plus className="w-4 h-4" /> Iniciar pesquisa
            </Link>
          </div>
        ) : (
          <>
            {/* Versão mobile: cartões empilhados */}
            <div className="md:hidden divide-y divide-slate-100">
              {rows.map((r) => {
                const st = STATUS_CFG[r.status] || { label: r.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                return (
                  <div key={r.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs text-slate-600 font-medium">{r.numero}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-medium shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-sm text-slate-800 mb-1" title={r.objeto}>{r.objeto}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-500">{r.unidade || "—"} · {new Date(r.updatedAt).toLocaleDateString("pt-BR")}</span>
                      <Link href={`/processos/${r.id}/jornada`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#032650] hover:text-indigo-800 shrink-0">
                        Guiar <ChevronRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Versão desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Número", "Objeto", "Unidade", "Status", "Atualizado", "Ação"].map(h => (
                      <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => {
                    const st = STATUS_CFG[r.status] || { label: r.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-4 font-mono text-xs text-slate-600 font-medium">{r.numero}</td>
                        <td className="py-2.5 px-4 max-w-[360px] truncate text-slate-800" title={r.objeto}>{r.objeto}</td>
                        <td className="py-2.5 px-4 text-slate-500 text-xs">{r.unidade || "—"}</td>
                        <td className="py-2.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${st.cls}`}>{st.label}</span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-500 text-xs">{new Date(r.updatedAt).toLocaleDateString("pt-BR")}</td>
                        <td className="py-2.5 px-4">
                          <Link href={`/processos/${r.id}/jornada`} className="inline-flex items-center gap-1 text-xs font-semibold text-[#032650] hover:text-indigo-800">
                            Guiar <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
