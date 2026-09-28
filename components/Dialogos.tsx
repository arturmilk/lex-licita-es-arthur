"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

type OpcoesConfirmar = {
  titulo?: string;
  mensagem: string;
  confirmar?: string;
  cancelar?: string;
  perigoso?: boolean;
};

type Estado =
  | (OpcoesConfirmar & { tipo: "confirmar"; resolver: (v: boolean) => void })
  | ({ mensagem: string; titulo?: string; tipo: "aviso"; resolver: (v: boolean) => void })
  | null;

type Api = {
  confirmar: (o: OpcoesConfirmar | string) => Promise<boolean>;
  avisar: (mensagem: string, titulo?: string) => Promise<void>;
};

const Ctx = createContext<Api>(null as unknown as Api);

/** Diálogos do sistema (confirmar/avisar) — no lugar do confirm()/alert() nativo do navegador. */
export function useDialogos() {
  return useContext(Ctx);
}

export function DialogosProvider({ children }: { children: React.ReactNode }) {
  const [estado, setEstado] = useState<Estado>(null);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  const confirmar = useCallback((o: OpcoesConfirmar | string) => {
    const opcoes = typeof o === "string" ? { mensagem: o } : o;
    return new Promise<boolean>((resolve) => setEstado({ ...opcoes, tipo: "confirmar", resolver: resolve }));
  }, []);

  const avisar = useCallback((mensagem: string, titulo?: string) => {
    return new Promise<void>((resolve) => setEstado({ mensagem, titulo, tipo: "aviso", resolver: () => resolve() }));
  }, []);

  const fechar = (valor: boolean) => {
    setEstado((atual) => {
      atual?.resolver(valor);
      return null;
    });
  };

  // Foco inicial: em ação perigosa, no "Cancelar" (Enter por reflexo não apaga nada);
  // nas demais, no botão principal. Enter aciona o botão focado (comportamento nativo).
  useEffect(() => {
    if (!estado) return;
    const perigosa = estado.tipo === "confirmar" && estado.perigoso;
    (perigosa ? cancelarRef.current : botaoRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [estado]);

  const perigoso = estado?.tipo === "confirmar" && estado.perigoso;
  const titulo = estado ? (estado.titulo || (estado.tipo === "aviso" ? "Aviso" : "Confirmar")) : "";

  return (
    <Ctx.Provider value={{ confirmar, avisar }}>
      {children}
      {estado && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dlg-titulo" aria-describedby="dlg-msg">
          <div className="absolute inset-0 bg-ink-950/50 backdrop-blur-[2px]" onClick={() => fechar(false)} aria-hidden />
          <div className="relative w-full max-w-md animate-entrar rounded-2xl border border-slate-200 bg-white p-6 shadow-pop">
            <div className="flex items-start gap-3.5">
              {perigoso && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 ring-1 ring-red-100" aria-hidden>
                  <AlertTriangle size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 id="dlg-titulo" className="text-[17px] font-semibold text-ink-950">{titulo}</h2>
                <p id="dlg-msg" className="mt-1.5 text-sm leading-relaxed text-slate-600">{estado.mensagem}</p>
              </div>
              <button
                onClick={() => fechar(false)}
                aria-label="Fechar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {estado.tipo === "confirmar" && (
                <button ref={cancelarRef} onClick={() => fechar(false)} className="btn btn-outline">
                  {estado.cancelar || "Cancelar"}
                </button>
              )}
              <button
                ref={botaoRef}
                onClick={() => fechar(true)}
                className={`btn ${perigoso ? "bg-red-600 text-white hover:bg-red-700" : "btn-primary"}`}
              >
                {estado.tipo === "aviso" ? "Entendi" : estado.confirmar || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
