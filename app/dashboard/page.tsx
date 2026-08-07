"use client";
import React from "react";
import Link from "next/link";
import { TrendingUp, Activity, CheckCircle, DollarSign, ArrowRight } from "lucide-react";

const MOCK_ATIVIDADES = [
  { processo: "2025/001", objeto: "Aquisicao de notebooks", status: "concluido" as const, data: "05/08/2026", responsavel: "Ana Costa" },
  { processo: "2025/002", objeto: "Contratacao de servicos de limpeza", status: "em_analise" as const, data: "04/08/2026", responsavel: "Bruno Lima" },
  { processo: "2025/003", objeto: "Aquisicao de mobiliario", status: "pesquisando" as const, data: "03/08/2026", responsavel: "Carla Dias" },
];

function sb(s: string) {
  const map: Record<string, string> = { concluido: "bg-green-50 text-green-700 border-green-200", em_analise: "bg-amber-50 text-amber-700 border-amber-200", pesquisando: "bg-blue-50 text-blue-700 border-blue-200" };
  const t: Record<string, string> = { concluido: "concluido", em_analise: "em analise", pesquisando: "pesquisando" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded border ${map[s]}`}>{t[s]}</span>;
}

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Dashboard</h1>
        <span className="text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">DEMONSTRACAO</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Activity} label="pesquisas no mes" value="12" />
        <StatCard icon={TrendingUp} label="processos ativos" value="8" />
        <StatCard icon={CheckCircle} label="taxa de aprovacao" value="94%" />
        <StatCard icon={DollarSign} label="valor estimado" value="R$ 2,4M" />
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-medium">Atividades recentes</h2>
          <Link href="/processos" className="text-sm text-neutral-600 hover:text-neutral-900 flex items-center gap-1">Ver todos <ArrowRight className="w-4 h-4" /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Processo</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Objeto</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Status</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Data</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Responsavel</th>
            </tr></thead>
            <tbody>
              {MOCK_ATIVIDADES.map((a, i) => (
                <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-xs">{a.processo}</td>
                  <td className="py-2.5 px-3">{a.objeto}</td>
                  <td className="py-2.5 px-3">{sb(a.status)}</td>
                  <td className="py-2.5 px-3 text-neutral-500">{a.data}</td>
                  <td className="py-2.5 px-3">{a.responsavel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-2"><div className="p-2 rounded-lg bg-neutral-100"><Icon className="w-4 h-4 text-neutral-600" /></div></div>
      <span className="block text-2xl font-medium tabular-nums">{value}</span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}
