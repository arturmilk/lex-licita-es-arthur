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
        <body className="bg-neutral-50">{children}</body>
      </html>
    );
  }

  const user = session.user as any;

  return (
    <html lang="pt-BR">
      <body className="bg-neutral-50">
        <div className="flex h-screen">
          <Sidebar user={user} />
          <main className="flex-1 overflow-auto">
            <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
