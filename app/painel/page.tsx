"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, AlertTriangle, Clock, CheckCircle2, Users, Sparkles, Loader2, Bell, ArrowRight, Inbox, Hourglass, Search, FileText, BookOpen } from "lucide-react";
import { obterPainelServidor, marcarAlertaLido, buscarTudo, consultarLegislacao } from "@/lib/actions-intencao";
import { entenderIntencao, criarProcessoPorIntencao } from "@/lib/actions-intencao";

function fmtData(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function badgeStatus(status: string) {
  const map: Record<string, string> = {
    pendente: "bg-amber-100 text-amber-700",
    em_andamento: "bg-blue-100 text-blue-700",
    concluida: "bg-green-100 text-green-700",
    aguardando_outro: "bg-purple-100 text-purple-700",
    atrasada: "bg-red-100 text-red-700",
  };
  const labels: Record<string, string> = {
    pendente: "Pendente",
    em_andamento: "Em andamento",
    concluida: "Concluída",
    aguardando_outro: "Aguardando outro",
    atrasada: "Atrasada",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${map[status] || "bg-slate-100 text-slate-600"}`}>
      {labels[status] || status}
    </span>
  );
}

export default function PainelPage() {
  const [painel, setPainel] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [intencao, setIntencao] = useState("");
  const [sugestoes, setSugestoes] = useState<any[] | null>(null);
  const [tipos, setTipos] = useState<any[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");
  const [resultadoBusca, setResultadoBusca] = useState<any | null>(null);
  const [legis, setLegis] = useState<any[] | null>(null);
  const [perguntaLei, setPerguntaLei] = useState("");
  const [novoProcesso, setNovoProcesso] = useState<any | null>(null);
  // Aba ativa das tarefas (formato dashboard — seções com abas)
  const [abaTarefas, setAbaTarefas] = useState("hoje");

  useEffect(() => {
    obterPainelServidor().then(setPainel).catch((e) => setErro(String(e?.message || e)));
  }, []);

  async function detectar() {
    if (intencao.trim().length < 5) return;
    // Agora o fluxo vai para o CHAT GUIADO (assistente conversacional) —
    // o servidor conversa com o sistema em vez de escolher numa lista.
    window.location.href = `/assistente?intencao=${encodeURIComponent(intencao.trim())}`;
  }

  async function criar(tipoId: string) {
    setCriando(true);
    try {
      const r = await criarProcessoPorIntencao(intencao, tipoId);
      setNovoProcesso(r);
      setSugestoes(null);
      setIntencao("");
      setPainel(await obterPainelServidor());
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setCriando(false);
    }
  }

  async function lerAlerta(id: string) {
    await marcarAlertaLido(id);
    setPainel(await obterPainelServidor());
  }

  async function pesquisar() {
    if (busca.trim().length < 3) return;
    setResultadoBusca(await buscarTudo(busca));
  }

  async function perguntarLei() {
    if (perguntaLei.trim().length < 3) return;
    setLegis(await consultarLegislacao(perguntaLei));
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Painel de trabalho</h1>
          <p className="text-sm text-slate-500">O que você precisa fazer hoje, sem procurar em menus.</p>
        </div>
        <Link href="/processos" className="inline-flex items-center gap-1.5 text-sm text-[#032650] hover:text-indigo-800 font-medium">
          Ver processos <ArrowRight size={14} />
        </Link>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      {/* ============ O QUE VOCÊ PRECISA FAZER? (coração do sistema) ============ */}
      <div className="mb-6 rounded-2xl border-2 border-[#d5dce8] bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-[#032650]" />
          <h2 className="font-bold text-indigo-900">O que você precisa fazer?</h2>
        </div>
        <p className="text-sm text-[#032650]/70 mb-3">
          Digite em linguagem normal. O sistema identifica o procedimento, monta o caminho e conduz você etapa por etapa.
        </p>
        <div className="flex gap-2">
          <input
            value={intencao}
            onChange={(e) => setIntencao(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && detectar()}
            placeholder="Ex.: Preciso iniciar uma contratação de manutenção de ar-condicionado"
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-[#d5dce8] focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 text-sm bg-white"
          />
          <button
            onClick={detectar}
            disabled={analisando || intencao.trim().length < 5}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#032650] text-white text-sm font-semibold hover:bg-[#032650] disabled:opacity-50 transition-colors cursor-pointer"
          >
            {analisando ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Entender
          </button>
        </div>

        {/* Sugestões de tipo de processo */}
        {sugestoes && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide">Identifiquei o procedimento. Confirme:</p>
            {sugestoes.map((s) => (
              <button
                key={s.tipoProcessoId}
                onClick={() => criar(s.tipoProcessoId)}
                disabled={criando}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-[#d5dce8] hover:border-indigo-400 hover:bg-[#eef2f8] transition-colors text-left cursor-pointer"
              >
                <div>
                  <p className="font-semibold text-slate-800">{s.nomeTipo}</p>
                  <p className="text-xs text-slate-500">
                    Confiança: {Math.round(s.confianca * 100)}% · palavras: {s.palavrasChave.join(", ") || "geral"}
                  </p>
                </div>
                {criando ? <Loader2 size={16} className="animate-spin text-indigo-500" /> : <ArrowRight size={16} className="text-indigo-500" />}
              </button>
            ))}
          </div>
        )}

        {/* Processo criado */}
        {novoProcesso && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="flex items-center gap-2 font-semibold text-green-800">
              <CheckCircle2 size={16} /> Processo criado com sucesso!
            </p>
            <p className="text-sm text-green-700 mt-1">
              {novoProcesso.processo.numero} · {novoProcesso.tipo.nome} · <strong>{novoProcesso.totalEtapas} etapas guiadas</strong> criadas.
            </p>
            <p className="text-xs text-green-600 mt-1">O sistema vai conduzir você etapa por etapa. Veja no painel abaixo.</p>
          </div>
        )}
      </div>

      {/* ============ MÉTRICAS GRANDES (formato dashboard) ============ */}
      {painel && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Card principal estilo saldo */}
          <div className="rounded-2xl bg-[#032650] text-white p-5 shadow-sm col-span-2 lg:col-span-1">
            <p className="text-white/60 text-[11px] font-medium uppercase tracking-wide">Processos ativos</p>
            <p className="text-4xl font-bold mt-1 tabular-nums">{painel.totalAtivas}</p>
            <p className="text-white/50 text-xs mt-1">{painel.processos?.length || 0} no total</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wide">Para hoje</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{painel.tarefasHoje.length}</p>
            <p className="text-slate-400 text-xs mt-1">tarefas do dia</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-amber-500 text-[11px] font-medium uppercase tracking-wide">Pendentes</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{painel.pendentes.length}</p>
            <p className="text-slate-400 text-xs mt-1">aguardando início</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-red-500 text-[11px] font-medium uppercase tracking-wide">Atrasadas</p>
            <p className="text-4xl font-bold mt-1 text-slate-800 tabular-nums">{painel.atrasadas.length}</p>
            <p className="text-slate-400 text-xs mt-1">precisam de ação</p>
          </div>
        </div>
      )}

      {/* Alertas inteligentes */}
      {painel?.alertas?.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={16} className="text-red-600" />
            <h3 className="font-semibold text-red-800 text-sm">Alertas inteligentes ({painel.alertas.length})</h3>
          </div>
          <div className="space-y-2">
            {painel.alertas.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-red-100 px-3 py-2 text-sm">
                <div className="flex items-center gap-2">
                  {a.severidade === "alta" ? <AlertTriangle size={14} className="text-red-600 shrink-0" /> : <Clock size={14} className="text-amber-600 shrink-0" />}
                  <span className="text-slate-700">{a.mensagem}</span>
                </div>
                <button onClick={() => lerAlerta(a.id)} className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer">ok</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ Tarefas (abas estilo dashboard) ============ */}
      {painel && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Abas */}
          <div className="flex items-center gap-1 px-3 pt-3 border-b border-slate-100 overflow-x-auto">
            {[
              { chave: "hoje", label: "Para hoje", qtd: painel.tarefasHoje.length },
              { chave: "atrasadas", label: "Atrasadas", qtd: painel.atrasadas.length },
              { chave: "aguardando", label: "Aguardando outro", qtd: painel.aguardandoOutro.length },
              { chave: "paradas", label: "Paradas 5+ dias", qtd: painel.paradas5dias.length },
              { chave: "pendentes", label: "Pendentes", qtd: painel.pendentes.length },
            ].filter(a => a.qtd > 0 || a.chave === "hoje").map((a) => (
              <button
                key={a.chave}
                onClick={() => setAbaTarefas(a.chave)}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors cursor-pointer ${
                  abaTarefas === a.chave
                    ? "border-[#032650] text-[#032650] bg-[#eef2f8]"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                {a.label}
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${abaTarefas === a.chave ? "bg-[#032650] text-white" : "bg-slate-100 text-slate-500"}`}>
                  {a.qtd}
                </span>
              </button>
            ))}
          </div>

          {/* Lista da aba ativa */}
          <div className="p-4">
            {abaTarefas === "hoje" && (
              painel.tarefasHoje.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nenhuma tarefa para hoje. Tudo em dia!</p>
              ) : (
                <div className="space-y-2">
                  {painel.tarefasHoje.map((t: any) => (
                    t.processoId ? (
                      <Link key={t.id} href={`/processos/${t.processoId}/jornada`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 hover:border-[#d5dce8] hover:bg-slate-50 px-4 py-3 transition-colors block">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-[#eef2f8] flex items-center justify-center shrink-0">
                            <CalendarClock size={14} className="text-[#032650]" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{t.titulo}</p>
                            <p className="text-xs text-slate-500 truncate">{t.descricao?.slice(0, 80)}…</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {badgeStatus(t.status)}
                          <ArrowRight size={14} className="text-slate-400" />
                        </div>
                      </Link>
                    ) : (
                      <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
                        <div className="w-8 h-8 rounded-lg bg-[#eef2f8] flex items-center justify-center shrink-0">
                          <CalendarClock size={14} className="text-[#032650]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{t.titulo}</p>
                          <p className="text-xs text-slate-500 truncate">{t.descricao?.slice(0, 80)}…</p>
                        </div>
                        <span className="ml-auto shrink-0">{badgeStatus(t.status)}</span>
                      </div>
                    )
                  ))}
                </div>
              )
            )}

            {abaTarefas === "atrasadas" && (
              painel.atrasadas.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nenhuma tarefa atrasada. Boa!</p>
              ) : (
                <div className="space-y-2">
                  {painel.atrasadas.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-red-50 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <AlertTriangle size={15} className="text-red-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{t.titulo}</p>
                          <p className="text-xs text-slate-500">Prazo: {fmtData(t.prazo)}</p>
                        </div>
                      </div>
                      {badgeStatus(t.status)}
                    </div>
                  ))}
                </div>
              )
            )}

            {abaTarefas === "aguardando" && (
              painel.aguardandoOutro.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nada aguardando outra pessoa.</p>
              ) : (
                <div className="space-y-2">
                  {painel.aguardandoOutro.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl bg-purple-50 px-4 py-3">
                      <Hourglass size={14} className="text-purple-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{t.titulo}</p>
                        <p className="text-xs text-slate-500">Depende de: {t.dependenteDe || "outro setor"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {abaTarefas === "paradas" && (
              painel.paradas5dias.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nenhum processo parado.</p>
              ) : (
                <div className="space-y-2">
                  {painel.paradas5dias.map((t: any) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Clock size={15} className="text-amber-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{t.titulo}</p>
                          <p className="text-xs text-slate-500">Criada em {fmtData(t.createdAt)} — está parada!</p>
                        </div>
                      </div>
                      {badgeStatus(t.status)}
                    </div>
                  ))}
                </div>
              )
            )}

            {abaTarefas === "pendentes" && (
              painel.pendentes.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Nenhuma tarefa pendente.</p>
              ) : (
                <div className="space-y-2">
                  {painel.pendentes.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3">
                      <Hourglass size={14} className="text-amber-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{t.titulo}</p>
                        <p className="text-xs text-slate-500">{t.descricao?.slice(0, 80)}…</p>
                      </div>
                      <span className="ml-auto shrink-0">{badgeStatus(t.status)}</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
