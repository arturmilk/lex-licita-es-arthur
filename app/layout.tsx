import type { Metadata } from "next";
import "./globals.css";
import { auth } from "@/auth";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Estima.IA - Pesquisa de Preços",
  description: "Sistema de pesquisa de preços para licitações públicas",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAuth = !!session;

  if (!isAuth) {
    return (
      <html lang="pt-BR">
        <body className="bg-slate-50">{children}</body>
      </html>
    );
  }

  const user = session.user as any;

  return (
    <html lang="pt-BR">
      <body className="bg-slate-50">
        <div className="flex h-screen overflow-hidden">
          <Sidebar user={user} />
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top header */}
            <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="font-medium text-slate-800">Estima.IA</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800 leading-none">{user.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user.orgaoNome || "Órgão"}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                  <span className="text-white text-xs font-bold">
                    {(user.name || "U").split(" ").slice(0, 2).map((n: string) => n[0]).join("").toUpperCase()}
                  </span>
                </div>
              </div>
            </header>
            {/* Page content */}
            <main className="flex-1 overflow-auto">
              <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
