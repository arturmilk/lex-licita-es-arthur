"use client";
import React, { useEffect, useRef, useState } from "react";
import { Send, Mic, Paperclip, Loader2, Bot, User, AlertTriangle, CheckCircle2, FileText, Sparkles, Plus } from "lucide-react";
import { novaConversaChat, enviarMensagemChat, listarConversasChat, criarProcessoDaConversa, carregarConversaChat } from "@/lib/actions-chat";

interface Mensagem {
  id: string;
  papel: "servidor" | "sistema";
  tipo: "texto" | "pergunta" | "documento" | "alerta" | "card";
  conteudo: string;
  opcoes?: string[];
  criadaEm: string;
}

interface Conversa {
  id: string;
  titulo: string;
  etapaAtual: string | null;
  mensagens: Mensagem[] | null;
  processoId: string | null;
  finalizada: boolean;
}

/** Renderiza conteúdo com **negrito** simples. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
      )}
    </>
  );
}

export default function ChatGuiadoPage() {
  const [conversa, setConversa] = useState<Conversa | null>(null);
  const [historico, setHistorico] = useState<Conversa[]>([]);
  const [input, setInput] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [criandoProcesso, setCriandoProcesso] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    listarConversasChat().then(setHistorico).catch(() => {});
    // Se veio do painel com ?intencao=, inicia a conversa já com a intenção
    const qs = new URLSearchParams(window.location.search);
    const intencao = qs.get("intencao");
    if (intencao) {
      (async () => {
        try {
          const r = await novaConversaChat();
          setConversa(r.conversa as Conversa);
          const resp = await enviarMensagemChat(r.conversa.id, intencao);
          setConversa(prev => prev ? {
            ...prev,
            mensagens: [...(prev.mensagens || []), ...resp.mensagens],
            etapaAtual: resp.estado.etapa,
          } : prev);
          setHistorico(await listarConversasChat());
          // limpa a URL (não repetir ao recarregar)
          window.history.replaceState({}, "", "/assistente");
        } catch (e: any) {
          setErro(String(e?.message || e));
        }
      })();
    }
  }, []);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversa?.mensagens?.length]);

  const iniciarNova = async () => {
    setErro(null);
    try {
      const r = await novaConversaChat();
      setConversa(r.conversa as Conversa);
      setHistorico(await listarConversasChat());
    } catch (e: any) {
      setErro(String(e?.message || e));
    }
  };

  const abrirConversa = async (id: string) => {
    try {
      const r = await carregarConversaChat(id);
      setConversa(r.conversa as Conversa);
      setMostrarHistorico(false);
    } catch (e: any) {
      setErro(String(e?.message || e));
    }
  };

  const enviar = async (texto: string) => {
    if (!conversa || !texto.trim() || enviando) return;
    setEnviando(true);
    setInput("");
    setErro(null);
    try {
      // feedback otimista: mostra a mensagem do servidor
      setConversa(prev => prev ? {
        ...prev,
        mensagens: [...(prev.mensagens || []), {
          id: "local-" + Date.now(), papel: "servidor", tipo: "texto", conteudo: texto, criadaEm: new Date().toISOString(),
        }],
      } : prev);
      const r = await enviarMensagemChat(conversa.id, texto);
      setConversa(prev => {
        if (!prev) return prev;
        // remove a local e usa as reais
        const semLocal = prev.mensagens?.filter(m => !m.id.startsWith("local-")) || [];
        return { ...prev, mensagens: [...semLocal, ...r.mensagens], etapaAtual: r.estado.etapa };
      });
      setHistorico(await listarConversasChat());
    } catch (e: any) {
      setErro(String(e?.message || e));
      setInput(texto);
    } finally {
      setEnviando(false);
    }
  };

  // ── Gravação de voz ──────────────────────────────────────────
  const iniciarGravacao = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setErro("Gravação de voz não disponível neste navegador.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        transcreverAudio(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.current = mr;
      mr.start();
      setGravando(true);
    } catch {
      setErro("Não consegui acessar o microfone. Verifique as permissões.");
    }
  };

  const pararGravacao = () => {
    mediaRecorder.current?.stop();
    setGravando(false);
  };

  const transcreverAudio = async (blob: Blob) => {
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", blob, "voz.webm");
      const resp = await fetch("/api/ia/transcrever", { method: "POST", body: fd });
      const data = await resp.json();
      if (data.texto) {
        await enviar(data.texto);
      } else {
        setErro("Não entendi o áudio. Pode repetir?");
      }
    } catch {
      setErro("Erro ao transcrever o áudio.");
    } finally {
      setEnviando(false);
    }
  };

  // ── Anexo de documento ───────────────────────────────────────
  const anexarDocumento = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversa) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", file);
      const resp = await fetch("/api/ia/documento", { method: "POST", body: fd });
      const data = await resp.json();
      const resumo = data.resumo;
      const textoIdentificado = resumo?.aconteceu || `Anexei o documento ${file.name}`;
      // informa ao chat o que foi identificado
      const r = await enviarMensagemChat(conversa.id, `Anexei o documento ${file.name}. ${textoIdentificado.slice(0, 200)}`);
      setConversa(prev => prev ? {
        ...prev,
        mensagens: [...(prev.mensagens || []), {
          id: "doc-" + Date.now(), papel: "sistema", tipo: "documento",
          conteudo: `📎 **${file.name}** recebido e identificado!\n\n${resumo?.importa || ""}`,
          criadaEm: new Date().toISOString(),
        }, ...r.mensagens],
        etapaAtual: r.estado.etapa,
      } : prev);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setEnviando(false);
      e.target.value = "";
    }
  };

  const criarProcesso = async (tipoId: string) => {
    if (!conversa) return;
    setCriandoProcesso(true);
    try {
      const r = await criarProcessoDaConversa(conversa.id, tipoId);
      window.location.href = `/processos/${r.processo.id}/jornada`;
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setCriandoProcesso(false);
    }
  };

  const estiloBalao = (m: Mensagem) => {
    if (m.papel === "servidor") return "bg-indigo-600 text-white ml-auto";
    switch (m.tipo) {
      case "alerta": return "bg-amber-50 border border-amber-200 text-amber-900";
      case "documento": return "bg-emerald-50 border border-emerald-200 text-emerald-900";
      case "card": return "bg-slate-50 border border-slate-200 text-slate-800";
      default: return "bg-white border border-slate-200 text-slate-800";
    }
  };

  const iconeBalao = (m: Mensagem) => {
    if (m.papel === "servidor") return <User size={13} className="text-indigo-300" />;
    if (m.tipo === "alerta") return <AlertTriangle size={13} className="text-amber-500" />;
    if (m.tipo === "documento") return <FileText size={13} className="text-emerald-600" />;
    if (m.tipo === "card") return <Sparkles size={13} className="text-indigo-500" />;
    return <Bot size={13} className="text-slate-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-800">💬 O que vou contratar hoje?</h1>
          <p className="text-sm text-slate-500">Eu conduzo sua contratação do início ao fim — digite, fale ou anexe um documento.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarHistorico(!mostrarHistorico)}
            className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            🕘 Conversas ({historico.length})
          </button>
          <button
            onClick={iniciarNova}
            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg cursor-pointer"
          >
            <Plus size={13} /> Nova contratação
          </button>
        </div>
      </div>

      {/* Histórico de conversas */}
      {mostrarHistorico && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 space-y-1.5">
          {historico.length === 0 && <p className="text-xs text-slate-400 px-2 py-1">Nenhuma conversa ainda.</p>}
          {historico.map((c) => (
            <button
              key={c.id}
              onClick={() => abrirConversa(c.id)}
              className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer"
            >
              <span className="text-sm text-slate-700 truncate">{c.titulo}</span>
              <span className="text-[10px] text-slate-400 shrink-0">
                {c.finalizada ? "✅ finalizada" : c.etapaAtual}
              </span>
            </button>
          ))}
        </div>
      )}

      {erro && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>
      )}

      {/* Chat */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/50 shadow-sm overflow-hidden">
        {/* Mensagens */}
        <div className="h-[52vh] overflow-y-auto p-4 space-y-3">
          {!conversa ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Bot size={36} className="text-indigo-300" />
              <p className="text-sm text-slate-400 max-w-xs">
                Clique em <strong>Nova contratação</strong> para começar. Eu pergunto o necessário, explico cada documento e conduzo você até a publicação.
              </p>
            </div>
          ) : (conversa.mensagens?.length || 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Bot size={36} className="text-indigo-300" />
              <p className="text-sm text-slate-400">Carregando…</p>
            </div>
          ) : (
            conversa.mensagens?.map((m) => (
              <div key={m.id} className={`flex ${m.papel === "servidor" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${estiloBalao(m)}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {iconeBalao(m)}
                    <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">
                      {m.papel === "servidor" ? "Você" : m.tipo === "alerta" ? "Alerta" : m.tipo === "documento" ? "Documento" : "Assistente"}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap"><Rich text={m.conteudo} /></div>
                  {m.opcoes && m.opcoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {m.opcoes.map((op) => (
                        <button
                          key={op}
                          onClick={() => enviar(op)}
                          disabled={enviando}
                          className="text-[11px] font-semibold bg-white border border-slate-300 text-slate-700 hover:border-indigo-400 hover:text-indigo-700 px-2.5 py-1.5 rounded-full cursor-pointer disabled:opacity-50"
                        >
                          {op}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {enviando && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 shadow-sm">
                <Loader2 size={13} className="animate-spin text-indigo-500" />
                <span className="text-xs text-slate-400">pensando…</span>
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Input */}
        <div className="border-t border-slate-200 bg-white p-3">
          <div className="flex items-end gap-2">
            <input
              type="file"
              accept=".pdf,.txt,.md,.docx"
              onChange={anexarDocumento}
              className="hidden"
              id="anexo-chat"
            />
            <button
              onClick={() => document.getElementById("anexo-chat")?.click()}
              disabled={!conversa || enviando}
              title="Anexar documento"
              className="p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 cursor-pointer disabled:opacity-40"
            >
              <Paperclip size={16} />
            </button>
            <button
              onClick={gravando ? pararGravacao : iniciarGravacao}
              disabled={!conversa || enviando}
              title={gravando ? "Parar gravação" : "Falar"}
              className={`p-2.5 rounded-xl border cursor-pointer disabled:opacity-40 ${gravando ? "bg-red-500 border-red-500 text-white animate-pulse" : "border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300"}`}
            >
              <Mic size={16} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviar(input); }}
              placeholder={conversa ? "Digite sua resposta…" : "Clique em Nova contratação para começar"}
              disabled={!conversa || enviando}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400 text-sm disabled:bg-slate-50"
            />
            <button
              onClick={() => enviar(input)}
              disabled={!conversa || !input.trim() || enviando}
              className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </div>
          {gravando && (
            <p className="mt-2 text-[11px] text-red-500 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Gravando… fale e clique no microfone para parar.
            </p>
          )}
        </div>
      </div>

      <p className="mt-3 text-[11px] text-slate-400 text-center">
        O assistente nunca trava: se faltar um documento, ele alerta e explica a implicação — mas segue conduzindo. 🤝
      </p>
    </div>
  );
}
