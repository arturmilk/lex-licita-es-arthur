"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Loader2, FileText, History, ShieldAlert, Wand2, ChevronRight, CheckSquare } from "lucide-react";
import { obterTarefasDoProcesso, avancarEtapa, obterHistorico, gerarMinuta, listarMinutas } from "@/lib/actions-intencao";

export default function JornadaPage({ params }: { params: { id: string } }) {
  const [tarefas, setTarefas] = useState<any[] | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);
  const [minutas, setMinutas] = useState<any[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState<any | null>(null);
  const [docsMarcados, setDocsMarcados] = useState<string[]>([]);
  const [assinado, setAssinado] = useState(false);
  const [avancando, setAvancando] = useState(false);
  const [gerandoMinuta, setGerandoMinuta] = useState(false);
  const [minutaContexto, setMinutaContexto] = useState("");
  const [tipoMinuta, setTipoMinuta] = useState("despacho");

  const carregar = async () => {
    const ts = await obterTarefasDoProcesso(params.id);
    setTarefas(ts);
    setAtual(ts.find((t: any) => t.status === "em_andamento") || ts.find((t: any) => t.status === "pendente") || null);
    setHistorico(await obterHistorico(params.id));
    setMinutas(await listarMinutas(params.id));
  };

  useEffect(() => {
    carregar().catch((e) => setErro(String(e?.message || e)));
  }, [params.id]);

  async function avancar() {
    if (!atual) return;
    setAvancando(true);
    try {
      const r = await avancarEtapa(atual.id, docsMarcados, assinado);
      if (r.ok) {
        setDocsMarcados([]);
        setAssinado(false);
        await carregar();
      } else {
        setErro(r.mensagem);
        setTimeout(() => setErro(null), 5000);
      }
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setAvancando(false);
    }
  }

  async function gerarMin() {
    setGerandoMinuta(true);
    try {
      await gerarMinuta({ processoId: params.id, tipo: tipoMinuta, contexto: minutaContexto });
      setMinutaContexto("");
      setMinutas(await listarMinutas(params.id));
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setGerandoMinuta(false);
    }
  }

  const docsNecessarios = (atual as any)?.documentosNecessarios || [];
  const precisaAssinatura = (atual as any)?.validacoes?.some((v: any) => v.tipo === "assinatura");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link href="/painel" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 mb-4">
        <ArrowLeft size={14} /> Voltar ao painel
      </Link>

      {erro && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{erro}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Jornada guiada do processo</h1>
          <p className="text-sm text-slate-500">{params.id.slice(0, 8)} — o sistema conduz etapa por etapa</p>
        </div>
      </div>

      {/* Progresso */}
      {tarefas && (
        <div className="mb-6 flex items-center gap-1.5 flex-wrap">
          {tarefas.map((t, i) => (
            <React.Fragment key={t.id}>
              <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border ${
                t.status === "concluida" ? "bg-green-50 text-green-700 border-green-200"
                : t.status === "em_andamento" ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-400 border-slate-200"
              }`}>
                {t.status === "concluida" ? <CheckCircle2 size={12} /> : t.status === "em_andamento" ? <Circle size={12} /> : <Circle size={12} className="opacity-40" />}
                {i + 1}. {t.titulo}
              </div>
              {i < tarefas.length - 1 && <ChevronRight size={12} className="text-slate-300" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Etapa atual */}
      {atual ? (
        <div className="rounded-2xl border-2 border-indigo-200 bg-white p-6 shadow-sm mb-6">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Etapa atual</p>
          <h2 className="text-lg font-bold text-slate-800 mb-1">{atual.titulo}</h2>
          <p className="text-sm text-slate-600 mb-4">{atual.descricao || atual.instrucao}</p>

          {/* Checklist de documentos */}
          {docsNecessarios.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documentos necessários</p>
              <div className="space-y-1.5">
                {docsNecessarios.map((doc: string) => {
                  const marcado = docsMarcados.includes(doc);
                  return (
                    <label key={doc} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => setDocsMarcados(marcado ? docsMarcados.filter((d) => d !== doc) : [...docsMarcados, doc])}
                        className="accent-indigo-600"
                      />
                      <span className={`text-sm ${marcado ? "text-slate-400 line-through" : "text-slate-700"}`}>{doc}</span>
                      {marcado && <CheckCircle2 size={14} className="ml-auto text-green-500" />}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assinatura */}
          {precisaAssinatura && (
            <label className="flex items-center gap-2.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 cursor-pointer mb-4">
              <input type="checkbox" checked={assinado} onChange={(e) => setAssinado(e.target.checked)} className="accent-purple-600" />
              <span className="text-sm text-purple-800">Confirmo que o documento foi assinado pela autoridade competente</span>
              <ShieldAlert size={14} className="ml-auto text-purple-500" />
            </label>
          )}

          {/* Validação antes de avançar */}
          <button
            onClick={avancar}
            disabled={avancando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
          >
            {avancando ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
            Concluir etapa e avançar
          </button>
          <p className="mt-2 text-[11px] text-slate-400">O sistema valida documentos e assinaturas antes de liberar a próxima etapa.</p>
        </div>
      ) : tarefas && tarefas.length > 0 ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center mb-6">
          <CheckCircle2 size={28} className="mx-auto text-green-600 mb-2" />
          <p className="font-semibold text-green-800">Processo finalizado!</p>
          <p className="text-sm text-green-700">Todas as etapas foram concluídas.</p>
        </div>
      ) : null}

      {/* Minutas */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 size={16} className="text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Gerar minuta de documento</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {["despacho", "parecer", "memorando", "oficio", "justificativa", "relatorio"].map((t) => (
            <button
              key={t}
              onClick={() => setTipoMinuta(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                tipoMinuta === t ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <textarea
          value={minutaContexto}
          onChange={(e) => setMinutaContexto(e.target.value)}
          placeholder="O que deve constar no documento? Ex.: justificar por que o prazo foi prorrogado..."
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 text-sm min-h-[70px]"
        />
        <button
          onClick={gerarMin}
          disabled={gerandoMinuta}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 text-sm font-semibold hover:bg-indigo-200 disabled:opacity-50 cursor-pointer"
        >
          {gerandoMinuta ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Gerar minuta
        </button>

        {minutas.length > 0 && (
          <div className="mt-4 space-y-2">
            {minutas.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{m.tipo} · {m.status}</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{m.conteudo}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Histórico completo</h3>
        </div>
        {historico.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">Nenhuma ação registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {historico.map((h) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex flex-col items-center">
                  <CheckCircle2 size={14} className="text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-700">{h.descricao}</p>
                  <p className="text-xs text-slate-400">
                    {h.usuarioNome || "Sistema"} · {h.createdAt ? new Date(h.createdAt).toLocaleString("pt-BR") : ""} · {h.acao}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
