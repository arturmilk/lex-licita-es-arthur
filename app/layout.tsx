import type { Metadata, Viewport } from "next";
import "./globals.css";
import { auth } from "@/auth";
import Sidebar from "@/components/Sidebar";
import FeedbackButton from "@/components/FeedbackButton";
import MeAjuda from "@/components/MeAjuda";

export const metadata: Metadata = {
  title: "LEX Licitações — Pesquisa de Preços",
  description: "Pesquisa de preços e apoio à instrução de contratações públicas.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

function iniciais(nome: string) {
  return (nome || "U").trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

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
      <body className="bg-slate-100">
        <div className="flex h-screen flex-col overflow-hidden md:flex-row">
          <Sidebar user={user} />
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Barra superior (desktop) — identidade + usuário logado */}
            <header className="hidden shrink-0 items-center justify-between border-b border-slate-200 bg-white px-8 py-3 md:flex">
              <div className="flex items-center gap-2.5">
                <img src="/logo-lex.png" alt="" className="h-7 w-auto object-contain" />
                <span className="text-sm font-semibold text-ink-900">LEX Licitações</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right leading-tight">
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-600">{user.orgaoNome || "Órgão"}</p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-900" aria-hidden>
                  <span className="text-xs font-bold text-white">{iniciais(user.name)}</span>
                </div>
              </div>
            </header>

            <main id="conteudo" className="flex-1 overflow-auto">
              <div className="mx-auto max-w-content p-4 md:p-8">{children}</div>
            </main>
          </div>
        </div>
        <FeedbackButton />
        <MeAjuda contexto="Navegando pelo LEX Licitações" />
      </body>
    </html>
  );
}
