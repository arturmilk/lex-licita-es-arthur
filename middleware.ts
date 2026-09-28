import { auth } from "@/auth";
import { NextResponse } from "next/server";

// Único middleware do projeto. Existia um segundo arquivo em `app/middleware.ts`
// (resto de uma organização antiga): o build do Docker compilava aquele e o build
// nativo compilava este — resultado imprevisível conforme onde o build rodava.
// As rotas públicas abaixo são a UNIÃO das duas versões (inclui /api/register e
// /api/health), então o comportamento em produção não muda.
const publicRoutes = [
  "/login",
  "/register",
  "/api/register",
  "/api/auth",
  "/api/agent",
  "/api/health",
];
const adminRoutes = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Require auth for everything else: redirect ABSOLUTO construído a partir do
  // Host/x-forwarded-* que chegam do proxy (req.nextUrl é montado com o hostname
  // interno do container e quebra atrás de proxy/túnel).
  if (!req.auth) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const qs = pathname && pathname !== "/" ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(new URL(`/login${qs}`, `${proto}://${host}`));
  }

  // Rotas exclusivas de administrador
  if (adminRoutes.some((r) => pathname.startsWith(r))) {
    const perfil = (req.auth.user as any)?.perfil;
    if (perfil !== "administrador") {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
      const proto = req.headers.get("x-forwarded-proto") || "http";
      return NextResponse.redirect(new URL("/painel", `${proto}://${host}`));
    }
  }

  return NextResponse.next();
});

// Arquivos estáticos (imagens e fontes auto-hospedadas em /public/fonts) ficam fora
// do middleware: antes, as fontes caíam no redirect para /login e a própria tela de
// login abria com a fonte substituta do sistema.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)",
  ],
};
