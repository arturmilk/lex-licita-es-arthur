"use client";
import React, { useEffect, useState } from "react";
import { BarChart3, AlertTriangle, Users, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { obterPainelGestor } from "@/lib/actions-intencao";

export default function PainelGestorPage() {
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterPainelGestor().then(setDados).catch((e) => setErro(String(e?.message || e)));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Visão do gestor</h1>
        <p className="text-sm text-slate-500">Gargalos, atrasos, carga de trabalho e produtividade — sem cobrar por WhatsApp.</p>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      {!dados && !erro && (
        <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      )}

      {dados && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total de tarefas", valor: dados.totalTarefas, icon: BarChart3, cor: "text-[#032650] bg-[#eef2f8]" },
              { label: "Atrasadas", valor: dados.atrasadas.length, icon: AlertTriangle, cor: "text-red-600 bg-red-50" },
              { label: "Aguardando outro", valor: dados.aguardandoOutro.length, icon: Users, cor: "text-purple-600 bg-purple-50" },
              { label: "Paradas 5+ dias", valor: dados.paradas.length, icon: Clock, cor: "text-amber-600 bg-amber-50" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <c.icon size={18} className={`p-1 rounded-lg ${c.cor}`} />
                <p className="text-xl font-bold text-slate-800 mt-1">{c.valor}</p>
                <p className="text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Produtividade */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                <CheckCircle2 size={15} className="text-green-600" /> Produtividade da equipe
              </h3>
              <span className="text-xs text-slate-500">{dados.conclusao} concluídas · taxa {dados.taxaConclusao}%</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-green-500" style={{ width: `${dados.taxaConclusao}%` }} />
            </div>
          </div>

          {/* Carga por servidor */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm mb-3">
              <Users size={15} className="text-[#032650]" /> Carga de trabalho por servidor
            </h3>
            {dados.carga.length === 0 ? (
              <p className="text-sm text-slate-400 py-3">Nenhum servidor com tarefas ativas.</p>
            ) : (
              <div className="space-y-2">
                {dados.carga.map((c: any) => (
                  <div key={c.nome} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.nome}</p>
                      <p className="text-xs text-slate-500">{c.cargo || "Servidor"}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-[#032650] font-semibold">{c.ativas} ativas</span>
                      <span className="text-green-600 font-semibold">{c.concluidas} concluídas</span>
                      {c.atrasadas > 0 && <span className="text-red-600 font-semibold">{c.atrasadas} atrasadas</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gargalos: aguardando outro + paradas */}
          {(dados.aguardandoOutro.length > 0 || dados.paradas.length > 0) && (
            <div className="grid md:grid-cols-2 gap-4">
              {dados.aguardandoOutro.length > 0 && (
                <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-purple-700 text-sm mb-3">Aguardando outra pessoa (gargalo)</h3>
                  <div className="space-y-2">
                    {dados.aguardandoOutro.map((t: any) => (
                      <div key={t.id} className="rounded-lg bg-purple-50 px-3 py-2 text-sm text-slate-700">{t.titulo}</div>
                    ))}
                  </div>
                </div>
              )}
              {dados.paradas.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
                  <h3 className="font-semibold text-amber-700 text-sm mb-3">Processos parados 5+ dias</h3>
                  <div className="space-y-2">
                    {dados.paradas.map((t: any) => (
                      <div key={t.id} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-slate-700">{t.titulo}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
