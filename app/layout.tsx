import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import { Layers, LayoutDashboard, Plus, FileText, Search, BarChart3, Paperclip, Settings, LogOut, Key } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Estima.IA - Pesquisa de Preços",
  description: "Sistema de pesquisa de preços para licitações públicas",
};

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/pesquisa/nova", icon: Plus, label: "Nova pesquisa" },
  { href: "/processos", icon: FileText, label: "Processos" },
  { href: "/pesquisas", icon: Search, label: "Pesquisas" },
  { href: "/relatorios", icon: BarChart3, label: "Relatórios" },
  { href: "/evidencias", icon: Paperclip, label: "Evidências" },
  { href: "/admin", icon: Settings, label: "Administração" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAuth = !!session;

  if (!isAuth) {
    return (
      <html lang="pt-BR">
        <body className="bg-neutral-50">{children}</body>
      </html>
    );
  }

  const user = session.user as any;

  return (
    <html lang="pt-BR">
      <body className="bg-neutral-50">
        <div className="flex h-screen">
          {/* Sidebar */}
          <aside className="hidden md:flex w-60 bg-neutral-900 flex-col">
            <div className="p-5 border-b border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <Layers className="w-4 h-4 text-neutral-900" />
                </div>
                <span className="text-white font-bold text-lg">Estima.IA</span>
              </div>
              <p className="text-neutral-400 text-xs mt-2 truncate">{user.orgaoNome || "Órgão"}</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {navItems.map(({ href, icon: Icon, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors text-sm"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-neutral-800">
              <div className="mb-3">
                <p className="text-white text-sm font-medium truncate">{user.name}</p>
                <p className="text-neutral-400 text-xs truncate">{user.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-neutral-700 text-neutral-300 text-xs rounded">
                  {user.perfil}
                </span>
              </div>
              <form
                action={async () => {
                  "use server";
                  const { signOut } = await import("@/auth");
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="flex items-center gap-2 w-full px-3 py-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </form>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
