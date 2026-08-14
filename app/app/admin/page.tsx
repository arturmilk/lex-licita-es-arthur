"use client";
import React, { useState, useEffect } from "react";
import { Users, Settings, Save, Activity, Copy, RefreshCw, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface MonitorData {
  logs: string;
  pesquisas: any[];
  sessoes: any[];
  usuarios: any[];
  horario: string;
}

export default function AdminPage() {
  const [similaridadeMinima, setSimilaridadeMinima] = useState(75);
  const [cvAlerta, setCvAlerta] = useState(25);
  const [periodoPadrao, setPeriodoPadrao] = useState("12_meses");
  const [metodoPadrao, setMetodoPadrao] = useState("media_aritmetica");
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [monitorErro, setMonitorErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const carregarMonitor = () => {
    setMonitorErro(null);
    fetch("/api/admin/logs")
      .then((r) => r.json())
      .then((d) => {
        if (d?.error) setMonitorErro(d.error);
        else setMonitor(d);
      })
      .catch((e) => setMonitorErro(String(e?.message || e)));
  };

  useEffect(carregarMonitor, []);

  const copiarLogs = async () => {
    if (!monitor?.logs) return;
    try {
      await navigator.clipboard.writeText(monitor.logs);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      alert("Selecione e copie manualmente (Ctrl+C).");
    }
  };

  const fmtMoeda = (v: string | null) => (v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  const fmtData = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const linhasErro = (monitor?.logs || "").split("\n").filter((l) => l.includes("\"ok\":false") || l.includes("erro")).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Administracao</h1>
        <span className="text-xs text-neutral-400">Ultima atualizacao: {monitor ? fmtData(monitor.horario) : "—"}</span>
      </div>

      {/* MONITORAMENTO */}
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-neutral-600" />
            <h2 className="text-base font-medium">Monitoramento do sistema</h2>
          </div>
          <button onClick={carregarMonitor} className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded border border-neutral-200">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>

        {monitorErro && <p className="text-sm text-red-600 mb-3">{monitorErro}</p>}
        {!monitor && !monitorErro && (
          <div className="flex items-center gap-2 text-neutral-400 text-sm py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando monitor...
          </div>
        )}

        {monitor && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Pesquisas no sistema</p>
                <p className="text-2xl font-semibold">{monitor.pesquisas.length}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Sessoes de agentes</p>
                <p className="text-2xl font-semibold">{monitor.sessoes.length}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
                <p className="text-xs text-neutral-500">Utilizadores</p>
                <p className="text-2xl font-semibold">{monitor.usuarios.length}</p>
              </div>
              <div className={`rounded-lg border p-3 ${linhasErro > 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
                <p className="text-xs text-neutral-500">Erros nos logs</p>
                <p className={`text-2xl font-semibold ${linhasErro > 0 ? "text-red-600" : "text-green-600"}`}>{linhasErro}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border border-neutral-200 overflow-hidden">
                <h3 className="text-xs font-medium text-neutral-500 uppercase px-3 py-2 bg-neutral-50 border-b border-neutral-200">Pesquisas recentes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-neutral-100">
                      <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs">Processo</th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs">Objeto</th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs">Total</th>
                    </tr></thead>
                    <tbody>
                      {(monitor.pesquisas || []).map((p) => (
                        <tr key={p.id} className="border-b border-neutral-100">
                          <td className="py-2 px-3 font-mono text-xs">{p.processoNumero || "—"}</td>
                          <td className="py-2 px-3 max-w-[160px] truncate" title={p.objeto}>{p.objeto}</td>
                          <td className="py-2 px-3"><span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">{p.status}</span></td>
                          <td className="py-2 px-3 text-xs">{fmtMoeda(p.precoTotalEstimado)}</td>
                        </tr>
                      ))}
                      {(monitor.pesquisas || []).length === 0 && <tr><td colSpan={4} className="py-6 text-center text-xs text-neutral-400">Sem pesquisas</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 overflow-hidden">
                <h3 className="text-xs font-medium text-neutral-500 uppercase px-3 py-2 bg-neutral-50 border-b border-neutral-200">Sessoes de agentes</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-neutral-100">
                      <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs">Agente</th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs">Fonte</th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs">Status</th>
                      <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs">Total</th>
                    </tr></thead>
                    <tbody>
                      {(monitor.sessoes || []).map((s) => (
                        <tr key={s.id} className="border-b border-neutral-100">
                          <td className="py-2 px-3">{s.nomeAgente}</td>
                          <td className="py-2 px-3 text-xs text-neutral-500">{s.fonte}</td>
                          <td className="py-2 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded ${s.status === "concluido" ? "bg-green-100 text-green-700" : s.status === "erro" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{s.status}</span>
                          </td>
                          <td className="py-2 px-3 text-xs">{s.totalEncontrado ?? "—"}</td>
                        </tr>
                      ))}
                      {(monitor.sessoes || []).length === 0 && <tr><td colSpan={4} className="py-6 text-center text-xs text-neutral-400">Sem sessoes</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-neutral-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 border-b border-neutral-200">
                <h3 className="text-xs font-medium text-neutral-500 uppercase">Logs do sistema (copie e cole para analise)</h3>
                <button onClick={copiarLogs} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
                  <Copy className="w-3.5 h-3.5" /> {copiado ? "Copiado!" : "Copiar logs"}
                </button>
              </div>
              <pre className="text-[11px] leading-relaxed font-mono text-neutral-700 bg-neutral-50 p-3 max-h-72 overflow-auto whitespace-pre-wrap">
                {monitor.logs || "(sem logs ainda — execute uma pesquisa para gerar atividade)"}
              </pre>
            </div>
          </>
        )}
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
              {(monitor?.usuarios || []).map(u => (
                <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3">{u.nome}</td>
                  <td className="py-2.5 px-3 text-neutral-500 text-xs">{u.email}</td>
                  <td className="py-2.5 px-3"><span className={`text-xs font-medium px-2 py-0.5 rounded border ${u.perfil === "administrador" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{u.perfil}</span></td>
                  <td className="py-2.5 px-3"><span className={`text-xs font-medium px-2 py-0.5 rounded border ${u.ativo ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>{u.ativo ? "ativo" : "inativo"}</span></td>
                </tr>
              ))}
              {(monitor?.usuarios || []).length === 0 && <tr><td colSpan={4} className="py-6 text-center text-xs text-neutral-400">Sem utilizadores</td></tr>}
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
