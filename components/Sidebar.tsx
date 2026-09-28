"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, LogOut, Menu, Search, X } from "lucide-react";
import { sair } from "@/lib/auth-actions";
import SugestaoSidebar from "@/components/SugestaoSidebar";
import { GRUPOS, PERFIL, itemAtivo } from "@/lib/navegacao";
import { abrirBusca, alternarAssistente } from "@/components/UsuarioContexto";

function iniciais(nome: string) {
  return (nome || "U").trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export default function Sidebar({ user }: { user: any }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  const perfil: string = user.perfil || "pesquisador";

  // Trocar de tela fecha a gaveta do celular
  useEffect(() => setAberto(false), [pathname]);

  // Em telas baixas a lista rola: mantém o item da tela atual à vista (fora do esmaecimento)
  useEffect(() => {
    document.querySelector<HTMLElement>('aside.sidebar-compacta a[aria-current="page"]')?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  // Esc fecha a gaveta
  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aberto]);

  const conteudo = (
    <>
      {/* Marca + órgão — mesma altura do topo (64px): as linhas se encontram */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
        <Link href="/painel" onClick={() => setAberto(false)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-black/5">
            <img src="/logo-lex.png" alt="" className="h-7 w-7 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold leading-tight tracking-[-0.01em] text-white">LEX Licitações</span>
            <span className="mt-0.5 block truncate text-xs text-white/55">{user.orgaoNome || "Órgão"}</span>
          </span>
        </Link>
        <button
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setAberto(false)}
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navegação */}
      <nav className="nav-rolagem scroll-fino scroll-escuro flex-1 overflow-y-auto px-3 pb-5 pt-2" aria-label="Navegação principal">
        {GRUPOS.map((grupo) => {
          if (grupo.roles && !grupo.roles.includes(perfil)) return null;
          const itens = grupo.itens.filter((i) => !i.roles || i.roles.includes(perfil));
          const adm = grupo.nome === "Administração";
          return (
            <div key={grupo.nome} className={adm ? "mt-2.5 border-t border-white/10" : ""}>
              <p className={`nav-grupo px-3 pb-1.5 pt-3.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${adm ? "text-gold-400/90" : "text-white/45"}`}>
                {grupo.nome}
              </p>
              <div className="space-y-0.5">
                {itens.map((item) => {
                  const { href, icon: Icon, label } = item;
                  const ativo = itemAtivo(item, pathname);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setAberto(false)}
                      aria-current={ativo ? "page" : undefined}
                      className={`nav-item group relative flex min-h-[44px] scroll-mb-8 items-center gap-3 rounded-lg py-2 pl-3.5 pr-3 text-sm md:min-h-[40px] ${
                        ativo
                          ? "bg-white/[0.09] font-medium text-white"
                          : "text-white/75 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {ativo && <span className="nav-indicator absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-gold-500" aria-hidden />}
                      <Icon className={`nav-icon h-[18px] w-[18px] shrink-0 ${ativo ? "text-gold-400" : "text-white/55 group-hover:text-white/80"}`} aria-hidden />
                      {label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Sugestão + pessoa logada */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <SugestaoSidebar />
        <div className="mt-2.5 flex items-center gap-3 rounded-lg pl-1">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-500/15 text-xs font-semibold text-gold-400 ring-1 ring-gold-500/30"
            aria-hidden
          >
            {iniciais(user.name)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-white">{user.name}</span>
            <span className="block truncate text-xs text-white/55">{PERFIL[perfil] || perfil}</span>
          </span>
          <form action={sair}>
            <button
              type="submit"
              title="Sair"
              aria-label="Sair do sistema"
              className="flex h-11 w-11 items-center justify-center rounded-lg text-white/65 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Topo do celular: menu · marca · busca · assistente */}
      <header className="sticky top-0 z-40 flex h-14 w-full shrink-0 items-center gap-1 bg-ink-900 px-2 md:hidden">
        <button onClick={() => setAberto(true)} className="flex h-11 w-11 items-center justify-center rounded-lg text-white/85 hover:bg-white/10 hover:text-white" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/painel" className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white">
            <img src="/logo-lex.png" alt="" className="h-5 w-5 object-contain" />
          </span>
          <span className="truncate text-[15px] font-semibold text-white">LEX Licitações</span>
        </Link>
        <button onClick={abrirBusca} className="flex h-11 w-11 items-center justify-center rounded-lg text-white/85 hover:bg-white/10 hover:text-white" aria-label="Buscar ou ir para">
          <Search className="h-5 w-5" />
        </button>
        {pathname !== "/assistente" && (
          <button onClick={alternarAssistente} className="flex h-11 w-11 items-center justify-center rounded-lg text-gold-400 hover:bg-white/10" aria-label="Abrir assistente">
            <Bot className="h-5 w-5" />
          </button>
        )}
      </header>

      {/* Sidebar desktop */}
      <aside className="sidebar-compacta relative hidden w-64 shrink-0 flex-col bg-ink-900 md:flex">{conteudo}</aside>

      {/* Sidebar mobile (gaveta) */}
      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink-950/60" onClick={() => setAberto(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 flex w-[18rem] max-w-[85vw] flex-col bg-ink-900 shadow-pop">{conteudo}</aside>
        </div>
      )}
    </>
  );
}
