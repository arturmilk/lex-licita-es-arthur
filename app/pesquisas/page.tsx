"use client";
import React, { useEffect, useState } from "react";
import { Search, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { listarPesquisas } from "@/lib/actions";

interface PesquisaRow {
  id: string;
  objeto: string;
  quantidade: number;
  status: string;
  precoUnitarioEstimado: string | null;
  precoTotalEstimado: string | null;
  createdAt: Date | string;
  processoNumero: string | null;
  referenciasAceitas: number;
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  em_andamento: { label: "Em andamento", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  concluida:    { label: "Concluída",    cls: "bg-green-50 text-green-700 border-green-200" },
  cancelada:    { label: "Cancelada",    cls: "bg-red-50 text-red-700 border-red-200" },
};

export default function PesquisasPage() {
  const [rows, setRows] = useState<PesquisaRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarPesquisas()
      .then((r) => setRows(r as unknown as PesquisaRow[]))
      .catch((e) => setErro(String(e?.message || e)));
  }, []);

  const fmt = (v: string | null) =>
    v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtData = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR");

  const concluidas = rows?.filter(r => r.status === "concluida").length ?? 0;
  const emAndamento = rows?.filter(r => r.status === "em_andamento").length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Pesquisas</h1>
          <p className="text-sm text-slate-500 mt-0.5">Histórico de pesquisas de preços realizadas</p>
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

      {rows !== null && rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl bg-[#032650] text-white p-5 shadow-sm">
            <p className="text-white/60 text-[11px] font-medium uppercase tracking-wide">Total de pesquisas</p>
            <p className="text-4xl font-bold mt-1 tabular-nums">{rows.length}</p>
            <p className="text-white/50 text-xs mt-1">realizadas</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-blue-500 text-[11px] font-medium uppercase tracking-wide">Em andamento</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{emAndamento}</p>
            <p className="text-slate-400 text-xs mt-1">ativas</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-green-500 text-[11px] font-medium uppercase tracking-wide">Concluídas</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{concluidas}</p>
            <p className="text-slate-400 text-xs mt-1">finalizadas</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-amber-500 text-[11px] font-medium uppercase tracking-wide">Referências aceitas</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{rows.reduce((s, r) => s + (r.referenciasAceitas || 0), 0)}</p>
            <p className="text-slate-400 text-xs mt-1">no total</p>
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
              <Search className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Nenhuma pesquisa realizada</p>
              <p className="text-xs text-slate-400 mt-1">Inicie uma nova pesquisa de preços para começar</p>
            </div>
            <Link href="/pesquisa/nova" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#032650] text-white text-sm font-medium hover:bg-[#032650] transition-colors">
              <Plus className="w-4 h-4" /> Iniciar pesquisa
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Processo", "Objeto", "Refs. aceitas", "Preço estimado", "Status", "Data"].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const st = STATUS_CFG[r.status] || { label: r.status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600 font-medium">{r.processoNumero || "—"}</td>
                      <td className="py-2.5 px-4 max-w-[300px] truncate text-slate-800" title={r.objeto}>{r.objeto}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">{r.referenciasAceitas}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-700">{fmt(r.precoTotalEstimado)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-xs">{fmtData(r.createdAt)}</td>
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
