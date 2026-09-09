import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/login", "/register", "/api/auth", "/api/agent"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Require auth for everything else: redirect ABSOLUTO construído a partir
  // do Host/x-forwarded-* que chegam do proxy (nunca localhost do servidor —
  // req.nextUrl é montado com o hostname interno e quebra atrás de túnel).
  if (!req.auth) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const qs = pathname && pathname !== "/" ? `?callbackUrl=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(new URL(`/login${qs}`, `${proto}://${host}`));
  }

  // Rotas exclusivas de administrador
  if (pathname.startsWith("/admin")) {
    const perfil = (req.auth.user as any)?.perfil;
    if (perfil !== "administrador") {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost";
      const proto = req.headers.get("x-forwarded-proto") || "http";
      return NextResponse.redirect(new URL("/dashboard", `${proto}://${host}`));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
