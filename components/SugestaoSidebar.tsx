"use client";

import React, { useId, useState } from "react";
import { usePathname } from "next/navigation";
import { Send, Check, Loader2 } from "lucide-react";
import { enviarFeedback } from "@/lib/admin-actions";

/**
 * Campo discreto de sugestão, no fim da barra lateral.
 * Absorveu o antigo botão flutuante "Envie sua sugestão" — menos coisas soltas
 * na tela e o mesmo recurso continua existindo, num lugar previsível.
 */
export default function SugestaoSidebar() {
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const pathname = usePathname();
  // A barra lateral existe duas vezes no DOM (desktop + gaveta do celular): id único por instância
  const campoId = useId();

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mensagem.trim() || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await enviarFeedback(mensagem.trim(), pathname);
      setMensagem("");
      setEnviado(true);
      setTimeout(() => setEnviado(false), 2500);
    } catch {
      setErro("Não foi possível enviar agora. Tente de novo em instantes.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <label htmlFor={campoId} className="sugestao-rotulo mb-1.5 block px-1 text-xs font-medium text-white/55">
        Envie uma sugestão
      </label>
      <div className="flex items-stretch gap-1 rounded-lg border border-white/10 bg-white/[0.04] pl-3 transition-colors focus-within:border-gold-500/60 focus-within:bg-white/[0.07] hover:border-white/20">
        <input
          id={campoId}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="O que pode melhorar?"
          disabled={enviando}
          className="min-h-[44px] min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder:text-white/40 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          aria-label="Enviar sugestão"
          title="Enviar sugestão"
          disabled={enviando || !mensagem.trim()}
          className="flex w-11 shrink-0 items-center justify-center rounded-r-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent"
        >
          {enviando ? <Loader2 size={15} className="animate-spin" /> : enviado ? <Check size={15} className="text-emerald-400" /> : <Send size={15} />}
        </button>
      </div>
      {(erro || enviado) && (
        <p role="status" className={`mt-1.5 px-1 text-xs ${erro ? "text-red-300" : "text-emerald-300"}`}>
          {erro || "Obrigado! Sugestão registrada."}
        </p>
      )}
    </form>
  );
}
