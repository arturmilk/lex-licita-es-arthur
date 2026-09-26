"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Plus, History, MessageCircle, Search, Scale, BarChart3, Paperclip,
  BookOpen, Users, LayoutDashboard, Settings, LogOut, Menu, X,
} from "lucide-react";
import { sair } from "@/lib/auth-actions";

type Item = { href: string; icon: React.ElementType; label: string; roles?: string[] };
type Grupo = { nome: string; roles?: string[]; itens: Item[] };

/**
 * Navegação por intenção (não por módulo técnico).
 *  - "Meu trabalho": o que a pessoa faz no dia a dia.
 *  - "Consultas": apoio (IA, busca, normas).
 *  - "Gestão"/"Administração": só para quem tem o perfil, separado visualmente.
 * Linguagem do servidor, não do programador (heurística #2: falar a língua do usuário).
 */
const GRUPOS: Grupo[] = [
  {
    nome: "Meu trabalho",
    itens: [
      { href: "/painel", icon: Home, label: "Meu dia" },
      { href: "/pesquisa/nova", icon: Plus, label: "Nova pesquisa" },
      { href: "/historicos", icon: History, label: "Histórico" },
    ],
  },
  {
    nome: "Assistente e consultas",
    itens: [
      { href: "/assistente", icon: MessageCircle, label: "Assistente" },
      { href: "/busca", icon: Search, label: "Busca" },
      { href: "/jurisprudencia", icon: Scale, label: "Jurisprudência" },
      { href: "/relatorios", icon: BarChart3, label: "Relatórios" },
      { href: "/evidencias", icon: Paperclip, label: "Evidências" },
      { href: "/procedimentos", icon: BookOpen, label: "Procedimentos" },
    ],
  },
  {
    nome: "Gestão",
    roles: ["gestor", "administrador"],
    itens: [
      { href: "/gestor", icon: Users, label: "Painel do gestor" },
      { href: "/dashboard", icon: LayoutDashboard, label: "Indicadores" },
    ],
  },
  {
    nome: "Administração",
    roles: ["administrador"],
    itens: [{ href: "/admin", icon: Settings, label: "Administração" }],
  },
];

const PERFIL: Record<string, string> = {
  administrador: "Administrador",
  gestor: "Gestor",
  pesquisador: "Pesquisador",
};

function iniciais(nome: string) {
  return (nome || "U").trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export default function Sidebar({ user }: { user: any }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  const perfil: string = user.perfil || "pesquisador";

  // Item ativo: match exato tem prioridade; senão o prefixo mais longo vence
  // (evita /pesquisa destacar /pesquisas e vice-versa).
  const isAtivo = (href: string) => {
    if (pathname === href) return true;
    if (href === "/painel") return false;
    return (pathname + "/").startsWith(href + "/");
  };

  const conteudo = (
    <>
      {/* Marca + órgão */}
      <div className="border-b border-white/10 p-5">
        <Link href="/painel" onClick={() => setAberto(false)} className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
            <img src="/logo-lex.png" alt="" className="h-7 w-7 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block text-base font-bold leading-none tracking-tight text-white">LEX Licitações</span>
            <span className="mt-1 block truncate text-[11px] text-white/60">{user.orgaoNome || "Órgão"}</span>
          </span>
        </Link>
        <button
          className="absolute right-4 top-6 flex h-10 w-10 items-center justify-center text-white/70 hover:text-white md:hidden"
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Navegação principal">
        {GRUPOS.map((grupo) => {
          if (grupo.roles && !grupo.roles.includes(perfil)) return null;
          const itens = grupo.itens.filter((i) => !i.roles || i.roles.includes(perfil));
          const adm = grupo.nome === "Administração";
          return (
            <div key={grupo.nome} className={adm ? "mt-4 border-t border-white/10 pt-3" : "mb-1"}>
              <p className={`px-3 pb-1.5 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${adm ? "text-gold" : "text-white/50"}`}>
                {grupo.nome}
              </p>
              <div className="space-y-0.5">
                {itens.map(({ href, icon: Icon, label }) => {
                  const ativo = isAtivo(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setAberto(false)}
                      aria-current={ativo ? "page" : undefined}
                      className={`relative flex items-center gap-3 rounded-lg py-2.5 pl-3.5 pr-3 text-sm transition-colors ${
                        ativo
                          ? "bg-white/10 font-semibold text-white"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {ativo && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-gold" aria-hidden />}
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${ativo ? "text-gold" : "text-white/70"}`} aria-hidden />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Usuário */}
      <div className="border-t border-white/10 p-4">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
            {iniciais(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{user.name}</span>
            <span className="block truncate text-xs text-white/65">{user.email}</span>
          </span>
        </div>
        <span className={`badge mb-3 ${perfil === "administrador" ? "bg-gold/20 text-gold-400" : "bg-white/10 text-white/85"}`}>
          {PERFIL[perfil] || perfil}
        </span>
        <form action={sair}>
          <button
            type="submit"
            className="flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Topbar mobile */}
      <header className="sticky top-0 z-40 flex w-full shrink-0 items-center gap-3 bg-ink-900 px-4 py-2.5 md:hidden">
        <button onClick={() => setAberto(true)} className="-ml-1 flex h-11 w-11 items-center justify-center text-white/85 hover:text-white" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/painel" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-white">
            <img src="/logo-lex.png" alt="" className="h-5 w-5 object-contain" />
          </span>
          <span className="font-bold text-white">LEX Licitações</span>
        </Link>
        <span className="ml-auto max-w-[120px] truncate text-xs text-white/65">{user.name}</span>
      </header>

      {/* Sidebar desktop */}
      <aside className="relative hidden w-64 shrink-0 flex-col bg-ink-900 md:flex">{conteudo}</aside>

      {/* Sidebar mobile (gaveta) */}
      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setAberto(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink-900 shadow-pop">{conteudo}</aside>
        </div>
      )}
    </>
  );
}
