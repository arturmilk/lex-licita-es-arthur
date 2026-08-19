"use client";
import React, { useState, useEffect } from "react";
import { Users, Settings, Save, Activity, Copy, RefreshCw, CheckCircle2, Loader2, ShieldAlert, UserPlus, MessageCircle, Eye, EyeOff } from "lucide-react";
import { listarUsuarios, criarUsuario, ativarDesativarUsuario, listarFeedbacks, marcarFeedbackLido } from "@/app/lib/admin-actions";

interface MonitorData {
  logs: string;
  pesquisas: any[];
  sessoes: any[];
  usuarios: any[];
  horario: string;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function CardHeader({ title, icon: Icon, action }: { title: string; icon: React.ElementType; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-indigo-600" />
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function StatBox({ label, value, cls = "" }: { label: string; value: React.ReactNode; cls?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function Inp({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <input className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" {...props} />
    </div>
  );
}

function Sel({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <select className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition" {...props}>
        {children}
      </select>
    </div>
  );
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  cargo: string | null;
  matricula: string | null;
  ativo: boolean;
  createdAt: Date;
}

interface Feedback {
  id: string;
  mensagem: string;
  pagina: string | null;
  lido: boolean;
  createdAt: Date;
  usuarioNome: string;
}

export default function AdminPage() {
  const [similaridadeMinima, setSimilaridadeMinima] = useState(75);
  const [cvAlerta, setCvAlerta] = useState(25);
  const [periodoPadrao, setPeriodoPadrao] = useState("12_meses");
  const [metodoPadrao, setMetodoPadrao] = useState("media_aritmetica");
  const [monitor, setMonitor] = useState<MonitorData | null>(null);
  const [monitorErro, setMonitorErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [configSalva, setConfigSalva] = useState<boolean | null>(null);
  const [configErro, setConfigErro] = useState<string | null>(null);

  // Usuários
  const [listaUsuarios, setListaUsuarios] = useState<Usuario[]>([]);
  const [mostrarFormUsuario, setMostrarFormUsuario] = useState(false);
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", email: "", senha: "", perfil: "pesquisador" as const, cargo: "", matricula: "" });
  const [criandoUsuario, setCriandoUsuario] = useState(false);
  const [usuarioErro, setUsuarioErro] = useState<string | null>(null);
  const [usuarioSucesso, setUsuarioSucesso] = useState(false);

  // Feedbacks
  const [listaFeedbacks, setListaFeedbacks] = useState<Feedback[]>([]);
  const [carregandoFeedbacks, setCarregandoFeedbacks] = useState(false);

  const carregarMonitor = () => {
    setMonitorErro(null);
    fetch("/api/admin/logs")
      .then((r) => r.json())
      .then((d) => { if (d?.error) setMonitorErro(d.error); else setMonitor(d); })
      .catch((e) => setMonitorErro(String(e?.message || e)));
  };

  const carregarConfig = () => {
    fetch("/api/admin/configuracoes")
      .then(r => r.json())
      .then(d => {
        if (d.similaridadeMinima != null) setSimilaridadeMinima(d.similaridadeMinima);
        if (d.cvAlerta != null) setCvAlerta(d.cvAlerta);
        if (d.periodoPadrao) setPeriodoPadrao(d.periodoPadrao);
        if (d.metodoPadrao) setMetodoPadrao(d.metodoPadrao);
      })
      .catch(() => {});
  };

  const salvarConfig = async () => {
    setSalvandoConfig(true); setConfigSalva(null); setConfigErro(null);
    try {
      const res = await fetch("/api/admin/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ similaridadeMinima, cvAlerta, periodoPadrao, metodoPadrao }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Erro ao salvar");
      setConfigSalva(true);
      setTimeout(() => setConfigSalva(null), 3000);
    } catch (e: any) {
      setConfigErro(String(e?.message || e));
    } finally {
      setSalvandoConfig(false);
    }
  };

  const carregarUsuarios = () => {
    listarUsuarios().then(setListaUsuarios).catch(() => {});
  };

  const handleCriarUsuario = async () => {
    if (!novoUsuario.nome || !novoUsuario.email || !novoUsuario.senha) {
      setUsuarioErro("Nome, e-mail e senha são obrigatórios");
      return;
    }
    setCriandoUsuario(true);
    setUsuarioErro(null);
    try {
      await criarUsuario(novoUsuario);
      setUsuarioSucesso(true);
      setNovoUsuario({ nome: "", email: "", senha: "", perfil: "pesquisador", cargo: "", matricula: "" });
      setMostrarFormUsuario(false);
      carregarUsuarios();
      setTimeout(() => setUsuarioSucesso(false), 3000);
    } catch (e: any) {
      setUsuarioErro(String(e?.message || "Erro ao criar usuário"));
    } finally {
      setCriandoUsuario(false);
    }
  };

  const handleAtivarDesativar = async (id: string, ativo: boolean) => {
    await ativarDesativarUsuario(id, !ativo).catch(() => {});
    carregarUsuarios();
  };

  const carregarFeedbacks = () => {
    setCarregandoFeedbacks(true);
    listarFeedbacks().then(setListaFeedbacks).catch(() => {}).finally(() => setCarregandoFeedbacks(false));
  };

  const handleMarcarLido = async (id: string) => {
    await marcarFeedbackLido(id).catch(() => {});
    carregarFeedbacks();
  };

  useEffect(() => { carregarMonitor(); carregarConfig(); carregarUsuarios(); carregarFeedbacks(); }, []);

  const copiarLogs = async () => {
    if (!monitor?.logs) return;
    try {
      await navigator.clipboard.writeText(monitor.logs);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { alert("Selecione e copie manualmente (Ctrl+C)."); }
  };

  const fmtMoeda = (v: string | null) => v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtData = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const linhasErro = (monitor?.logs || "").split("\n").filter(l => l.includes('"ok":false') || l.includes("erro")).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Administração</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {monitor ? `Última atualização: ${fmtData(monitor.horario)}` : "Carregando..."}
          </p>
        </div>
      </div>

      {/* Monitoramento */}
      <Card>
        <CardHeader
          title="Monitoramento do sistema"
          icon={Activity}
          action={
            <button
              onClick={carregarMonitor}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
          }
        />
        <div className="p-6">
          {monitorErro && (
            <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <ShieldAlert className="w-4 h-4 shrink-0" /> {monitorErro}
            </div>
          )}
          {!monitor && !monitorErro ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : monitor && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatBox label="Pesquisas" value={monitor.pesquisas.length} />
                <StatBox label="Sessões de agentes" value={monitor.sessoes.length} />
                <StatBox label="Usuários" value={monitor.usuarios.length} />
                <StatBox
                  label="Erros nos logs"
                  value={linhasErro}
                  cls={linhasErro > 0 ? "text-red-600" : "text-green-600"}
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pesquisas recentes */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pesquisas recentes</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100">
                      <tr>
                        {["Processo", "Objeto", "Status", "Total"].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-medium text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {monitor.pesquisas.length === 0 ? (
                        <tr><td colSpan={4} className="py-6 text-center text-xs text-slate-400">Sem pesquisas</td></tr>
                      ) : monitor.pesquisas.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono text-xs">{p.processoNumero || "—"}</td>
                          <td className="py-2 px-3 max-w-[140px] truncate text-xs" title={p.objeto}>{p.objeto}</td>
                          <td className="py-2 px-3">
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">{p.status}</span>
                          </td>
                          <td className="py-2 px-3 text-xs font-mono">{fmtMoeda(p.precoTotalEstimado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sessões */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sessões de agentes</p>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100">
                      <tr>
                        {["Agente", "Fonte", "Status", "Total"].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-xs font-medium text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {monitor.sessoes.length === 0 ? (
                        <tr><td colSpan={4} className="py-6 text-center text-xs text-slate-400">Sem sessões</td></tr>
                      ) : monitor.sessoes.map((s) => (
                        <tr key={s.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-xs">{s.nomeAgente}</td>
                          <td className="py-2 px-3 text-xs text-slate-500">{s.fonte}</td>
                          <td className="py-2 px-3">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${s.status === "concluido" ? "bg-green-100 text-green-700" : s.status === "erro" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-xs">{s.totalEncontrado ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Logs */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Logs do sistema</p>
                  <button onClick={copiarLogs} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                    <Copy className="w-3.5 h-3.5" /> {copiado ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <pre className="text-[11px] leading-relaxed font-mono text-slate-700 bg-slate-50 p-4 max-h-64 overflow-auto whitespace-pre-wrap">
                  {monitor.logs || "(sem logs ainda — execute uma pesquisa para gerar atividade)"}
                </pre>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Usuários */}
      <Card>
        <CardHeader
          title="Usuários do órgão"
          icon={Users}
          action={
            <div className="flex items-center gap-2">
              {usuarioSucesso && (
                <span className="flex items-center gap-1 text-xs text-green-700">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Usuário criado!
                </span>
              )}
              <button
                onClick={() => { setMostrarFormUsuario(!mostrarFormUsuario); setUsuarioErro(null); }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" /> Novo usuário
              </button>
            </div>
          }
        />

        {/* Formulário de criação */}
        {mostrarFormUsuario && (
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Novo usuário</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
              <Inp label="Nome completo *" value={novoUsuario.nome} onChange={e => setNovoUsuario(p => ({ ...p, nome: e.target.value }))} placeholder="João Silva" />
              <Inp label="E-mail *" type="email" value={novoUsuario.email} onChange={e => setNovoUsuario(p => ({ ...p, email: e.target.value }))} placeholder="joao@orgao.gov.br" />
              <Inp label="Senha inicial *" type="password" value={novoUsuario.senha} onChange={e => setNovoUsuario(p => ({ ...p, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" />
              <Sel label="Perfil *" value={novoUsuario.perfil} onChange={e => setNovoUsuario(p => ({ ...p, perfil: e.target.value as any }))}>
                <option value="pesquisador">Pesquisador</option>
                <option value="gestor">Gestor</option>
                <option value="administrador">Administrador</option>
              </Sel>
              <Inp label="Cargo" value={novoUsuario.cargo} onChange={e => setNovoUsuario(p => ({ ...p, cargo: e.target.value }))} placeholder="Analista de compras" />
              <Inp label="Matrícula" value={novoUsuario.matricula} onChange={e => setNovoUsuario(p => ({ ...p, matricula: e.target.value }))} placeholder="123456" />
            </div>
            {usuarioErro && <p className="text-xs text-red-600 mb-2">{usuarioErro}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleCriarUsuario}
                disabled={criandoUsuario}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
              >
                {criandoUsuario ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {criandoUsuario ? "Criando..." : "Criar usuário"}
              </button>
              <button onClick={() => setMostrarFormUsuario(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {["Nome", "E-mail", "Perfil", "Cargo", "Status", "Ação"].map(h => (
                  <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {listaUsuarios.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-400">Sem usuários</td></tr>
              ) : listaUsuarios.map(u => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 px-4 text-slate-800 font-medium">{u.nome}</td>
                  <td className="py-2.5 px-4 text-slate-500 text-xs">{u.email}</td>
                  <td className="py-2.5 px-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${u.perfil === "administrador" ? "bg-purple-50 text-purple-700 border-purple-200" : u.perfil === "gestor" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>{u.perfil}</span>
                  </td>
                  <td className="py-2.5 px-4 text-slate-500 text-xs">{u.cargo || "—"}</td>
                  <td className="py-2.5 px-4">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${u.ativo ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>{u.ativo ? "Ativo" : "Inativo"}</span>
                  </td>
                  <td className="py-2.5 px-4">
                    <button
                      onClick={() => handleAtivarDesativar(u.id, u.ativo)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${u.ativo ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                    >
                      {u.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Feedbacks */}
      <Card>
        <CardHeader
          title="Sugestões e feedbacks"
          icon={MessageCircle}
          action={
            <button onClick={carregarFeedbacks} className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </button>
          }
        />
        <div className="overflow-x-auto">
          {carregandoFeedbacks ? (
            <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Usuário", "Mensagem", "Página", "Data", "Status", "Ação"].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaFeedbacks.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-xs text-slate-400">Nenhuma sugestão ainda</td></tr>
                ) : listaFeedbacks.map(f => (
                  <tr key={f.id} className={`hover:bg-slate-50 transition-colors ${!f.lido ? "bg-indigo-50/30" : ""}`}>
                    <td className="py-2.5 px-4 text-slate-700 text-xs font-medium">{f.usuarioNome}</td>
                    <td className="py-2.5 px-4 text-slate-600 text-xs max-w-xs">{f.mensagem}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-xs font-mono">{f.pagina || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-400 text-xs">{new Date(f.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${f.lido ? "bg-slate-50 text-slate-500 border-slate-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"}`}>
                        {f.lido ? "Lido" : "Novo"}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {!f.lido && (
                        <button onClick={() => handleMarcarLido(f.id)} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                          <Eye className="w-3.5 h-3.5" /> Marcar lido
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Configurações */}
      <Card>
        <CardHeader title="Configurações do sistema" icon={Settings} />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Inp label="Similaridade mínima (%)" type="number" min={0} max={100} value={similaridadeMinima} onChange={e => setSimilaridadeMinima(Number(e.target.value))} />
            <Inp label="CV — limite de alerta (%)" type="number" min={0} max={100} value={cvAlerta} onChange={e => setCvAlerta(Number(e.target.value))} />
            <Sel label="Período padrão" value={periodoPadrao} onChange={e => setPeriodoPadrao(e.target.value)}>
              <option value="6_meses">Últimos 6 meses</option>
              <option value="12_meses">Últimos 12 meses</option>
              <option value="24_meses">Últimos 24 meses</option>
            </Sel>
            <Sel label="Método padrão" value={metodoPadrao} onChange={e => setMetodoPadrao(e.target.value)}>
              <option value="media_aritmetica">Média aritmética</option>
              <option value="mediana">Mediana</option>
              <option value="media_ponderada">Média ponderada</option>
              <option value="menor_preco">Menor preço</option>
            </Sel>
          </div>
          {configErro && <p className="text-sm text-red-600 mb-3">{configErro}</p>}
          {configSalva && (
            <div className="flex items-center gap-2 text-sm text-green-700 mb-3">
              <CheckCircle2 className="w-4 h-4" /> Configurações salvas com sucesso.
            </div>
          )}
          <div className="flex justify-end">
            <button
              onClick={salvarConfig}
              disabled={salvandoConfig}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
            >
              {salvandoConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {salvandoConfig ? "Salvando..." : "Salvar configurações"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
