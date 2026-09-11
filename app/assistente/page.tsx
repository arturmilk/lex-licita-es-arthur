"use client";
import React, { useEffect, useRef, useState } from "react";
import { Send, Mic, Paperclip, Loader2, Bot, User, AlertTriangle, CheckCircle2, FileText, Sparkles, Plus, History, Wand2, X } from "lucide-react";
import { novaConversaChat, enviarMensagemChat, listarConversasChat, criarProcessoDaConversa, carregarConversaChat, melhorarTrechoDocumento, salvarDocumentoEditado } from "@/lib/actions-chat";
import { CAMPOS_ETP, GRUPOS_ETP } from "@/lib/etp-model";

/** ErrorBoundary — nunca deixa o chat em tela branca: mostra fallback com recarregar. */
class ChatErrorBoundary extends React.Component<{ children: React.ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() { return { erro: true }; }
  componentDidCatch(err: any) { console.error("ChatErrorBoundary:", err); }
  render() {
    if (this.state.erro) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
          <p className="text-sm text-slate-600">Algo deu errado ao exibir esta conversa </p>
          <button
            onClick={() => { this.setState({ erro: false }); window.location.reload(); }}
            className="text-xs font-semibold text-white bg-[#032650] px-4 py-2 rounded-full cursor-pointer"
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
  completo?: string;   // documento completo (para download/edição)
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
  statusDocumentos?: any;
}

interface BlocoEdicao {
  id: string;
  texto: string;
  complemento: string;
  melhorando?: boolean;
  fontes?: { titulo: string; fonte: string; link?: string }[];
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
    const modo = qs.get("modo");
    if (modo && !intencao) {
      (async () => {
        try {
          const r = await novaConversaChat(modo);
          setConversa(r.conversa as Conversa);
          setHistorico(await listarConversasChat());
          window.history.replaceState({}, "", "/assistente");
        } catch (e: any) {
          setErro(String(e?.message || e));
        }
      })();
    } else if (intencao) {
      (async () => {
        try {
          const r = await novaConversaChat();
          setConversa(r.conversa as Conversa);
          const resp = await enviarMensagemChat(r.conversa.id, intencao);
          setConversa(prev => prev ? {
            ...prev,
            mensagens: [...(prev.mensagens || []), ...resp.mensagens],
            etapaAtual: resp.estado.etapa,
            statusDocumentos: resp.estado,
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

  // ── AGENTE HISTORIADOR: padrões do órgão + briefing de antecipação ──
  const [briefingHist, setBriefingHist] = useState<any | null>(null);
  const [carregandoBriefing, setCarregandoBriefing] = useState(false);

  const carregarBriefing = async () => {
    setCarregandoBriefing(true);
    setBriefingHist(null);
    try {
      const { briefingHistoriador } = await import("@/lib/actions-chat");
      const r = await briefingHistoriador();
      setBriefingHist(r);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setCarregandoBriefing(false);
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
        return { ...prev, mensagens: [...semLocal, ...r.mensagens], etapaAtual: r.estado.etapa, statusDocumentos: r.estado };
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
          conteudo: ` **${file.name}** recebido e identificado!\n\n${resumo?.importa || ""}`,
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

  // ── Baixar documento (usa o texto COMPLETO, não a prévia truncada) ──
  const baixarDocumento = (m: Mensagem) => {
    const texto = (m.completo || m.conteudo || "").replace(/\*\*/g, "");
    const nome = m.conteudo.includes("EDITAL") ? "edital" : (m.conteudo.includes("PEDIDO DE COMPRA") || m.conteudo.includes("DFD") || m.conteudo.includes("Requisição")) ? "dfd_requisicao" : m.conteudo.includes("ESTUDO TÉCNICO") ? "etp" : "documento";
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome}_estimaia_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Editor por seção: complemento humano + melhoria técnica por IA ────────
  const [editando, setEditando] = useState<{ m: Mensagem; blocos: BlocoEdicao[] } | null>(null);

  const dividirDocumento = (textoBruto: string): BlocoEdicao[] => {
    const texto = (textoBruto || "").replace(/\r/g, "").trim();
    if (!texto) return [];
    const linhas = texto.split("\n");
    const blocosTexto: string[] = [];
    let atual: string[] = [];
    const pareceTitulo = (linha: string) => {
      const t = linha.trim();
      if (!t || t.length > 150) return false;
      if (/^\d+(?:\.\d+)*(?:[.)-])?\s+\S+/.test(t)) return true;
      if (/^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)[.)-]?\s+\S+/i.test(t)) return true;
      const letras = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
      return letras.length >= 5 && t === t.toUpperCase() && !/[.!?]$/.test(t);
    };

    for (const linha of linhas) {
      if (pareceTitulo(linha) && atual.some(l => l.trim())) {
        blocosTexto.push(atual.join("\n").trim());
        atual = [linha];
      } else {
        atual.push(linha);
      }
    }
    if (atual.some(l => l.trim())) blocosTexto.push(atual.join("\n").trim());

    // Documentos sem títulos explícitos: divide por parágrafos, sem fragmentar demais.
    const base = blocosTexto.length >= 2 ? blocosTexto : texto.split(/\n{2,}/).filter(Boolean);
    const normalizados: string[] = [];
    for (const b of base) {
      if (b.length < 220 && normalizados.length && !pareceTitulo(b.split("\n")[0] || "")) {
        normalizados[normalizados.length - 1] += `\n\n${b}`;
      } else normalizados.push(b);
    }
    return normalizados.map((texto, i) => ({ id: `bloco-${i}-${Date.now()}`, texto, complemento: "", fontes: [] }));
  };

  const abrirEditor = (m: Mensagem) => {
    const texto = (m.completo || m.conteudo || "").replace(/\*\*/g, "");
    setEditando({ m, blocos: dividirDocumento(texto) });
  };

  const textoEditorCompleto = () => editando?.blocos.map(b => b.texto.trim()).filter(Boolean).join("\n\n") || "";

  const atualizarBloco = (idx: number, patch: Partial<BlocoEdicao>) => {
    setEditando(prev => prev ? {
      ...prev,
      blocos: prev.blocos.map((b, i) => i === idx ? { ...b, ...patch } : b),
    } : prev);
  };

  const melhorarBloco = async (idx: number) => {
    if (!editando || !conversa) return;
    const bloco = editando.blocos[idx];
    atualizarBloco(idx, { melhorando: true });
    setErro(null);
    try {
      const titulo = bloco.texto.split("\n")[0]?.slice(0, 140) || `Seção ${idx + 1}`;
      const tipoDocumento = editando.m.conteudo.includes("ESTUDO TÉCNICO") ? "etp" : (editando.m.conteudo.includes("DFD") || editando.m.conteudo.includes("Requisição")) ? "dfd" : editando.m.conteudo.includes("EDITAL") ? "edital" : "documento";
      const r = await melhorarTrechoDocumento(conversa.id, bloco.texto, bloco.complemento, titulo, tipoDocumento);
      atualizarBloco(idx, { texto: r.texto, complemento: "", fontes: r.fontes || [], melhorando: false });
    } catch (e: any) {
      atualizarBloco(idx, { melhorando: false });
      setErro(String(e?.message || e));
    }
  };

  const salvarEdicao = async () => {
    if (!editando || !conversa) return;
    const texto = textoEditorCompleto();
    if (!texto.trim()) return;
    try {
      const titulo = editando.m.conteudo.includes("DFD") || editando.m.conteudo.includes("Requisição")
        ? "DFD / Requisição de Compra — versão revisada"
        : editando.m.conteudo.includes("ESTUDO TÉCNICO") ? "ETP — versão revisada"
        : editando.m.conteudo.includes("EDITAL") ? "Edital — versão revisada"
        : "Documento — versão revisada";
      const mensagem = await salvarDocumentoEditado(conversa.id, texto, titulo);
      setConversa(prev => prev ? {
        ...prev,
        mensagens: [...(prev.mensagens || []), mensagem as Mensagem],
      } : prev);
      setHistorico(await listarConversasChat());
      setEditando(null);
    } catch (e: any) {
      setErro(String(e?.message || e));
    }
  };

  const estiloBalao = (m: Mensagem) => {
    if (m.papel === "servidor") return "bg-[#032650] text-white ml-auto";
    switch (m.tipo) {
      case "alerta": return "bg-amber-50 border border-amber-200 text-amber-900";
      case "documento": return "bg-emerald-50 border border-emerald-200 text-emerald-900";
      case "card": return "bg-slate-50 border border-slate-200 text-slate-800";
      default: return "bg-white border border-slate-200 text-slate-800";
    }
  };

  const iconeBalao = (m: Mensagem) => {
    if (m.papel === "servidor") return <User size={13} className="text-[#C9A227]/70" />;
    if (m.tipo === "alerta") return <AlertTriangle size={13} className="text-amber-500" />;
    if (m.tipo === "documento") return <FileText size={13} className="text-emerald-600" />;
    if (m.tipo === "card") return <Sparkles size={13} className="text-[#C9A227]" />;
    return <Bot size={13} className="text-slate-400" />;
  };

  const coletaEtp = conversa?.statusDocumentos?.docColeta?.docChave === "etp" ? conversa.statusDocumentos.docColeta : null;
  const campoAtualEtp = coletaEtp?.campoAtual || coletaEtp?.ordem?.[0];
  const metaAtualEtp = campoAtualEtp ? CAMPOS_ETP.find(c => c.chave === campoAtualEtp) : null;
  const indiceGrupoEtp = metaAtualEtp ? GRUPOS_ETP.indexOf(metaAtualEtp.grupo) : -1;
  const preenchidosEtp = coletaEtp ? Object.entries(coletaEtp.campos || {}).filter(([k, v]) => !k.startsWith("_") && String(v || "").trim()).length : 0;

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br bg-[#032650] bg-[#C9A227] flex items-center justify-center shadow-sm">
            <Bot size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 leading-tight">LEX Licitações · Arquiteto da contratação</h1>
            <p className="text-[11px] text-slate-400">Entendo a necessidade antes de estruturar o processo</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarHistorico(!mostrarHistorico)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-3.5 py-2 rounded-xl hover:bg-slate-50 hover:border-slate-300 cursor-pointer transition-colors"
          >
            <History size={13} /> Conversas <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 text-[10px]">{historico.length}</span>
          </button>
          <button
            onClick={iniciarNova}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#032650] hover:bg-[#042f5e] px-3.5 py-2 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all"
          >
            <Plus size={13} /> Nova contratação
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
                {c.finalizada ? " finalizada" : c.etapaAtual}
              </span>
            </button>
          ))}
        </div>
      )}

      {erro && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erro}</div>
      )}

