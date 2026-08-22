"use client";

import { useState } from "react";
import { MessageCircle, X, Send, CheckCircle2, Loader2 } from "lucide-react";
import { enviarFeedback } from "@/lib/admin-actions";
import { usePathname } from "next/navigation";

export default function FeedbackButton() {
  const [aberto, setAberto] = useState(false);
  const [tooltip, setTooltip] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pathname = usePathname();

  const enviar = async () => {
    if (!mensagem.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      await enviarFeedback(mensagem.trim(), pathname);
      setEnviado(true);
      setMensagem("");
      setTimeout(() => { setEnviado(false); setAberto(false); }, 2500);
    } catch (e: any) {
      setErro(String(e?.message || "Erro ao enviar"));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {/* Painel de sugestão */}
      {aberto && (
        <div className="fixed bottom-40 right-6 z-50 w-80 rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-amber-500 text-white">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              <span className="text-sm font-bold">Envie sua sugestão</span>
            </div>
            <button onClick={() => setAberto(false)} className="hover:opacity-70 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {enviado ? (
              <div className="flex flex-col items-center gap-2 py-5 text-center">
                <CheckCircle2 className="w-9 h-9 text-green-500" />
                <p className="text-sm font-semibold text-slate-800">Obrigado pelo feedback!</p>
                <p className="text-xs text-slate-500">Sua sugestão foi registrada.</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Encontrou algo que pode melhorar? Descreva abaixo e nossa equipe vai analisar.
                </p>
                <textarea
                  value={mensagem}
                  onChange={e => setMensagem(e.target.value)}
                  placeholder="Ex: Seria útil poder filtrar por data na listagem..."
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm bg-slate-50 border-2 border-slate-200 rounded-xl
                             focus:outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100
                             hover:border-slate-300 transition-colors resize-none placeholder:text-slate-400"
                />
                {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
                <button
                  onClick={enviar}
                  disabled={enviando || !mensagem.trim()}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                             bg-amber-500 text-white text-sm font-bold hover:bg-amber-600
                             disabled:opacity-40 transition-colors shadow-sm"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {enviando ? "Enviando..." : "Enviar sugestão"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Botão flutuante — âmbar para não confundir com ações primárias */}
      <div className="fixed bottom-28 right-6 z-50 flex flex-col items-end gap-1.5">
        {/* Tooltip */}
        {tooltip && !aberto && (
          <div className="bg-slate-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-150">
            Envie sua sugestão
            <span className="absolute -bottom-1.5 right-5 w-3 h-3 bg-slate-800 rotate-45" />
          </div>
        )}
        <button
          onClick={() => { setAberto(!aberto); setTooltip(false); }}
          onMouseEnter={() => setTooltip(true)}
          onMouseLeave={() => setTooltip(false)}
          aria-label="Envie sua sugestão"
          className={`w-13 h-13 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95
            ${aberto
              ? "bg-slate-700 text-white"
              : "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-300/60"
            }`}
          style={{ width: 52, height: 52 }}
        >
          {aberto ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        </button>
      </div>
    </>
  );
}
