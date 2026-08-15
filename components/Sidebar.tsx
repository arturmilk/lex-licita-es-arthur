"use client";
import React, { useState } from "react";
import {
  ShieldCheck, LayoutDashboard, Plus, FileText, Search,
  BarChart3, Paperclip, Settings, LogOut, Menu, X, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "@/lib/auth-actions";

const NAV = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "Dashboard" },
  { href: "/processos",   icon: FileText,         label: "Processos" },
  { href: "/pesquisas",   icon: Search,           label: "Pesquisas" },
  { href: "/relatorios",  icon: BarChart3,         label: "Relatórios" },
  { href: "/evidencias",  icon: Paperclip,         label: "Evidências" },
];

const BOTTOM_NAV = [
  { href: "/admin", icon: Settings, label: "Administração" },
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function NavLink({ href, icon: Icon, label, onClick }: { href: string; icon: React.ElementType; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const ativo = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
        ativo
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {ativo && <ChevronRight className="w-3 h-3 opacity-60" />}
    </Link>
  );
}

function SidebarContent({ user, close }: { user: any; close?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-none">Estima.IA</p>
          <p className="text-slate-500 text-xs truncate mt-0.5">{user.orgaoNome || "Órgão"}</p>
        </div>
        {close && (
          <button onClick={close} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* CTA Nova pesquisa */}
      <div className="px-3 pt-4 pb-2">
        <Link
          href="/pesquisa/nova"
          onClick={close}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nova pesquisa
        </Link>
      </div>

      {/* Nav principal */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <p className="px-3 pt-2 pb-1 text-xs font-semibold text-slate-600 uppercase tracking-wider">Menu</p>
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} onClick={close} />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-3 pb-2 space-y-0.5 border-t border-slate-800 pt-3">
        {BOTTOM_NAV.map((item) => (
          <NavLink key={item.href} {...item} onClick={close} />
        ))}
      </div>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-slate-800">
        <div className="flex items-center gap-3 mb-2.5">
          <div className="w-8 h-8 rounded-full bg-indigo-700 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">{initials(user.name || "U")}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-none">{user.name}</p>
            <p className="text-slate-500 text-xs truncate mt-0.5">{user.email}</p>
          </div>
        </div>
        <form action={sair}>
          <button
            type="submit"
            className="flex items-center gap-2 w-full px-3 py-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair da conta
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Sidebar({ user }: { user: any }) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Topbar mobile */}
      <header className="md:hidden sticky top-0 z-40 bg-slate-900 px-4 py-3 flex items-center gap-3 border-b border-slate-800">
        <button onClick={() => setAberto(true)} className="text-slate-400 hover:text-white transition-colors" aria-label="Abrir menu">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
            <ShieldCheck className="w-3 h-3 text-white" />
          </div>
          <span className="text-white font-bold text-sm">Estima.IA</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-700 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{initials(user.name || "U")}</span>
          </div>
        </div>
      </header>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-56 bg-slate-900 flex-col shrink-0 border-r border-slate-800">
        <SidebarContent user={user} />
      </aside>

      {/* Sidebar mobile overlay */}
      {aberto && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAberto(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
            <SidebarContent user={user} close={() => setAberto(false)} />
          </aside>
        </div>
      )}
    </>
  );
}
