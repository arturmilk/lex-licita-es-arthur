import React from "react";
import Link from "next/link";
import { LayoutDashboard, Plus, FileText, Search, BarChart3, Paperclip, Settings, Layers, LogOut } from "lucide-react";
import "./globals.css";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pesquisa/nova", label: "Nova pesquisa", icon: Plus },
  { href: "/processos", label: "Processos", icon: FileText },
  { href: "/pesquisas", label: "Pesquisas realizadas", icon: Search },
  { href: "/relatorios", label: "Relatorios", icon: BarChart3 },
  { href: "/evidencias", label: "Evidencias", icon: Paperclip },
  { href: "/admin", label: "Administracao", icon: Settings },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-white text-neutral-900 antialiased">
        <div className="flex min-h-screen">
          <aside className="hidden md:flex w-64 flex-col border-r border-neutral-200 bg-neutral-50">
            <div className="flex items-center gap-3 px-5 py-5 border-b border-neutral-200">
              <Layers className="w-6 h-6 text-neutral-900" />
              <span className="text-lg font-medium tracking-wide">Estima.IA</span>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors">
                    <Icon className="w-[18px] h-[18px]" />{item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="px-3 py-4 border-t border-neutral-200">
              <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 transition-colors w-full">
                <LogOut className="w-[18px] h-[18px]" />Sair
              </button>
            </div>
          </aside>
          <main className="flex-1">
            <div className="max-w-6xl mx-auto px-4 md:px-8 py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