      {coletaEtp && (
        <div className="mb-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#032650]">ETP Digital</p>
              <p className="text-[11px] text-slate-500">{preenchidosEtp} elementos já aproveitados ou confirmados</p>
            </div>
            {metaAtualEtp && <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">Agora: {metaAtualEtp.grupo}</span>}
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
            {GRUPOS_ETP.map((grupo, i) => {
              const ativo = i === indiceGrupoEtp;
              const concluido = indiceGrupoEtp >= 0 && i < indiceGrupoEtp;
              return (
                <div key={grupo} className={`min-h-[42px] rounded-xl border px-2 py-2 flex items-center gap-1.5 ${ativo ? "border-[#C9A227] bg-[#C9A227]/10 text-[#032650]" : concluido ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                  <span className="w-5 h-5 rounded-full bg-white border border-current/20 inline-flex items-center justify-center text-[10px] font-bold shrink-0">{concluido ? "✓" : i + 1}</span>
                  <span className="text-[10px] font-semibold leading-tight truncate">{grupo}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat — estilo ChatGPT: sem card, altura total, fundo limpo */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto space-y-4 pb-4">
          {!conversa ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br bg-[#032650] bg-[#C9A227] flex items-center justify-center shadow-lg">
                <Bot size={28} className="text-white" />
              </div>
              <p className="text-lg font-semibold text-slate-800">O que você precisa comprar ou contratar hoje?</p>
              <p className="text-sm text-slate-500 max-w-md leading-relaxed">
                Comece pela necessidade, do seu jeito. O LEX identifica o tipo de objeto, faz perguntas específicas, consulta o histórico do órgão e transforma as respostas em um processo tecnicamente estruturado.
              </p>
              <p className="text-xs font-medium text-[#032650]/70 max-w-md">
                Você não precisa saber se começa por DFD, ETP ou TR. Primeiro eu descubro a contratação com você.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                <button onClick={iniciarNova} className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#032650] hover:bg-[#042f5e] px-5 py-3 rounded-xl shadow-sm hover:shadow-md cursor-pointer transition-all">
                  <Plus size={15} /> Iniciar contratação
                </button>
                <button onClick={() => setMostrarHistorico(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 px-4 py-3 rounded-xl cursor-pointer transition-colors">
                  <History size={15} /> Conversas anteriores
                </button>
                {/* AGENTE HISTORIADOR: padrões do órgão */}
                <button
                  onClick={carregarBriefing}
                  disabled={carregandoBriefing}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-4 py-3 rounded-xl cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Sparkles size={15} /> {carregandoBriefing ? "Analisando histórico…" : "Histórico do órgão"}
                </button>
              </div>

              {/* Painel do Historiador */}
              {briefingHist && (
                <div className="mt-6 w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-left">
                  <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-2">Histórico do órgão — referências para a nova contratação</p>
                  {briefingHist.briefing ? (
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{briefingHist.briefing}</div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Ainda sem histórico suficiente no órgão. Conforme você fizer contratações, o Historiador aprende seus padrões (objetos recorrentes, documentos que faltam, fontes preferidas) e antecipa o trabalho.
                    </p>
                  )}
                  {briefingHist.padroes?.totalProcessos > 0 && (
                    <div className="mt-3 pt-3 border-t border-amber-200 text-[11px] text-slate-500">
                      <p>{briefingHist.padroes.totalProcessos} processo(s) · {briefingHist.padroes.totalConversas} conversa(s) analisadas</p>
                      {briefingHist.padroes.documentosFaltantes?.length > 0 && (
                        <p className="mt-1">Sempre faltam: {briefingHist.padroes.documentosFaltantes.map((d: any) => `${d.doc} (${d.vezes}x)`).join(", ")}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (conversa.mensagens?.length || 0) === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <Bot size={36} className="text-[#C9A227]/70" />
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
                  <div className="text-sm whitespace-pre-wrap leading-relaxed"><Rich text={m.tipo === "documento" && m.completo ? m.completo : m.conteudo} /></div>
                  {/* Botões Baixar/Editar para documentos (minuta/edital/PC/ETP) */}
                  {m.tipo === "documento" && (m.conteudo.includes("Minuta") || m.conteudo.includes("EDITAL") || m.conteudo.includes("Contrato") || m.conteudo.includes("PEDIDO DE COMPRA") || m.conteudo.includes("DFD") || m.conteudo.includes("Requisição de Compra") || m.conteudo.includes("ESTUDO TÉCNICO")) && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <button
                        onClick={() => baixarDocumento(m)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 rounded-full cursor-pointer"
                      >
                         Baixar {m.conteudo.includes("EDITAL") ? "edital" : "documento"}
                      </button>
                      <button
                        onClick={() => abrirEditor(m)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white border border-emerald-300 hover:bg-emerald-50 px-3 py-1.5 rounded-full cursor-pointer"
                      >
                         Editar
                      </button>
                    </div>
                  )}
                  {m.opcoes && m.opcoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {m.opcoes.map((op) => (
                        <button
                          key={op}
                          onClick={() => {
                            // "Anexar arquivo" abre o seletor em vez de enviar texto
                            if (op.includes("Anexar arquivo")) {
                              document.getElementById("anexo-chat")?.click();
                            } else if (op === "Abrir pesquisa de preços") {
                              window.location.href = "/pesquisa/nova";
                            } else if (op === "Voltar aos procedimentos") {
                              window.location.href = "/procedimentos";
                            } else {
                              enviar(op);
                            }
                          }}
                          disabled={enviando}
                          className="text-[11px] font-semibold bg-white border border-slate-300 text-slate-700 hover:border-[#C9A227] hover:text-[#032650] px-2.5 py-1.5 rounded-full cursor-pointer disabled:opacity-50"
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
                <Loader2 size={13} className="animate-spin text-[#C9A227]" />
                <span className="text-xs text-slate-400">pensando…</span>
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Input — estilo ChatGPT: container arredondado com sombra */}
        <div className="pb-2">
          <div className="flex items-end gap-2 rounded-3xl border border-slate-300 bg-white px-3 py-2.5 shadow-sm focus-within:border-[#C9A227] transition-colors">
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
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer disabled:opacity-40 shrink-0 transition-colors"
            >
              <Paperclip size={18} />
            </button>
            <button
              onClick={gravando ? pararGravacao : iniciarGravacao}
              disabled={!conversa || enviando}
              title={gravando ? "Parar gravação" : "Falar"}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-xl cursor-pointer disabled:opacity-40 shrink-0 transition-colors ${gravando ? "bg-red-500 text-white animate-pulse" : "text-slate-400 hover:text-red-600 hover:bg-red-50"}`}
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
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl bg-[#032650] text-white hover:bg-[#042f5e] shadow-sm cursor-pointer disabled:opacity-40 shrink-0 transition-all"
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
        O assistente nunca trava: se faltar um documento, ele alerta e explica a implicação — mas segue conduzindo. 
      </p>

      {/* Editor do documento por seção */}
      {editando && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-50 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-white">
              <div>
                <p className="font-bold text-slate-900 text-base">Editar documento por seção</p>
                <p className="text-xs text-slate-500 mt-1">Acrescente contexto em cada item e peça para a IA melhorar somente aquele trecho. Dados factuais não são inventados.</p>
              </div>
              <button onClick={() => setEditando(null)} className="w-9 h-9 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0" aria-label="Fechar">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
              {editando.blocos.map((bloco, idx) => {
                const titulo = bloco.texto.split("\n")[0]?.trim() || `Seção ${idx + 1}`;
                return (
                  <section key={bloco.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-[#032650]">Seção {idx + 1}</span>
                        <p className="text-sm font-semibold text-slate-800 truncate mt-0.5">{titulo}</p>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <textarea
                        value={bloco.texto}
                        onChange={(e) => atualizarBloco(idx, { texto: e.target.value })}
                        className="w-full min-h-[180px] rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 focus:outline-none focus:border-[#C9A227] focus:ring-4 focus:ring-[#C9A227]/10 resize-y"
                      />
                      <div className="rounded-xl border border-[#d5dce8] bg-[#eef2f8]/55 p-3">
                        <label className="block text-xs font-bold text-[#032650] mb-1.5">Quer acrescentar alguma informação a esta seção?</label>
                        <textarea
                          value={bloco.complemento}
                          onChange={(e) => atualizarBloco(idx, { complemento: e.target.value })}
                          placeholder="Ex.: informe que o estoque atual atende somente mais 30 dias e que 4 unidades administrativas serão beneficiadas."
                          className="w-full min-h-[74px] rounded-lg border border-[#d5dce8] bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-[#C9A227] resize-y"
                        />
                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <p className="text-[11px] text-slate-500">A IA cruza seu complemento com a base de normas/procedimentos do LEX e referências disponíveis.</p>
                          <button
                            type="button"
                            onClick={() => melhorarBloco(idx)}
                            disabled={bloco.melhorando}
                            className="inline-flex items-center justify-center gap-2 min-h-[40px] px-4 py-2 rounded-xl bg-[#032650] text-white text-xs font-bold hover:bg-[#042f5e] disabled:opacity-50 cursor-pointer shrink-0"
                          >
                            {bloco.melhorando ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                            {bloco.melhorando ? "Melhorando…" : "Melhorar com IA"}
                          </button>
                        </div>
                        {!!bloco.fontes?.length && (
                          <div className="mt-2 pt-2 border-t border-[#d5dce8] text-[10px] text-slate-500">
                            <span className="font-semibold text-slate-600">Base consultada: </span>
                            {bloco.fontes.map(f => `${f.titulo} (${f.fonte})`).join(" · ")}
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <button
                onClick={() => baixarDocumento({ ...editando.m, conteudo: textoEditorCompleto(), completo: textoEditorCompleto() })}
                className="inline-flex items-center justify-center gap-2 min-h-[42px] text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl cursor-pointer hover:bg-emerald-100"
              >
                Baixar esta versão
              </button>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={() => setEditando(null)} className="min-h-[42px] text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl cursor-pointer">
                  Cancelar
                </button>
                <button onClick={salvarEdicao} className="min-h-[42px] text-xs font-bold text-white bg-[#032650] hover:bg-[#042f5e] px-5 py-2 rounded-xl cursor-pointer">
                  Salvar versão revisada
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
