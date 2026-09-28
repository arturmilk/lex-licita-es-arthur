"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, BookOpen, Loader2, FileText, ListTodo, ChevronRight, Scale } from "lucide-react";
import { buscarTudo, consultarLegislacao } from "@/lib/actions-intencao";
import { CabecalhoPagina, Secao, Situacao, AvisoErro } from "@/components/Pagina";

const EXEMPLOS_SISTEMA = ["pesquisa de preços", "ETP", "Lei 14.133"];
const EXEMPLOS_LEI = ["pesquisa de preços", "ME/EPP", "ETP Digital", "valor estimado"];

function Grupo({ titulo, qtd, icone: Icone, children }: { titulo: string; qtd: number; icone: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        <Icone size={13} aria-hidden /> {titulo} <span className="font-normal normal-case tracking-normal">({qtd})</span>
      </p>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">{children}</ul>
    </div>
  );
}

function BuscaConteudo() {
  const params = useSearchParams();
  const termoUrl = params.get("q") || "";
  const [busca, setBusca] = useState("");
  const [resultadoBusca, setResultadoBusca] = useState<any>(null);
  const [termoBuscado, setTermoBuscado] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [perguntaLei, setPerguntaLei] = useState("");
  const [legis, setLegis] = useState<any[] | null>(null);
  const [perguntandoLei, setPerguntandoLei] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pesquisar = async (termo = busca) => {
    const t = termo.trim();
    if (t.length < 3) return;
    setBusca(t);
    setBuscando(true);
    setErro(null);
    try {
      setResultadoBusca(await buscarTudo(t));
      setTermoBuscado(t);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setBuscando(false);
    }
  };

  // Permite vir da busca global (Ctrl/⌘+K) já com o termo: /busca?q=...
  // Reage à mudança do termo — inclusive quando a busca global é usada nesta mesma tela.
  useEffect(() => {
    if (termoUrl.trim().length >= 3) pesquisar(termoUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termoUrl]);

  const perguntarLei = async (termo = perguntaLei) => {
    const t = termo.trim();
    if (t.length < 3) return;
    setPerguntaLei(t);
    setPerguntandoLei(true);
    setErro(null);
    try {
      setLegis(await consultarLegislacao(t));
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setPerguntandoLei(false);
    }
  };

  const nadaNoSistema =
    resultadoBusca && !resultadoBusca.processos?.length && !resultadoBusca.normas?.length && !resultadoBusca.tarefas?.length;

  return (
    <div>
      <CabecalhoPagina
        titulo="Busca"
        descricao="Digite uma palavra, um número de processo ou um tema. O LEX procura nos processos, tarefas e normas do seu órgão."
      />

      {erro && <AvisoErro>A busca não respondeu. {erro}</AvisoErro>}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Busca no sistema */}
        <Secao titulo="Buscar no sistema" descricao="Processos, tarefas e normas." icone={Search} corpoClassName="p-5">
          <form onSubmit={(e) => { e.preventDefault(); pesquisar(); }} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="busca-sistema" className="sr-only">O que você procura</label>
            <input
              id="busca-sistema"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Ex.: número do processo, objeto ou tema"
              className="inp"
            />
            <button type="submit" disabled={buscando || busca.trim().length < 3} className="btn btn-primary shrink-0">
              {buscando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Search size={16} aria-hidden />}
              Buscar
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Experimente:</span>
            {EXEMPLOS_SISTEMA.map((ex) => (
              <button key={ex} type="button" onClick={() => pesquisar(ex)} className="chip">{ex}</button>
            ))}
          </div>

          {resultadoBusca && (
            <div className="mt-5 space-y-4" aria-live="polite">
              {resultadoBusca.processos?.length > 0 && (
                <Grupo titulo="Processos" qtd={resultadoBusca.processos.length} icone={FileText}>
                  {resultadoBusca.processos.map((p: any) => (
                    <li key={p.id}>
                      <Link href={`/processos/${p.id}/jornada`} className="group flex items-center gap-3 px-3.5 py-3 linha-clicavel">
                        <span className="protocolo">{p.numero}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink-950">{p.objeto}</span>
                        <Situacao status={p.status} />
                        <ChevronRight size={15} className="shrink-0 text-slate-400" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </Grupo>
              )}
              {resultadoBusca.normas?.length > 0 && (
                <Grupo titulo="Normas" qtd={resultadoBusca.normas.length} icone={Scale}>
                  {resultadoBusca.normas.map((n: any) => (
                    <li key={n.id} className="px-3.5 py-3">
                      <p className="text-sm font-medium text-ink-950">{n.titulo}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{n.conteudo.slice(0, 160)}…</p>
                      <p className="mt-1.5 text-xs text-slate-500">Fonte: {n.fonte}</p>
                    </li>
                  ))}
                </Grupo>
              )}
              {resultadoBusca.tarefas?.length > 0 && (
                <Grupo titulo="Tarefas" qtd={resultadoBusca.tarefas.length} icone={ListTodo}>
                  {resultadoBusca.tarefas.map((t: any) => (
                    <li key={t.id}>
                      {t.processoId ? (
                        <Link href={`/processos/${t.processoId}/jornada`} className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm text-ink-950 linha-clicavel">
                          {t.titulo} <ChevronRight size={15} className="shrink-0 text-slate-400" aria-hidden />
                        </Link>
                      ) : (
                        <p className="px-3.5 py-3 text-sm text-slate-700">{t.titulo}</p>
                      )}
                    </li>
                  ))}
                </Grupo>
              )}
              {nadaNoSistema && (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Nada encontrado para <b className="font-semibold text-ink-950">“{termoBuscado}”</b>. Tente uma palavra mais curta ou outro termo.
                </p>
              )}
            </div>
          )}
        </Secao>

        {/* Legislação */}
        <Secao titulo="Perguntar sobre a legislação" descricao="Leis, instruções normativas e regras internas." icone={BookOpen} corpoClassName="p-5">
          <form onSubmit={(e) => { e.preventDefault(); perguntarLei(); }} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="busca-lei" className="sr-only">Tema da legislação</label>
            <input
              id="busca-lei"
              value={perguntaLei}
              onChange={(e) => setPerguntaLei(e.target.value)}
              placeholder="Ex.: pesquisa de preços, ME/EPP, ETP"
              className="inp"
            />
            <button type="submit" disabled={perguntandoLei || perguntaLei.trim().length < 3} className="btn btn-outline shrink-0">
              {perguntandoLei ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <BookOpen size={16} aria-hidden />}
              Consultar
            </button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Experimente:</span>
            {EXEMPLOS_LEI.map((ex) => (
              <button key={ex} type="button" onClick={() => perguntarLei(ex)} className="chip">{ex}</button>
            ))}
          </div>

          {legis && (
            <div className="mt-5" aria-live="polite">
              {legis.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Nenhuma norma encontrada para esse tema. Tente outra palavra, como “pesquisa” ou “ETP”.
                </p>
              ) : (
                <ul className="space-y-5">
                  {legis.map((n, i) => (
                    <li key={i} className="border-l-2 border-ink-200 pl-4">
                      <p className="text-sm font-semibold text-ink-950">{n.titulo}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{n.conteudo}</p>
                      <p className="mt-2 text-xs text-slate-500">Fonte: {n.fonte}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}

export default function BuscaPage() {
  return (
    <Suspense fallback={null}>
      <BuscaConteudo />
    </Suspense>
  );
}
