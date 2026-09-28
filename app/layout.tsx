import type { Metadata, Viewport } from "next";
import "./globals.css";
import { auth } from "@/auth";
import Sidebar from "@/components/Sidebar";
import Topo from "@/components/Topo";
import AssistenteFlutuante from "@/components/AssistenteFlutuante";
import { DialogosProvider } from "@/components/Dialogos";
import { UsuarioProvider } from "@/components/UsuarioContexto";

export const metadata: Metadata = {
  title: "LEX Licitações — Pesquisa de Preços",
  description: "Pesquisa de preços e apoio à instrução de contratações públicas.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#032650",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAuth = !!session;

  if (!isAuth) {
    return (
      <html lang="pt-BR">
        <body className="bg-canvas">{children}</body>
      </html>
    );
  }

  const user = session.user as any;
  const perfil: string = user.perfil || "pesquisador";

  return (
    <html lang="pt-BR">
      <body className="bg-canvas">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-ink-900 focus:shadow-pop"
        >
          Pular para o conteúdo
        </a>
        <UsuarioProvider
          usuario={{ nome: user.name || "", email: user.email || "", perfil, orgaoNome: user.orgaoNome || "", cargo: user.cargo || "" }}
        >
          <DialogosProvider>
            <div className="flex h-screen flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh] md:flex-row">
              <Sidebar user={user} />
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <Topo perfil={perfil} />
                <main id="conteudo" className="scroll-fino flex-1 overflow-auto">
                  <div className="relative mx-auto max-w-content p-4 md:p-8">{children}</div>
                </main>
              </div>
            </div>
            {/* Acesso flutuante: só o Assistente. "Me ajuda" (contextual) virou parte dele;
                "Envie uma sugestão" fica no fim da barra lateral. Menos coisas soltas na tela. */}
            <AssistenteFlutuante />
          </DialogosProvider>
        </UsuarioProvider>
      </body>
    </html>
  );
}
