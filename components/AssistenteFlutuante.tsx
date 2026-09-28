"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import AssistenteChat from "@/components/AssistenteChat";

/**
 * Janela do assistente — presente em todas as telas.
 *
 * Conceito: o assistente é o "servidor na mesa ao lado" — fica à mão, no canto
 * que a mão já alcança (Fitts), e abre no lugar em vez de expulsar o usuário da
 * tarefa. No computador, é o botão do canto inferior direito; no celular, é o
 * ícone do topo (nada flutuando por cima dos botões da tela) e abre em tela cheia.
 */
export default function AssistenteFlutuante() {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();

  // Esc fecha (padrão de janelas); o ícone do topo (celular) alterna
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    const onAlternar = () => setAberto((v) => !v);
    window.addEventListener("keydown", onKey);
    window.addEventListener("lex:alternar-assistente", onAlternar);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lex:alternar-assistente", onAlternar);
    };
  }, []);

  // Trocar de página fecha a janela
  useEffect(() => {
    setAberto(false);
  }, [pathname]);

  // Na própria tela do assistente o atalho seria redundante
  if (pathname === "/assistente") return null;

  // Telas com barra de ações fixa no rodapé (wizard): o botão sobe para não cobri-la
  const temRodape = pathname.startsWith("/pesquisa/nova");

  return (
    <>
      {aberto && (
        <section
          id="assistente-flutuante"
          aria-label="Assistente do LEX"
          className={`fixed inset-x-0 bottom-0 top-14 z-[60] flex animate-entrar flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-pop md:inset-x-auto md:top-auto md:right-6 md:h-[min(78vh,660px)] md:w-[420px] md:rounded-2xl ${
            temRodape ? "md:bottom-[9.25rem]" : "md:bottom-[5.75rem]"
          }`}
        >
          <div className="min-h-0 flex-1 p-4">
            <AssistenteChat variante="painel" onFechar={() => setAberto(false)} />
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-controls="assistente-flutuante"
        className={`fixed right-6 z-[60] hidden min-h-[52px] items-center gap-2.5 rounded-full py-2 pl-4 pr-5 text-white shadow-raise ring-1 ring-white/10 transition-colors md:inline-flex ${
          temRodape ? "bottom-[5.75rem]" : "bottom-6"
        } ${aberto ? "bg-ink-700 hover:bg-ink-800" : "bg-ink-900 hover:bg-ink-800"}`}
      >
        {aberto ? (
          <X size={18} aria-hidden />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10" aria-hidden>
            <Bot size={17} className="text-gold-400" />
          </span>
        )}
        <span className="text-sm font-semibold">{aberto ? "Fechar" : "Assistente"}</span>
      </button>
    </>
  );
}
