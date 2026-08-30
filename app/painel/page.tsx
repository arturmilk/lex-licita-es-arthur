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
        <Link href="/processos" className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
          Ver processos <ArrowRight size={14} />
        </Link>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      {/* ============ O QUE VOCÊ PRECISA FAZER? (coração do sistema) ============ */}
      <div className="mb-6 rounded-2xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles size={18} className="text-indigo-600" />
          <h2 className="font-bold text-indigo-900">O que você precisa fazer?</h2>
        </div>
        <p className="text-sm text-indigo-700/70 mb-3">
          Digite em linguagem normal. O sistema identifica o procedimento, monta o caminho e conduz você etapa por etapa.
        </p>
        <div className="flex gap-2">
          <input
            value={intencao}
            onChange={(e) => setIntencao(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && detectar()}
            placeholder="Ex.: Preciso iniciar uma contratação de manutenção de ar-condicionado"
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-indigo-200 focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 text-sm bg-white"
          />
          <button
            onClick={detectar}
            disabled={analisando || intencao.trim().length < 5}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
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
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left cursor-pointer"
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

      {/* ============ Busca inteligente + legislação ============ */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Search size={16} className="text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Busca inteligente</h3>
          </div>
          <div className="flex gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pesquisar()}
              placeholder="Ex.: processos de aquisição parados há mais de 10 dias"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 text-sm"
            />
            <button onClick={pesquisar} className="px-3 py-2 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer">Buscar</button>
          </div>
          {resultadoBusca && (
            <div className="mt-3 space-y-2 text-xs">
              {resultadoBusca.processos?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-600 mb-1">Processos ({resultadoBusca.processos.length})</p>
                  {resultadoBusca.processos.map((p: any) => (
                    <Link key={p.id} href={`/processos/${p.id}/jornada`} className="block px-3 py-1.5 rounded bg-slate-50 hover:bg-slate-100 text-slate-700">
                      <span className="font-mono">{p.numero}</span> — {p.objeto} <span className="text-slate-400">({p.status})</span>
                    </Link>
                  ))}
                </div>
              )}
              {resultadoBusca.normas?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-600 mb-1">Normas ({resultadoBusca.normas.length})</p>
                  {resultadoBusca.normas.map((n: any) => (
                    <div key={n.id} className="px-3 py-1.5 rounded bg-indigo-50 text-indigo-800">
                      <span className="font-semibold">{n.titulo}</span> — {n.conteudo.slice(0, 100)}… <span className="text-indigo-400">({n.fonte})</span>
                    </div>
                  ))}
                </div>
              )}
              {resultadoBusca.tarefas?.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-600 mb-1">Tarefas ({resultadoBusca.tarefas.length})</p>
                  {resultadoBusca.tarefas.map((t: any) => (
                    t.processoId ? (
                      <Link key={t.id} href={`/processos/${t.processoId}/jornada`} className="block px-3 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800">
                        {t.titulo}
                      </Link>
                    ) : (
                      <div key={t.id} className="px-3 py-1.5 rounded bg-amber-50 text-amber-800">{t.titulo}</div>
                    )
                  ))}
                </div>
              )}
              {!resultadoBusca.processos?.length && !resultadoBusca.normas?.length && !resultadoBusca.tarefas?.length && (
                <p className="text-slate-400">Nada encontrado para "{busca}".</p>
              )}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-slate-500" />
            <h3 className="font-semibold text-slate-800 text-sm">Pergunte sobre a legislação</h3>
          </div>
          <div className="flex gap-2">
            <input
              value={perguntaLei}
              onChange={(e) => setPerguntaLei(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && perguntarLei()}
              placeholder="Ex.: qual o prazo para licitação na modalidade convite?"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 text-sm"
            />
            <button onClick={perguntarLei} className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold hover:bg-indigo-200 cursor-pointer">Perguntar</button>
          </div>
          {legis && (
            <div className="mt-3 space-y-2 text-xs">
              {legis.length === 0 && <p className="text-slate-400">Nenhuma norma encontrada para essa pergunta.</p>}
              {legis.map((n, i) => (
                <div key={i} className="px-3 py-2 rounded bg-indigo-50 text-indigo-900">
                  <p className="font-semibold">{n.titulo} <span className="text-indigo-400 font-normal">· {n.fonte}</span></p>
                  <p className="mt-0.5 text-indigo-700/80">{n.conteudo}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ Alertas inteligentes ============ */}
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

      {/* ============ Tarefas ============ */}
      {painel && (
        <div className="space-y-6">
          {/* Atrasadas */}
          {painel.atrasadas.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 font-semibold text-red-700 text-sm mb-3">
                <AlertTriangle size={15} /> Atrasadas ({painel.atrasadas.length})
              </h3>
              <div className="space-y-2">
                {painel.atrasadas.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-red-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{t.titulo}</p>
                      <p className="text-xs text-slate-500">Prazo: {fmtData(t.prazo)} {badgeStatus(t.status)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hoje */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="flex items-center gap-2 font-semibold text-slate-800 text-sm mb-3">
              <CalendarClock size={15} className="text-indigo-600" /> Para hoje ({painel.tarefasHoje.length})
            </h3>
            {painel.tarefasHoje.length === 0 ? (
              <p className="text-sm text-slate-400 py-2">Nenhuma tarefa para hoje. 🎉</p>
            ) : (
              <div className="space-y-2">
                {painel.tarefasHoje.map((t: any) => (
                  t.processoId ? (
                    <Link key={t.id} href={`/processos/${t.processoId}/jornada`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 hover:border-indigo-200 px-3 py-2 transition-colors block">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.titulo}</p>
                        <p className="text-xs text-slate-500">{t.descricao?.slice(0, 90)}… {badgeStatus(t.status)}</p>
                      </div>
                      <ArrowRight size={14} className="text-slate-400 shrink-0" />
                    </Link>
                  ) : (
                    <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{t.titulo}</p>
                        <p className="text-xs text-slate-500">{t.descricao?.slice(0, 90)}… {badgeStatus(t.status)}</p>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
          </div>

          {/* Aguardando outro */}
          {painel.aguardandoOutro.length > 0 && (
            <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 font-semibold text-purple-700 text-sm mb-3">
                <Users size={15} /> Aguardando outra pessoa ({painel.aguardandoOutro.length})
              </h3>
              <div className="space-y-2">
                {painel.aguardandoOutro.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-lg bg-purple-50 px-3 py-2">
                    <Hourglass size={14} className="text-purple-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-800">{t.titulo}</p>
                      <p className="text-xs text-slate-500">Depende de: {t.dependenteDe || "outro setor"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Paradas 5+ dias */}
          {painel.paradas5dias.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 font-semibold text-amber-700 text-sm mb-3">
                <Clock size={15} /> Paradas há mais de 5 dias ({painel.paradas5dias.length})
              </h3>
              <div className="space-y-2">
                {painel.paradas5dias.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{t.titulo}</p>
                      <p className="text-xs text-slate-500">Criada em {fmtData(t.createdAt)} — está parada!</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Tarefas ativas", valor: painel.totalAtivas, icon: Inbox, cor: "text-indigo-600 bg-indigo-50" },
              { label: "Pendentes", valor: painel.pendentes.length, icon: Hourglass, cor: "text-amber-600 bg-amber-50" },
              { label: "Aguardando outro", valor: painel.aguardandoOutro.length, icon: Users, cor: "text-purple-600 bg-purple-50" },
              { label: "Alertas", valor: painel.alertas?.length || 0, icon: Bell, cor: "text-red-600 bg-red-50" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <c.icon size={18} className={`p-1 rounded-lg ${c.cor}`} />
                <p className="text-xl font-bold text-slate-800 mt-1">{c.valor}</p>
                <p className="text-xs text-slate-500">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
