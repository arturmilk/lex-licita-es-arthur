"use client";
import React, { useEffect, useRef, useState } from "react";
import { Send, Mic, Paperclip, Loader2, Bot, User, AlertTriangle, CheckCircle2, FileText, Sparkles, Plus, History, Wand2, X, Download, Pencil, LifeBuoy } from "lucide-react";
import { usePathname } from "next/navigation";
import { novaConversaChat, enviarMensagemChat, listarConversasChat, criarProcessoDaConversa, carregarConversaChat, melhorarTrechoDocumento, salvarDocumentoEditado, assimilarDocumentoChat } from "@/lib/actions-chat";
import { meAjudaIA } from "@/lib/actions-intencao";
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

/** Rótulo amigável da tela atual — o assistente usa isto para se situar (o antigo "Me ajuda" contextual). */
const ROTULO_PAGINA: Record<string, string> = {
  "/painel": "Meu dia",
  "/pesquisa/nova": "Precificação",
  "/pesquisas": "Pesquisas",
  "/historicos": "Histórico",
  "/busca": "Busca",
  "/jurisprudencia": "Jurisprudência",
  "/relatorios": "Relatórios",
  "/evidencias": "Evidências",
  "/procedimentos": "Procedimentos",
  "/processos": "Processos",
  "/gestor": "Painel do gestor",
  "/dashboard": "Indicadores",
  "/admin": "Administração",
  "/assistente": "Assistente",
};

function rotuloDaPagina(pathname: string) {
  if (ROTULO_PAGINA[pathname]) return ROTULO_PAGINA[pathname];
  const chave = Object.keys(ROTULO_PAGINA)
    .filter((k) => pathname.startsWith(k + "/"))
    .sort((a, b) => b.length - a.length)[0];
  return chave ? ROTULO_PAGINA[chave] : "LEX Licitações";
}

interface AssistenteChatProps {
  /** "pagina" = tela cheia em /assistente; "painel" = janela flutuante do canto. */
  variante?: "pagina" | "painel";
  /** Callback de fechar (usado só na variante "painel"). */
  onFechar?: () => void;
}

