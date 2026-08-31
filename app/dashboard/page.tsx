"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Plus } from "lucide-react";
import { listarDashboard } from "@/lib/actions";

type DashData = Awaited<ReturnType<typeof listarDashboard>>;

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  concluida:    { label: "Concluída",     cls: "bg-green-50 text-green-700 border-green-200" },
  em_andamento: { label: "Em andamento",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  cancelada:    { label: "Cancelada",     cls: "bg-red-50 text-red-700 border-red-200" },
};

function fmtMoeda(v: number) {
  if (v === 0) return "—";
  return v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`
    : `R$ ${(v / 1_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}k`;
}

function fmtData(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarDashboard()
      .then(setData)
      .catch(e => setErro(String(e?.message || e)));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
        <Link href="/pesquisa/nova" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#032650] text-white text-sm font-medium hover:bg-[#032650] transition-colors">
          <Plus className="w-4 h-4" /> Nova pesquisa
        </Link>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Erro ao carregar dados: {erro}
        </div>
      )}

      {/* Stat cards — formato dashboard (números grandes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="rounded-2xl bg-[#032650] text-white p-5 shadow-sm">
          <p className="text-white/60 text-[11px] font-medium uppercase tracking-wide">Total de pesquisas</p>
          {!data ? <div className="h-9 w-14 rounded bg-white/20 animate-pulse mt-1" /> : <p className="text-4xl font-bold mt-1 tabular-nums">{data.total}</p>}
          <p className="text-white/50 text-xs mt-1">realizadas</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-blue-500 text-[11px] font-medium uppercase tracking-wide">Em andamento</p>
          {!data ? <div className="h-9 w-14 rounded bg-slate-100 animate-pulse mt-1" /> : <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{data.emAndamento}</p>}
          <p className="text-slate-400 text-xs mt-1">ativas</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-green-500 text-[11px] font-medium uppercase tracking-wide">Concluídas</p>
          {!data ? <div className="h-9 w-14 rounded bg-slate-100 animate-pulse mt-1" /> : <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{data.concluidas}</p>}
          <p className="text-slate-400 text-xs mt-1">finalizadas</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-amber-500 text-[11px] font-medium uppercase tracking-wide">Valor total estimado</p>
          {!data ? <div className="h-9 w-20 rounded bg-slate-100 animate-pulse mt-1" /> : <p className="text-3xl font-bold mt-1 text-slate-800 tabular-nums">{fmtMoeda(data.valorTotal)}</p>}
          <p className="text-slate-400 text-xs mt-1">em contratações</p>
        </div>
      </div>

      {/* Atividades recentes */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Pesquisas recentes</h2>
          <Link href="/pesquisas" className="text-sm text-[#032650] hover:text-indigo-800 flex items-center gap-1 font-medium">
            Ver todas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {!data ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : data.pesquisasRecentes.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-500 mb-4">Nenhuma pesquisa realizada ainda.</p>
            <Link href="/pesquisa/nova" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#032650] text-white text-sm font-medium hover:bg-[#032650]">
              <Plus className="w-4 h-4" /> Iniciar primeira pesquisa
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Processo", "Objeto", "Status", "Valor estimado", "Data", "Responsável"].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.pesquisasRecentes.map(a => {
                  const st = STATUS_MAP[a.status] || { label: a.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                  const valor = a.precoTotalEstimado
                    ? `R$ ${Number(a.precoTotalEstimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "—";
                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{a.processoNumero || "—"}</td>
                      <td className="py-2.5 px-4 max-w-[260px] truncate" title={a.objeto}>{a.objeto}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs">{valor}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-xs">{fmtData(a.createdAt)}</td>
                      <td className="py-2.5 px-4 text-slate-500">{a.usuarioNome || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
