"use client";

import { useState } from "react";
import { MessageCircle, X, Send, CheckCircle2, Loader2 } from "lucide-react";
import { enviarFeedback } from "@/app/lib/admin-actions";
import { usePathname } from "next/navigation";

export default function FeedbackButton() {
  const [aberto, setAberto] = useState(false);
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
      {/* Modal */}
      {aberto && (
        <div className="fixed bottom-20 right-6 z-50 w-80 rounded-xl bg-white border border-slate-200 shadow-xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-800">Sugestão ou melhoria</span>
            </div>
            <button onClick={() => setAberto(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">
            {enviado ? (
              <div className="flex flex-col items-center gap-2 py-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <p className="text-sm font-medium text-slate-800">Obrigado pelo feedback!</p>
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
                  placeholder="Ex: Seria útil poder filtrar por data na listagem de pesquisas..."
                  rows={4}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                />
                {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
                <button
                  onClick={enviar}
                  disabled={enviando || !mensagem.trim()}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {enviando ? "Enviando..." : "Enviar sugestão"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setAberto(!aberto)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors flex items-center justify-center"
        title="Enviar sugestão"
      >
        {aberto ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </button>
    </>
  );
}
