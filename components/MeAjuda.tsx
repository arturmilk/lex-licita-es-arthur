"use client";
import React, { useState } from "react";
import { LifeBuoy, X, Loader2, Send, Sparkles } from "lucide-react";
import { meAjudaIA } from "@/lib/actions-intencao";

interface Props {
  /** Descrição do contexto onde o botão está (página, processo, etapa). */
  contexto: string;
  /** Dados adicionais (processo aberto, etapa atual, etc.). */
  dados?: string;
}

/**
 * Assistente contextual "Me ajuda" — presente em todas as telas.
 * A IA entende onde o servidor está (página, processo, etapa) e responde
 * com orientação prática do que fazer agora.
 */
export default function MeAjuda({ contexto, dados }: Props) {
  const [aberto, setAberto] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function perguntar() {
    if (pergunta.trim().length < 3 || carregando) return;
    setCarregando(true);
    setResposta("");
    try {
      const r = await meAjudaIA({ pergunta, contextoPagina: contexto, dadosAdicionais: dados });
      setResposta(r);
    } catch (e: any) {
      setResposta(`Erro: ${e?.message || "IA indisponível"}`);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setAberto(!aberto)}
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[#032650] text-white px-4 py-3 shadow-lg hover:bg-[#032650] transition-colors cursor-pointer"
        title="Me ajuda"
      >
        {aberto ? <X size={18} /> : <LifeBuoy size={18} />}
        <span className="text-sm font-semibold">Me ajuda</span>
      </button>

      {/* Painel */}
      {aberto && (
        <div className="fixed bottom-20 right-5 z-50 w-[380px] max-w-[90vw] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden">
          <div className="bg-[#032650] px-4 py-3 flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-200" />
            <div>
              <p className="text-white font-semibold text-sm">Assistente contextual</p>
              <p className="text-indigo-200 text-[11px]">Entendi onde você está: {contexto.slice(0, 60)}</p>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && perguntar()}
              placeholder="Ex.: o que devo fazer nesta etapa? Qual o próximo passo?"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-400 text-sm min-h-[70px]"
            />
            <button
              onClick={perguntar}
              disabled={carregando || pergunta.trim().length < 3}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#032650] text-white text-sm font-semibold hover:bg-[#032650] disabled:opacity-50 cursor-pointer"
            >
              {carregando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Perguntar
            </button>

            {resposta && (
              <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700 whitespace-pre-wrap max-h-[260px] overflow-y-auto">
                {resposta}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
