"use client";
import React, { useState, useEffect, useId } from "react";
import { Users, Settings, Save, Activity, Copy, RefreshCw, CheckCircle2, Loader2, ShieldAlert, UserPlus, MessageCircle, Eye, FileSearch, Bot, AlertTriangle, ScrollText } from "lucide-react";
import { CabecalhoPagina, Indicador, Situacao } from "@/components/Pagina";
import { listarUsuarios, criarUsuario, ativarDesativarUsuario, listarFeedbacks, marcarFeedbackLido } from "@/lib/admin-actions";
import { useDialogos } from "@/components/Dialogos";

interface MonitorData {
  logs: { id: string; ts: string; evento: string; dados: Record<string, unknown> }[];
  logsArquivo?: string;
  pesquisas: any[];
  sessoes: any[];
  usuarios: any[];
  horario: string;
  stats: {
    totalPesquisas: number;
    totalSessoes: number;
    totalErros: number;
    pesquisasPorDia: { dia: string; total: number }[];
    sessoesPorStatus: { status: string; total: number }[];
    fontesUsadas: { fonte: string; total: number }[];
    errosPorDia: { dia: string; total: number }[];
  };
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`card overflow-hidden ${className}`}>{children}</section>;
}

function CardHeader({ title, desc, icon: Icon, action }: { title: string; desc?: string; icon: React.ElementType; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="icon-tile h-9 w-9" aria-hidden><Icon size={17} /></span>
        <div className="min-w-0">
          <h2 className="section-title">{title}</h2>
          {desc && <p className="section-desc">{desc}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Painel de gráfico: título + descrição curta + corpo. */
function Painel({ titulo, desc, children }: { titulo: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-ink-950">{titulo}</h3>
      {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Últimos 7 dias (UTC, como o banco agrupa), preenchendo com zero os dias sem registro. */
function ultimos7Dias(dados: { dia: string; total: number }[]) {
  const mapa = new Map(dados.map((d) => [d.dia, Number(d.total) || 0]));
  return Array.from({ length: 7 }, (_, i) => {
    const chave = new Date(Date.now() - (6 - i) * 86_400_000).toISOString().slice(0, 10);
    const [, m, d] = chave.split("-");
    return { rotulo: `${d}/${m}`, total: mapa.get(chave) ?? 0 };
  });
}

/**
 * Colunas por dia — marcas finas (≤24px), topo arredondado e base reta sobre uma
 * única linha de base; rótulo só no maior valor; tooltip em cada coluna e tabela
 * equivalente para leitor de tela.
 */
function Colunas({ data, unidade, cor = "bg-ink-800" }: { data: { rotulo: string; total: number }[]; unidade: string; cor?: string }) {
  const max = Math.max(0, ...data.map((d) => d.total));
  const altura = 112;
  return (
    <figure>
      <div className="relative" aria-hidden>
        <div className="flex items-end gap-2 border-b border-slate-300" style={{ height: altura + 18 }}>
          {data.map((d, i) => {
            const h = max > 0 ? Math.max(d.total > 0 ? 4 : 0, Math.round((d.total / max) * altura)) : 0;
            const ehMax = max > 0 && d.total === max;
            return (
              <div key={i} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${d.rotulo}: ${d.total} ${unidade}`}>
                {ehMax && <span className="mb-1 text-xs font-semibold tabular-nums text-ink-950">{d.total}</span>}
                <div className={`w-full max-w-[24px] rounded-t-[4px] ${cor} transition-opacity group-hover:opacity-80`} style={{ height: h }} />
              </div>
            );
          })}
        </div>
        {max === 0 && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[13px] text-slate-500">Nenhum registro nos últimos 7 dias</p>
        )}
        <div className="mt-2 flex gap-2">
          {data.map((d, i) => (
            <span key={i} className="min-w-0 flex-1 text-center text-[11px] tabular-nums text-slate-500">{d.rotulo}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>{unidade} por dia</caption>
        <tbody>{data.map((d, i) => <tr key={i}><th>{d.rotulo}</th><td>{d.total}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Barras horizontais de uma série só: uma cor, rótulo em texto neutro, valor na ponta. */
function Barras({ data, vazio }: { data: { rotulo: string; total: number }[]; vazio: string }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  if (data.length === 0) return <p className="py-6 text-center text-[13px] text-slate-500">{vazio}</p>;
  return (
    <ul className="space-y-3">
      {data.map((d, i) => (
        <li key={i} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-3" title={`${d.rotulo}: ${d.total}`}>
          <span className="truncate text-[13px] text-slate-600">{d.rotulo}</span>
          <span className="h-2 rounded-r-[4px] bg-ink-800" style={{ width: `${Math.max(3, Math.round((d.total / max) * 100))}%` }} aria-hidden />
          <span className="text-right text-[13px] font-semibold tabular-nums text-ink-950">{d.total}</span>
        </li>
      ))}
    </ul>
  );
}


function Inp({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="rotulo">{label}</label>
      <input id={id} className="inp" {...props} />
    </div>
  );
}

function Sel({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="rotulo">{label}</label>
      <select id={id} className="inp" {...props}>
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
  const [filtroLogs, setFiltroLogs] = useState("");
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [configSalva, setConfigSalva] = useState<boolean | null>(null);
  const [configErro, setConfigErro] = useState<string | null>(null);
  const [aba, setAba] = useState<"monitor" | "usuarios" | "feedbacks" | "config">("monitor");
  const { avisar } = useDialogos();

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

  // Auto-refresh do monitoramento a cada 30s
  useEffect(() => {
    const t = setInterval(carregarMonitor, 30_000);
    return () => clearInterval(t);
  }, []);

  const copiarLogs = async () => {
    if (!monitor) return;
    const texto = monitor.logs.length > 0
      ? monitor.logs.map((l) => `${l.ts} ${rotuloEvento(l.evento)} ${JSON.stringify(l.dados)}`).join("\n")
      : monitor.logsArquivo || "";
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { await avisar("Não consegui copiar automaticamente. Selecione o texto e copie com Ctrl+C.", "Copiar manualmente"); }
  };

  const fmtMoeda = (v: string | null) => v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtData = (d: string) => new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const fmtHora = (d: string) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const linhasErro = monitor?.stats?.totalErros ?? 0;
  const logsFiltrados = (monitor?.logs || []).filter((l) => {
    if (!filtroLogs.trim()) return true;
    const q = filtroLogs.toLowerCase();
    return l.evento.toLowerCase().includes(q) || JSON.stringify(l.dados).toLowerCase().includes(q);
  });
  const ehErroLog = (l: { dados: Record<string, unknown> }) => (l.dados?.erro != null && l.dados.erro !== "") || l.dados?.ok === false;

  // Linguagem de gente: o evento técnico vira rótulo, e o JSON vira frase.
  const ROTULO_EVENTO: Record<string, string> = {
    pesquisa_criada: "Pesquisa iniciada",
    pesquisa_concluida: "Pesquisa concluída",
    pncp_busca: "Busca no PNCP",
    busca_pncp: "Busca no PNCP",
    sessao_agente: "Busca automática",
    agente_sessao: "Busca automática",
    usuario_criado: "Usuário criado",
    usuario_ativado: "Usuário reativado",
    usuario_desativado: "Usuário desativado",
    feedback_criado: "Sugestão recebida",
    erro: "Erro",
  };
  const rotuloEvento = (e: string) =>
    ROTULO_EVENTO[e] || (ROTULO_EVENTO[e.replace(/[.-]/g, "_")] ?? e.replace(/[._]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()));
  const NOME_CAMPO: Record<string, string> = {
    objeto: "Objeto", fonte: "Fonte", total: "Resultados", encontrados: "Resultados",
    erro: "Erro", ok: "Ok", ms: "Duração", duracaoMs: "Duração", termo: "Termo",
    pesquisaId: "Pesquisa", processoId: "Processo", usuario: "Usuário", perfil: "Perfil",
  };
  const detalheLog = (l: { dados: Record<string, unknown> }) => {
    const d = l.dados || {};
    const partes: string[] = [];
    for (const [k, v] of Object.entries(d)) {
      if (v == null || v === "" || k.startsWith("_")) continue;
      const nome = NOME_CAMPO[k] || k;
      const val = typeof v === "object"
        ? (Array.isArray(v) ? `${v.length} item(ns)` : "—")
        : String(v).replace(/\s+/g, " ").trim();
      partes.push(`${nome}: ${val.length > 70 ? val.slice(0, 70) + "…" : val}`);
    }
    return partes.join(" · ") || "—";
  };


  const PERFIL_TOM: Record<string, string> = { administrador: "pill-gold", gestor: "pill-info", pesquisador: "pill-neutral" };
  const PERFIL_ROTULO: Record<string, string> = { administrador: "Administrador", gestor: "Gestor", pesquisador: "Pesquisador" };

  return (
    <div>
      <CabecalhoPagina
        titulo="Administração"
        descricao="Monitoramento, usuários, sugestões e configurações do sistema — visível só para administradores."
      />

      <div role="tablist" aria-label="Seções da administração" className="scroll-fino mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {([
          { chave: "monitor", rotulo: "Monitoramento", Icone: Activity },
          { chave: "usuarios", rotulo: "Usuários", Icone: Users },
          { chave: "feedbacks", rotulo: "Sugestões", Icone: MessageCircle },
          { chave: "config", rotulo: "Configurações", Icone: Settings },
        ] as const).map(({ chave, rotulo, Icone }) => (
          <button
            key={chave}
            role="tab"
            aria-selected={aba === chave}
            onClick={() => setAba(chave)}
            className={`-mb-px inline-flex min-h-[46px] shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold transition-colors ${
              aba === chave ? "border-ink-900 text-ink-950" : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            <Icone className="h-4 w-4" aria-hidden /> {rotulo}
            {chave === "feedbacks" && listaFeedbacks.some((f) => !f.lido) && (
              <span className="rounded-full bg-ink-900 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-white">
                {listaFeedbacks.filter((f) => !f.lido).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Monitoramento */}
      {aba === "monitor" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">Atualiza sozinho a cada 30 segundos.</p>
            <button onClick={carregarMonitor} className="btn btn-outline btn-sm min-h-[44px]">
              <RefreshCw className="h-4 w-4" aria-hidden /> Atualizar agora
            </button>
          </div>

          {monitorErro && (
            <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden /> {monitorErro}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Pesquisas" valor={monitor ? (monitor.stats?.totalPesquisas ?? monitor.pesquisas.length) : 0} nota="no sistema" icone={FileSearch} carregando={!monitor && !monitorErro} />
            <Indicador rotulo="Buscas automáticas" valor={monitor ? (monitor.stats?.totalSessoes ?? monitor.sessoes.length) : 0} nota="nas fontes oficiais" icone={Bot} carregando={!monitor && !monitorErro} />
            <Indicador rotulo="Usuários" valor={monitor ? monitor.usuarios.length : 0} nota="no órgão" icone={Users} carregando={!monitor && !monitorErro} />
            <Indicador
              rotulo="Erros"
              valor={linhasErro}
              nota={linhasErro > 0 ? "verifique o registro de atividade" : "nenhum erro registrado"}
              critico={linhasErro > 0}
              icone={AlertTriangle}
              carregando={!monitor && !monitorErro}
            />
          </div>

          {monitor && (
            <>
              {/* Gráficos */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Painel titulo="Pesquisas por dia" desc="Últimos 7 dias">
                  <Colunas unidade="pesquisas" data={ultimos7Dias(monitor.stats?.pesquisasPorDia || [])} />
                </Painel>
                <Painel titulo="Erros por dia" desc="Últimos 7 dias · registros com erro e buscas que falharam">
                  <Colunas unidade="erros" cor="bg-red-600" data={ultimos7Dias(monitor.stats?.errosPorDia || [])} />
                </Painel>
                <Painel titulo="Buscas automáticas por situação" desc="Todas as execuções registradas">
                  {(monitor.stats?.sessoesPorStatus || []).length === 0 ? (
                    <p className="py-6 text-center text-[13px] text-slate-500">Nenhuma busca automática registrada</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {(monitor.stats?.sessoesPorStatus || []).map((s) => (
                        <li key={s.status} className="flex items-center justify-between py-2.5">
                          <Situacao status={s.status} />
                          <span className="text-sm font-semibold tabular-nums text-ink-950">{s.total}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Painel>
                <Painel titulo="Fontes mais usadas" desc="Buscas automáticas por fonte oficial">
                  <Barras vazio="Nenhuma fonte consultada ainda" data={(monitor.stats?.fontesUsadas || []).map((f) => ({ rotulo: f.fonte, total: f.total }))} />
                </Painel>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {/* Pesquisas recentes */}
                <Card>
                  <CardHeader title="Pesquisas recentes" icon={FileSearch} />
                  <div className="scroll-fino overflow-x-auto">
                    <table className="tabela">
                      <thead>
                        <tr>
                          <th>Processo</th>
                          <th>Objeto</th>
                          <th>Situação</th>
                          <th className="text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monitor.pesquisas.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-[13px] text-slate-500">Nenhuma pesquisa ainda</td></tr>
                        ) : monitor.pesquisas.map((p) => (
                          <tr key={p.id}>
                            <td><span className="protocolo">{p.processoNumero || "—"}</span></td>
                            <td className="max-w-[160px] truncate" title={p.objeto}>{p.objeto}</td>
                            <td><Situacao status={p.status} /></td>
                            <td className="text-right"><span className="valor">{fmtMoeda(p.precoTotalEstimado)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Sessões */}
                <Card>
                  <CardHeader title="Buscas automáticas" desc="Rotinas que consultam as fontes oficiais" icon={Bot} />
                  <div className="scroll-fino overflow-x-auto">
                    <table className="tabela">
                      <thead>
                        <tr>
                          <th>Rotina</th>
                          <th>Fonte</th>
                          <th>Situação</th>
                          <th className="text-right">Resultados</th>
                          <th>Observação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monitor.sessoes.length === 0 ? (
                          <tr><td colSpan={5} className="py-8 text-center text-[13px] text-slate-500">Nenhuma busca automática ainda</td></tr>
                        ) : monitor.sessoes.map((s) => (
                          <tr key={s.id}>
                            <td className="text-[13px]">{s.nomeAgente}</td>
                            <td className="text-[13px] text-slate-500">{s.fonte}</td>
                            <td><Situacao status={s.status} /></td>
                            <td className="text-right tabular-nums">{s.totalEncontrado ?? "—"}</td>
                            <td>
                              {s.erro ? (
                                <span className="block max-w-[180px] truncate text-xs text-red-700" title={s.erro}>{s.erro}</span>
                              ) : (
                                <span className="text-xs text-slate-500">{s.concluidoEm ? `Concluída às ${fmtHora(s.concluidoEm)}` : "—"}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>

              {/* Registro de atividade */}
              <Card>
                <CardHeader
                  title="Registro de atividade"
                  desc={`${monitor.logs.length} eventos mais recentes`}
                  icon={ScrollText}
                  action={
                    <div className="flex items-center gap-2">
                      <label htmlFor="filtro-logs" className="sr-only">Filtrar atividade</label>
                      <input
                        id="filtro-logs"
                        value={filtroLogs}
                        onChange={(e) => setFiltroLogs(e.target.value)}
                        placeholder="Filtrar…"
                        className="inp w-44"
                      />
                      <button onClick={copiarLogs} className="btn btn-outline btn-sm min-h-[44px]">
                        <Copy className="h-4 w-4" aria-hidden /> {copiado ? "Copiado!" : "Copiar"}
                      </button>
                    </div>
                  }
                />
                <div className="scroll-fino max-h-72 overflow-auto">
                  {logsFiltrados.length === 0 ? (
                    <pre className="whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-slate-600">
                      {monitor.logsArquivo
                        ? monitor.logsArquivo
                        : "Sem atividade registrada ainda — faça uma pesquisa para gerar registros."}
                    </pre>
                  ) : (
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        {logsFiltrados.slice(0, 100).map((l) => (
                          <tr key={l.id} className={ehErroLog(l) ? "bg-red-50/60" : "hover:bg-slate-50"}>
                            <td className="whitespace-nowrap px-5 py-2 font-mono text-slate-500">{fmtData(l.ts)}</td>
                            <td className="whitespace-nowrap px-2 py-2">
                              <span className={`pill ${ehErroLog(l) ? "pill-danger" : "pill-info"}`}>{rotuloEvento(l.evento)}</span>
                            </td>
                            <td className={`max-w-[480px] truncate px-2 py-2 ${ehErroLog(l) ? "text-red-700" : "text-slate-600"}`} title={JSON.stringify(l.dados)}>
                              {detalheLog(l)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Usuários */}
      {aba === "usuarios" && (
        <Card>
          <CardHeader
            title="Usuários do órgão"
            desc="Quem acessa o LEX e com qual perfil."
            icon={Users}
            action={
              <div className="flex items-center gap-3">
                {usuarioSucesso && (
                  <span role="status" className="flex items-center gap-1.5 text-sm text-green-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden /> Usuário criado
                  </span>
                )}
                <button
                  onClick={() => { setMostrarFormUsuario(!mostrarFormUsuario); setUsuarioErro(null); }}
                  aria-expanded={mostrarFormUsuario}
                  className={`btn btn-sm min-h-[44px] ${mostrarFormUsuario ? "btn-outline" : "btn-primary"}`}
                >
                  <UserPlus className="h-4 w-4" aria-hidden /> Novo usuário
                </button>
              </div>
            }
          />

          {/* Formulário de criação */}
          {mostrarFormUsuario && (
            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-5">
              <p className="mb-4 text-sm font-semibold text-ink-950">Novo usuário</p>
              <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <Inp label="Nome completo *" value={novoUsuario.nome} onChange={e => setNovoUsuario(p => ({ ...p, nome: e.target.value }))} placeholder="Nome e sobrenome" />
                <Inp label="E-mail *" type="email" value={novoUsuario.email} onChange={e => setNovoUsuario(p => ({ ...p, email: e.target.value }))} placeholder="nome@orgao.gov.br" />
                <Inp label="Senha inicial *" type="password" value={novoUsuario.senha} onChange={e => setNovoUsuario(p => ({ ...p, senha: e.target.value }))} placeholder="Mínimo 6 caracteres" />
                <Sel label="Perfil *" value={novoUsuario.perfil} onChange={e => setNovoUsuario(p => ({ ...p, perfil: e.target.value as any }))}>
                  <option value="pesquisador">Pesquisador</option>
                  <option value="gestor">Gestor</option>
                  <option value="administrador">Administrador</option>
                </Sel>
                <Inp label="Cargo" value={novoUsuario.cargo} onChange={e => setNovoUsuario(p => ({ ...p, cargo: e.target.value }))} placeholder="Ex.: Analista de compras" />
                <Inp label="Matrícula" value={novoUsuario.matricula} onChange={e => setNovoUsuario(p => ({ ...p, matricula: e.target.value }))} placeholder="Ex.: 123456" />
              </div>
              {usuarioErro && <p role="alert" className="mb-3 text-sm text-red-700">{usuarioErro}</p>}
              <div className="flex flex-wrap gap-2">
                <button onClick={handleCriarUsuario} disabled={criandoUsuario} className="btn btn-primary">
                  {criandoUsuario ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
                  {criandoUsuario ? "Criando..." : "Criar usuário"}
                </button>
                <button onClick={() => setMostrarFormUsuario(false)} className="btn btn-outline">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="scroll-fino overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Cargo</th>
                  <th>Situação</th>
                  <th><span className="sr-only">Ação</span></th>
                </tr>
              </thead>
              <tbody>
                {listaUsuarios.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-[13px] text-slate-500">Nenhum usuário cadastrado</td></tr>
                ) : listaUsuarios.map(u => (
                  <tr key={u.id}>
                    <td className="font-medium text-ink-950">{u.nome}</td>
                    <td className="text-[13px] text-slate-500">{u.email}</td>
                    <td><span className={`pill ${PERFIL_TOM[u.perfil] || "pill-neutral"}`}>{PERFIL_ROTULO[u.perfil] || u.perfil}</span></td>
                    <td className="text-[13px] text-slate-500">{u.cargo || "—"}</td>
                    <td><span className={`pill ${u.ativo ? "pill-success" : "pill-neutral"}`}>{u.ativo ? "Ativo" : "Inativo"}</span></td>
                    <td className="text-right">
                      <button
                        onClick={() => handleAtivarDesativar(u.id, u.ativo)}
                        className={`btn btn-sm min-h-[44px] ${u.ativo ? "btn-danger" : "btn-outline"}`}
                      >
                        {u.ativo ? "Desativar" : "Reativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Sugestões */}
      {aba === "feedbacks" && (
        <Card>
          <CardHeader
            title="Sugestões dos usuários"
            desc="Enviadas pelo campo no fim da barra lateral."
            icon={MessageCircle}
            action={
              <button onClick={carregarFeedbacks} className="btn btn-outline btn-sm min-h-[44px]">
                <RefreshCw className="h-4 w-4" aria-hidden /> Atualizar
              </button>
            }
          />
          <div className="scroll-fino overflow-x-auto">
            {carregandoFeedbacks ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Carregando…
              </div>
            ) : (
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Mensagem</th>
                    <th>Tela</th>
                    <th>Data</th>
                    <th>Situação</th>
                    <th><span className="sr-only">Ação</span></th>
                  </tr>
                </thead>
                <tbody>
                  {listaFeedbacks.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-[13px] text-slate-500">Nenhuma sugestão ainda</td></tr>
                  ) : listaFeedbacks.map(f => (
                    <tr key={f.id} className={!f.lido ? "bg-ink-50/40" : ""}>
                      <td className="whitespace-nowrap text-[13px] font-medium text-ink-950">{f.usuarioNome}</td>
                      <td className="min-w-[240px] max-w-md text-[13px] leading-relaxed text-slate-700">{f.mensagem}</td>
                      <td className="font-mono text-xs text-slate-500">{f.pagina || "—"}</td>
                      <td className="whitespace-nowrap text-[13px] text-slate-500">{new Date(f.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                      <td><span className={`pill ${f.lido ? "pill-neutral" : "pill-info"}`}>{f.lido ? "Lida" : "Nova"}</span></td>
                      <td className="text-right">
                        {!f.lido && (
                          <button onClick={() => handleMarcarLido(f.id)} className="btn btn-ghost btn-sm min-h-[44px]">
                            <Eye className="h-4 w-4" aria-hidden /> Marcar como lida
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
      )}

      {/* Configurações */}
      {aba === "config" && (
        <Card>
          <CardHeader title="Configurações da pesquisa" desc="Valores padrão aplicados às novas pesquisas de preços." icon={Settings} />
          <div className="p-5">
            <div className="mb-6 grid max-w-3xl grid-cols-1 gap-5 md:grid-cols-2">
              <Inp label="Similaridade mínima (%)" type="number" min={0} max={100} value={similaridadeMinima} onChange={e => setSimilaridadeMinima(Number(e.target.value))} />
              <Inp label="Coeficiente de variação — limite de alerta (%)" type="number" min={0} max={100} value={cvAlerta} onChange={e => setCvAlerta(Number(e.target.value))} />
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
            {configErro && <p role="alert" className="mb-3 text-sm text-red-700">{configErro}</p>}
            {configSalva && (
              <p role="status" className="mb-3 flex items-center gap-2 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Configurações salvas.
              </p>
            )}
            <div className="flex border-t border-slate-100 pt-5">
              <button onClick={salvarConfig} disabled={salvandoConfig} className="btn btn-primary">
                {salvandoConfig ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                {salvandoConfig ? "Salvando..." : "Salvar configurações"}
              </button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
