"use client";
import React, { useState } from "react";
import { Users, Settings, Save } from "lucide-react";

const MOCK_USUARIOS = [
  { id: "1", nome: "Ana Costa", email: "ana.costa@planejamento.gov.br", perfil: "pesquisador" as const, ativo: true },
  { id: "2", nome: "Bruno Lima", email: "bruno.lima@planejamento.gov.br", perfil: "pesquisador" as const, ativo: true },
  { id: "3", nome: "Carla Dias", email: "carla.dias@planejamento.gov.br", perfil: "administrador" as const, ativo: true },
];

export default function AdminPage() {
  const [similaridadeMinima, setSimilaridadeMinima] = useState(75);
  const [cvAlerta, setCvAlerta] = useState(25);
  const [periodoPadrao, setPeriodoPadrao] = useState("12_meses");
  const [metodoPadrao, setMetodoPadrao] = useState("media_aritmetica");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Administracao</h1>
        <span className="text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">DEMONSTRACAO</span>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-neutral-600" />
          <h2 className="text-base font-medium">Usuarios do orgao</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Nome</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">E-mail</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Perfil</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Status</th>
            </tr></thead>
            <tbody>
              {MOCK_USUARIOS.map(u => (
                <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3">{u.nome}</td>
                  <td className="py-2.5 px-3 text-neutral-500 text-xs">{u.email}</td>
                  <td className="py-2.5 px-3"><span className={`text-xs font-medium px-2 py-0.5 rounded border ${u.perfil === "administrador" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{u.perfil}</span></td>
                  <td className="py-2.5 px-3"><span className="text-xs font-medium px-2 py-0.5 rounded border bg-green-50 text-green-700 border-green-200">{u.ativo ? "ativo" : "inativo"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-neutral-600" />
          <h2 className="text-base font-medium">Configuracoes do sistema</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Similaridade minima (%)</label>
            <input type="number" min={0} max={100} className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400" value={similaridadeMinima} onChange={e => setSimilaridadeMinima(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">CV - alerta (%)</label>
            <input type="number" min={0} max={100} className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400" value={cvAlerta} onChange={e => setCvAlerta(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Periodo padrao</label>
            <select className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm bg-white" value={periodoPadrao} onChange={e => setPeriodoPadrao(e.target.value)}>
              <option value="6_meses">Ultimos 6 meses</option><option value="12_meses">Ultimos 12 meses</option><option value="24_meses">Ultimos 24 meses</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Metodo padrao</label>
            <select className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm bg-white" value={metodoPadrao} onChange={e => setMetodoPadrao(e.target.value)}>
              <option value="media_aritmetica">Media aritmetica</option><option value="mediana">Mediana</option><option value="media_ponderada">Media ponderada</option><option value="menor_preco">Menor preco</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={() => alert("Configuracoes salvas")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800">
            <Save className="w-4 h-4" /> Salvar configuracoes
          </button>
        </div>
      </div>
    </div>
  );
}
