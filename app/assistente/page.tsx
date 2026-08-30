"use client";
import React, { useEffect, useRef, useState } from "react";
import { Send, Mic, Paperclip, Loader2, Bot, User, AlertTriangle, CheckCircle2, FileText, Sparkles, Plus } from "lucide-react";
import { novaConversaChat, enviarMensagemChat, listarConversasChat, criarProcessoDaConversa, carregarConversaChat } from "@/lib/actions-chat";

/** ErrorBoundary — nunca deixa o chat em tela branca: mostra fallback com recarregar. */
class ChatErrorBoundary extends React.Component<{ children: React.ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(err: any) { console.error("ChatErrorBoundary:", err); }
  render() {
    if (this.state.erro) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <p className="text-sm text-slate-600">Algo deu errado ao exibir esta conversa 😕</p>
          <button
            onClick={() => { this.setState({ erro: false }); window.location.reload(); }}
            className="text-xs font-semibold text-white bg-indigo-600 px-4 py-2 rounded-full cursor-pointer"
          >
            Recarregar conversa
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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

/** Renderiza conteúdo com **negrito** simples (protegido contra ** desbalanceados). */
function Rich({ text }: { text: string }) {
  const seguro = (text || "").replace(/\*\*/g, "**");
  const parts = seguro.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") && p.length > 4 ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>
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
      // O anexo RESPONDE à pergunta atual do chat — o motor reconhece "anexei"
      // e marca o documento da etapa como recebido. Se o documento não for o
      // esperado, o chat pergunta de novo.
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
    <div className="max-w-3xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">Estima.IA Assistente</h1>
            <p className="text-[11px] text-slate-400">Conduzo sua contratação do início ao fim</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarHistorico(!mostrarHistorico)}
            className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-50 cursor-pointer"
          >
            🕘 Conversas ({historico.length})
          </button>
          <button
            onClick={iniciarNova}
            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-full cursor-pointer"
          >
            <Plus size={13} /> Nova conversa
          </button>
        </div>
      </div>

      {/* Histórico de conversas */}
      {mostrarHistorico && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 space-y-1.5 max-h-48 overflow-y-auto">
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

      {/* Chat — estilo ChatGPT: sem card, altura total, fundo limpo */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {!conversa ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
                <Bot size={28} className="text-white" />
              </div>
              <p className="text-base font-semibold text-slate-700">Como posso ajudar hoje?</p>
              <p className="text-sm text-slate-400 max-w-sm">
                Diga o que você precisa contratar — eu pergunto o necessário, explico cada documento e conduzo você até a publicação.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                <button onClick={iniciarNova} className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-full cursor-pointer">
                  ✨ Nova contratação
                </button>
                <button onClick={() => setMostrarHistorico(true)} className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-full cursor-pointer">
                  🕘 Ver conversas anteriores
                </button>
              </div>
            </div>
          ) : (conversa.mensagens?.length || 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Bot size={36} className="text-indigo-300" />
              <p className="text-sm text-slate-400">Carregando…</p>
            </div>
          ) : (
            <ChatErrorBoundary>
              {conversa.mensagens?.map((m) => (
                <div key={m.id} className={`flex ${m.papel === "servidor" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-3xl px-4 py-3 ${estiloBalao(m)}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {iconeBalao(m)}
                    <span className="text-[9px] font-bold uppercase tracking-wide opacity-60">
                      {m.papel === "servidor" ? "Você" : m.tipo === "alerta" ? "Alerta" : m.tipo === "documento" ? "Documento" : "Assistente"}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed"><Rich text={m.conteudo} /></div>
                  {m.opcoes && m.opcoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {m.opcoes.map((op) => (
                        <button
                          key={op}
                          onClick={() => {
                            // "Anexar arquivo" abre o seletor em vez de enviar texto
                            if (op.includes("Anexar arquivo")) {
                              document.getElementById("anexo-chat")?.click();
                            } else {
                              enviar(op);
                            }
                          }}
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
              ))}
            </ChatErrorBoundary>
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

        {/* Input — estilo ChatGPT: container arredondado com sombra */}
        <div className="pb-2">
          <div className="flex items-end gap-2 rounded-3xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm focus-within:border-indigo-400 transition-colors">
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
              title="Anexar documento (responde à pergunta atual)"
              className="p-2 rounded-full text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer disabled:opacity-40 shrink-0"
            >
              <Paperclip size={18} />
            </button>
            <button
              onClick={gravando ? pararGravacao : iniciarGravacao}
              disabled={!conversa || enviando}
              title={gravando ? "Parar gravação" : "Falar"}
              className={`p-2 rounded-full cursor-pointer disabled:opacity-40 shrink-0 ${gravando ? "bg-red-500 text-white animate-pulse" : "text-slate-400 hover:text-red-600 hover:bg-red-50"}`}
            >
              <Mic size={18} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviar(input); }}
              placeholder={conversa ? "Digite sua resposta…" : "Clique em Nova conversa para começar"}
              disabled={!conversa || enviando}
              className="flex-1 bg-transparent px-1 py-1.5 focus:outline-none text-sm disabled:opacity-50"
            />
            <button
              onClick={() => enviar(input)}
              disabled={!conversa || !input.trim() || enviando}
              className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-40 shrink-0"
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

      <p className="mt-1 text-[11px] text-slate-400 text-center">
        O assistente nunca trava: se faltar um documento, ele alerta e explica a implicação — mas segue conduzindo. 🤝
      </p>
    </div>
  );
}
