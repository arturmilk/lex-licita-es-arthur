"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Search, BookOpen, Loader2 } from "lucide-react";
import { buscarTudo, consultarLegislacao } from "@/lib/actions-intencao";

export default function BuscaPage() {
  const [busca, setBusca] = useState("");
  const [resultadoBusca, setResultadoBusca] = useState<any>(null);
  const [buscando, setBuscando] = useState(false);
  const [perguntaLei, setPerguntaLei] = useState("");
  const [legis, setLegis] = useState<any[] | null>(null);
  const [perguntandoLei, setPerguntandoLei] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pesquisar = async () => {
    if (busca.trim().length < 3) return;
    setBuscando(true);
    setErro(null);
    try {
      setResultadoBusca(await buscarTudo(busca.trim()));
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setBuscando(false);
    }
  };

  const perguntarLei = async () => {
    if (perguntaLei.trim().length < 3) return;
    setPerguntandoLei(true);
    setErro(null);
    try {
      setLegis(await consultarLegislacao(perguntaLei.trim()));
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setPerguntandoLei(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-1">🔍 Busca inteligente</h1>
      <p className="text-sm text-slate-500 mb-6">Encontre processos, documentos, normas e informações em linguagem natural.</p>

      {erro && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Busca inteligente */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Search size={16} className="text-indigo-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Buscar no sistema</h3>
          </div>
          <div className="flex gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && pesquisar()}
              placeholder="Ex.: processos de aquisição parados há mais de 10 dias"
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 text-sm"
            />
            <button onClick={pesquisar} disabled={buscando} className="px-3 py-2 rounded-lg bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer disabled:opacity-50">
              {buscando ? <Loader2 size={13} className="animate-spin" /> : "Buscar"}
            </button>
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

        {/* Legislação */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={16} className="text-indigo-600" />
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
            <button onClick={perguntarLei} disabled={perguntandoLei} className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold hover:bg-indigo-200 cursor-pointer disabled:opacity-50">
              {perguntandoLei ? <Loader2 size={13} className="animate-spin" /> : "Perguntar"}
            </button>
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
    </div>
  );
}
