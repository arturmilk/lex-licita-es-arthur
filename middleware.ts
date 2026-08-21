import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicRoutes = ["/login", "/register", "/api/auth", "/api/agent"];
const adminRoutes = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (publicRoutes.some((r) => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Rotas exclusivas de administrador
  if (adminRoutes.some((r) => pathname.startsWith(r))) {
    const perfil = (req.auth.user as any)?.perfil;
    if (perfil !== "administrador") {
      const url = req.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
