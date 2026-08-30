"use client";
import React, { useState } from "react";
import { Layers, LayoutDashboard, Plus, FileText, Search, BarChart3, Paperclip, Settings, LogOut, Menu, X, Home, Users, Sparkles, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "@/lib/auth-actions";

const navItems = [
  { href: "/painel", icon: Home, label: "Painel de trabalho", roles: ["pesquisador", "gestor", "administrador"], destaque: true },
  { href: "/assistente", icon: MessageCircle, label: "💬 Assistente guiado", roles: ["pesquisador", "gestor", "administrador"], destaque: true },
  { href: "/pesquisa/nova", icon: Plus, label: "Nova pesquisa", roles: ["pesquisador", "gestor", "administrador"] },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["pesquisador", "gestor", "administrador"] },
  { href: "/processos", icon: FileText, label: "Processos", roles: ["pesquisador", "gestor", "administrador"] },
  { href: "/pesquisas", icon: Search, label: "Pesquisas", roles: ["pesquisador", "gestor", "administrador"] },
  { href: "/relatorios", icon: BarChart3, label: "Relatórios", roles: ["pesquisador", "gestor", "administrador"] },
  { href: "/evidencias", icon: Paperclip, label: "Evidências", roles: ["pesquisador", "gestor", "administrador"] },
  { href: "/gestor", icon: Users, label: "Visão do gestor", roles: ["gestor", "administrador"] },
  { href: "/admin", icon: Settings, label: "Administração", roles: ["administrador"] },
];

const perfilLabel: Record<string, string> = {
  administrador: "Administrador",
  gestor: "Gestor",
  pesquisador: "Pesquisador",
};

const perfilCor: Record<string, string> = {
  administrador: "bg-purple-700 text-purple-200",
  gestor: "bg-amber-700 text-amber-200",
  pesquisador: "bg-neutral-700 text-neutral-300",
};

export default function Sidebar({ user }: { user: any }) {
  const [aberto, setAberto] = useState(false);
  const pathname = usePathname();
  const perfil: string = user.perfil || "pesquisador";

  const conteudo = (
    <>
      <div className="p-5 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <Layers className="w-4 h-4 text-neutral-900" />
          </div>
          <span className="text-white font-bold text-lg">Estima.IA</span>
          <button className="md:hidden ml-auto text-neutral-400" onClick={() => setAberto(false)} aria-label="Fechar menu">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-neutral-400 text-xs mt-2 truncate">{user.orgaoNome || "Órgão"}</p>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.filter(item => item.roles.includes(perfil)).map(({ href, icon: Icon, label }) => {
          const ativo = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setAberto(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
                ativo ? "bg-neutral-800 text-white font-medium" : "text-neutral-300 hover:bg-neutral-800 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-neutral-800">
        <div className="mb-3">
          <p className="text-white text-sm font-medium truncate">{user.name}</p>
          <p className="text-neutral-400 text-xs truncate">{user.email}</p>
          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded font-medium ${perfilCor[perfil] || perfilCor.pesquisador}`}>
            {perfilLabel[perfil] || perfil}
          </span>
        </div>
        <form action={sair}>
          <button
            type="submit"
            className="flex items-center gap-2 w-full px-3 py-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Topbar mobile */}
      <header className="md:hidden shrink-0 sticky top-0 z-40 bg-neutral-900 px-4 py-3 flex items-center gap-3 w-full">
        <button onClick={() => setAberto(true)} className="text-neutral-300" aria-label="Abrir menu">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
            <Layers className="w-3 h-3 text-neutral-900" />
          </div>
          <span className="text-white font-bold">Estima.IA</span>
        </div>
        <span className="ml-auto text-neutral-400 text-xs truncate max-w-[140px]">{user.name}</span>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-60 bg-neutral-900 flex-col shrink-0">
        {conteudo}
      </aside>

      {/* Sidebar mobile (overlay) */}
      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAberto(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-neutral-900 flex flex-col">{conteudo}</aside>
        </div>
      )}
    </>
  );
}
