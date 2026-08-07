"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Search, Plus } from "lucide-react";

const MOCK_PROCESSOS = [
  { numero: "2026/0042", objeto: "Aquisicao de notebooks", status: "pesquisando" as const, responsavel: "Ana Costa", atualizado: "06/08/2026" },
  { numero: "2026/0038", objeto: "Servicos de consultoria em TI", status: "estimado" as const, responsavel: "Bruno Lima", atualizado: "05/08/2026" },
  { numero: "2026/0035", objeto: "Aquisicao de mobiliario", status: "cancelado" as const, responsavel: "Carla Dias", atualizado: "01/08/2026" },
];

function sb(s: string) {
  const map: Record<string, string> = { pesquisando: "bg-blue-50 text-blue-700 border-blue-200", estimado: "bg-green-50 text-green-700 border-green-200", cancelado: "bg-red-50 text-red-700 border-red-200" };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded border ${map[s]}`}>{s}</span>;
}

export default function ProcessosPage() {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const filtrados = MOCK_PROCESSOS.filter(p => (busca === "" || p.numero.includes(busca) || p.objeto.toLowerCase().includes(busca.toLowerCase())) && (filtro === "todos" || p.status === filtro));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Processos</h1>
        <span className="text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">DEMONSTRACAO</span>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input type="text" placeholder="Buscar processo..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400" value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <select className="px-3 py-2 rounded-lg border border-neutral-200 text-sm bg-white" value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option value="todos">Todos</option><option value="pesquisando">Pesquisando</option><option value="estimado">Estimado</option><option value="cancelado">Cancelado</option>
            </select>
            <Link href="/pesquisa/nova" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800"><Plus className="w-4 h-4" /> Novo</Link>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Numero</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Objeto</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Status</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Responsavel</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Atualizado</th>
            </tr></thead>
            <tbody>
              {filtrados.map((p, i) => (
                <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-xs">{p.numero}</td>
                  <td className="py-2.5 px-3">{p.objeto}</td>
                  <td className="py-2.5 px-3">{sb(p.status)}</td>
                  <td className="py-2.5 px-3">{p.responsavel}</td>
                  <td className="py-2.5 px-3 text-neutral-500">{p.atualizado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