export default function AssistenteChat({ variante = "pagina", onFechar }: AssistenteChatProps) {
  const compacto = variante === "painel";
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

  // ── Ajuda contextual (absorveu o antigo botão flutuante "Me ajuda") ──
  const pathname = usePathname();
  const contextoPagina = rotuloDaPagina(pathname || "");
  const [ajudaAberto, setAjudaAberto] = useState(false);
  const [ajudaPergunta, setAjudaPergunta] = useState("");
  const [ajudaResposta, setAjudaResposta] = useState("");
  const [ajudaCarregando, setAjudaCarregando] = useState(false);

  const perguntarAjuda = async () => {
    if (ajudaPergunta.trim().length < 3 || ajudaCarregando) return;
    setAjudaCarregando(true);
    setAjudaResposta("");
    try {
      const r = await meAjudaIA({ pergunta: ajudaPergunta.trim(), contextoPagina });
      setAjudaResposta(r || "Não consegui responder agora. Tente de novo.");
    } catch (e: any) {
      setAjudaResposta(`Não foi possível responder agora (${e?.message || "IA indisponível"}).`);
    } finally {
      setAjudaCarregando(false);
    }
  };

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
      if (!resp.ok) throw new Error(data?.erro || "Não consegui ler o documento.");
      const resumo = data.resumo;
      const assimilado = await assimilarDocumentoChat(conversa.id, {
        nome: file.name,
        texto: data.texto || "",
        resumo: data.resumo,
        dados: data.dados,
      });
      const textoIdentificado = resumo?.aconteceu || `Anexei o documento ${file.name}`;
      // Depois de assimilar o conteúdo completo, o anexo responde à pergunta
      // atual do fluxo e o motor segue usando a memória documental persistida.
      const r = await enviarMensagemChat(conversa.id, `Anexei o documento ${file.name}. ${textoIdentificado.slice(0, 350)}`);
      const alertas = assimilado.memoria?.alertas || [];
      setConversa(prev => prev ? {
        ...prev,
        mensagens: [...(prev.mensagens || []), {
          id: "doc-" + Date.now(), papel: "sistema", tipo: "documento",
          conteudo: `**${file.name}** lido e assimilado.\n\n${assimilado.mensagem}${alertas.length ? `\n\n**Pontos para conferir:**\n${alertas.map((a: string) => `- ${a}`).join("\n")}` : ""}`,
          criadaEm: new Date().toISOString(),
        }, ...r.mensagens],
        etapaAtual: r.estado.etapa,
        statusDocumentos: r.estado,
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
    if (m.papel === "servidor") return "bg-ink-900 text-white ml-auto";
    switch (m.tipo) {
      case "alerta": return "bg-amber-50 border border-amber-200 text-amber-900";
      case "documento": return "bg-ink-50/70 border border-ink-100 text-slate-800";
      case "card": return "bg-slate-50 border border-slate-200 text-slate-800";
      default: return "bg-white border border-slate-200 text-slate-800";
    }
  };

  const iconeBalao = (m: Mensagem) => {
    if (m.papel === "servidor") return <User size={13} className="text-gold-400" />;
    if (m.tipo === "alerta") return <AlertTriangle size={13} className="text-amber-500" />;
    if (m.tipo === "documento") return <FileText size={13} className="text-ink-700" />;
    if (m.tipo === "card") return <Sparkles size={13} className="text-gold-600" />;
    return <Bot size={13} className="text-slate-400" />;
  };

  const coletaEtp = conversa?.statusDocumentos?.docColeta?.docChave === "etp" ? conversa.statusDocumentos.docColeta : null;
  const campoAtualEtp = coletaEtp?.campoAtual || coletaEtp?.ordem?.[0];
  const metaAtualEtp = campoAtualEtp ? CAMPOS_ETP.find(c => c.chave === campoAtualEtp) : null;
  const indiceGrupoEtp = metaAtualEtp ? GRUPOS_ETP.indexOf(metaAtualEtp.grupo) : -1;
  const preenchidosEtp = coletaEtp ? Object.entries(coletaEtp.campos || {}).filter(([k, v]) => !k.startsWith("_") && String(v || "").trim()).length : 0;

  return (
    <div className={compacto ? "flex h-full min-h-0 flex-col" : "mx-auto flex h-[calc(100vh-5.5rem)] max-w-3xl flex-col supports-[height:100dvh]:h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-8rem)] md:supports-[height:100dvh]:h-[calc(100dvh-8rem)]"}>
      {/* Cabeçalho */}
      <div className={`flex items-center justify-between gap-3 ${compacto ? "mb-3" : "mb-4 border-b border-slate-200 pb-4"}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={`flex shrink-0 items-center justify-center rounded-xl bg-ink-900 shadow-sm ${compacto ? "h-9 w-9" : "h-11 w-11"}`}>
            <Bot size={compacto ? 18 : 21} className="text-gold-400" aria-hidden />
          </div>
          <div className="min-w-0">
            {compacto ? (
              <>
                <p className="truncate text-sm font-semibold leading-tight text-ink-950">Assistente do LEX</p>
                <p className="truncate text-xs text-slate-600">Estruturo a contratação com você</p>
              </>
            ) : (
              <>
                <h1 className="truncate text-xl font-semibold leading-tight tracking-[-0.015em] text-ink-950">Assistente</h1>
                <p className="truncate text-[13px] text-slate-600">Arquiteto da contratação</p>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            onClick={() => setMostrarHistorico(!mostrarHistorico)}
            title="Conversas anteriores"
            aria-label="Conversas anteriores"
            aria-expanded={mostrarHistorico}
            className={`btn btn-outline btn-sm min-h-[44px] ${compacto ? "w-11 px-0" : ""}`}
          >
            <History size={15} aria-hidden />
            {!compacto && (
              <>
                <span className="hidden sm:inline">Conversas</span>
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">{historico.length}</span>
              </>
            )}
          </button>
          <button
            onClick={iniciarNova}
            title="Nova contratação"
            aria-label="Nova contratação"
            className={`btn btn-primary btn-sm min-h-[44px] ${compacto ? "w-11 px-0" : ""}`}
          >
            <Plus size={15} aria-hidden />
            {!compacto && <span className="hidden sm:inline">Nova contratação</span>}
          </button>
          <button
            onClick={() => setAjudaAberto((v) => !v)}
            title="Me ajuda nesta tela"
            aria-label="Me ajuda nesta tela"
            aria-expanded={ajudaAberto}
            className={`btn btn-sm min-h-[44px] ${compacto ? "w-11 px-0" : ""} ${
              ajudaAberto ? "bg-ink-900 text-white hover:bg-ink-800" : "btn-outline"
            }`}
          >
            <LifeBuoy size={15} aria-hidden />
            {!compacto && <span className="hidden sm:inline">Me ajuda</span>}
          </button>
          {onFechar && (
            <button
              onClick={onFechar}
              title="Fechar assistente"
              aria-label="Fechar assistente"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* Ajuda contextual — antes era um botão flutuante separado; agora vive dentro do assistente */}
      {ajudaAberto && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <LifeBuoy size={14} className="shrink-0 text-ink-700" aria-hidden />
            <p className="text-xs font-semibold text-slate-700">
              Ajuda nesta tela <span className="font-normal text-slate-500">· {contextoPagina}</span>
            </p>
          </div>
          <label htmlFor="ajuda-pergunta" className="sr-only">Sua dúvida sobre esta tela</label>
          <textarea
            id="ajuda-pergunta"
            value={ajudaPergunta}
            onChange={(e) => setAjudaPergunta(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); perguntarAjuda(); } }}
            placeholder="Ex.: o que devo fazer nesta etapa? Qual o próximo passo?"
            className="inp min-h-[64px] text-sm"
          />
          <button
            onClick={perguntarAjuda}
            disabled={ajudaCarregando || ajudaPergunta.trim().length < 3}
            className="btn btn-primary btn-sm mt-2 w-full"
          >
            {ajudaCarregando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Perguntar
          </button>
          {ajudaResposta && (
            <div role="status" className="mt-2 max-h-[220px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
              {ajudaResposta}
            </div>
          )}
        </div>
      )}

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
              <span className="text-xs text-slate-400 shrink-0">
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
                <div key={grupo} className={`min-h-[42px] rounded-xl border px-2 py-2 flex items-center gap-1.5 ${ativo ? "border-[#C9A227] bg-[#C9A227]/10 text-[#032650]" : concluido ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                  <span className="w-5 h-5 rounded-full bg-white border border-current/20 inline-flex items-center justify-center text-xs font-bold shrink-0">{concluido ? "✓" : i + 1}</span>
                  <span className="text-xs font-semibold leading-tight truncate">{grupo}</span>
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
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-900 shadow-raise" aria-hidden>
                <Bot size={28} className="text-gold-400" />
              </div>
              <p className="text-xl font-semibold tracking-[-0.015em] text-ink-950 [text-wrap:balance]">O que você precisa comprar ou contratar hoje?</p>
              <p className="max-w-md text-[15px] leading-relaxed text-slate-600">
                Comece pela necessidade, do seu jeito. O LEX identifica o tipo de objeto, faz perguntas específicas, consulta o histórico do órgão e transforma as respostas em um processo tecnicamente estruturado.
              </p>
              <p className="max-w-md text-[13px] font-medium text-ink-700">
                Você não precisa saber se começa por DFD, ETP ou TR. Primeiro eu descubro a contratação com você.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                <button onClick={iniciarNova} className="btn btn-primary">
                  <Plus size={16} aria-hidden /> Iniciar contratação
                </button>
                <button onClick={() => setMostrarHistorico(true)} className="btn btn-outline">
                  <History size={16} aria-hidden /> Conversas anteriores
                </button>
                {/* AGENTE HISTORIADOR: padrões do órgão */}
                <button onClick={carregarBriefing} disabled={carregandoBriefing} className="btn btn-outline">
                  <Sparkles size={16} className="text-gold-600" aria-hidden /> {carregandoBriefing ? "Analisando histórico…" : "Histórico do órgão"}
                </button>
              </div>

              {/* Painel do Historiador */}
              {briefingHist && (
                <div className="mt-6 w-full max-w-md rounded-xl border border-ink-100 bg-ink-50/60 p-5 text-left">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-ink-700">Histórico do órgão · referências para a nova contratação</p>
                  {briefingHist.briefing ? (
                    <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{briefingHist.briefing}</div>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Ainda sem histórico suficiente no órgão. Conforme você fizer contratações, o Historiador aprende seus padrões (objetos recorrentes, documentos que faltam, fontes preferidas) e antecipa o trabalho.
                    </p>
                  )}
                  {briefingHist.padroes?.totalProcessos > 0 && (
                    <div className="mt-3 border-t border-ink-100 pt-3 text-xs text-slate-600">
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
              <Loader2 size={24} className="animate-spin text-ink-700" aria-hidden />
              <p className="text-sm text-slate-500">Carregando a conversa…</p>
            </div>
          ) : (
            <ChatErrorBoundary>
              {conversa.mensagens?.map((m) => (
                <div key={m.id} className={`flex ${m.papel === "servidor" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${estiloBalao(m)}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    {iconeBalao(m)}
                    <span className="text-[11px] font-bold uppercase tracking-wide opacity-60">
                      {m.papel === "servidor" ? "Você" : m.tipo === "alerta" ? "Alerta" : m.tipo === "documento" ? "Documento" : "Assistente"}
                    </span>
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed"><Rich text={m.tipo === "documento" && m.completo ? m.completo : m.conteudo} /></div>
                  {/* Botões Baixar/Editar para documentos (minuta/edital/PC/ETP) */}
                  {m.tipo === "documento" && (m.conteudo.includes("Minuta") || m.conteudo.includes("EDITAL") || m.conteudo.includes("Contrato") || m.conteudo.includes("PEDIDO DE COMPRA") || m.conteudo.includes("DFD") || m.conteudo.includes("Requisição de Compra") || m.conteudo.includes("ESTUDO TÉCNICO")) && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <button
                        onClick={() => baixarDocumento(m)}
                        className="btn btn-primary btn-sm"
                      >
                        <Download size={12} aria-hidden /> Baixar {m.conteudo.includes("EDITAL") ? "edital" : "documento"}
                      </button>
                      <button
                        onClick={() => abrirEditor(m)}
                        className="btn btn-outline btn-sm"
                      >
                        <Pencil size={12} aria-hidden /> Editar
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
                          className="chip font-medium disabled:opacity-50"
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
                <Loader2 size={14} className="animate-spin text-ink-700" aria-hidden />
                <span className="text-[13px] text-slate-500">Pensando…</span>
              </div>
            </div>
          )}
          <div ref={fimRef} />
        </div>

        {/* Input — estilo ChatGPT: container arredondado com sombra */}
        <div className="pb-2">
          <div className="flex items-end gap-1.5 rounded-2xl border border-slate-300 bg-white px-2.5 py-2 shadow-card transition-[border-color,box-shadow] focus-within:border-ink-700 focus-within:ring-4 focus-within:ring-ink-700/10">
            <input
              type="file"
              accept=".pdf,.txt,.md,.docx,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"
              onChange={anexarDocumento}
              className="hidden"
              id="anexo-chat"
            />
            <button
              onClick={() => document.getElementById("anexo-chat")?.click()}
              disabled={!conversa || enviando}
              title="Anexar documento (responde à pergunta atual)"
              aria-label="Anexar documento"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-ink-50 hover:text-ink-800 disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>
            <button
              onClick={gravando ? pararGravacao : iniciarGravacao}
              disabled={!conversa || enviando}
              title={gravando ? "Parar gravação" : "Falar"}
              aria-label={gravando ? "Parar gravação" : "Falar em vez de digitar"}
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-40 ${gravando ? "animate-pulse bg-red-600 text-white" : "text-slate-500 hover:bg-ink-50 hover:text-ink-800"}`}
            >
              <Mic size={18} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") enviar(input); }}
              placeholder={conversa ? "Digite sua resposta…" : "Clique em Nova contratação para começar"}
              disabled={!conversa || enviando}
              aria-label="Mensagem para o assistente"
              className="min-h-[44px] flex-1 bg-transparent px-1 text-sm focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={() => enviar(input)}
              disabled={!conversa || !input.trim() || enviando}
              aria-label="Enviar mensagem"
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm transition-colors hover:bg-ink-800 disabled:opacity-40"
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

      <p className="mt-1 text-center text-xs text-slate-500">
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
                        <span className="text-xs uppercase tracking-widest font-bold text-[#032650]">Seção {idx + 1}</span>
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
                          <div className="mt-2 pt-2 border-t border-[#d5dce8] text-xs text-slate-500">
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
                className="inline-flex items-center justify-center gap-2 min-h-[42px] text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-4 py-2 rounded-xl cursor-pointer hover:bg-green-100"
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
