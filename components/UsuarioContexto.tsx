"use client";

import React, { createContext, useContext } from "react";

export type UsuarioLex = {
  nome: string;
  email?: string;
  perfil: string;
  orgaoNome?: string;
  cargo?: string;
};

const Ctx = createContext<UsuarioLex | null>(null);

/** Dados do usuário logado para telas cliente (saudação, perfil) sem nova consulta. */
export function UsuarioProvider({ usuario, children }: { usuario: UsuarioLex; children: React.ReactNode }) {
  return <Ctx.Provider value={usuario}>{children}</Ctx.Provider>;
}

export function useUsuario() {
  return useContext(Ctx);
}

/** Pede para abrir a busca global ou o assistente de qualquer lugar (ex.: topo do celular). */
export function abrirBusca() {
  window.dispatchEvent(new Event("lex:abrir-busca"));
}
export function alternarAssistente() {
  window.dispatchEvent(new Event("lex:alternar-assistente"));
}
