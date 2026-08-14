import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import { usuarios, orgaos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const result = await db
          .select({
            id: usuarios.id,
            nome: usuarios.nome,
            email: usuarios.email,
            senhaHash: usuarios.senhaHash,
            perfil: usuarios.perfil,
            ativo: usuarios.ativo,
            orgaoId: usuarios.orgaoId,
            cargo: usuarios.cargo,
            orgaoNome: orgaos.nome,
          })
          .from(usuarios)
          .leftJoin(orgaos, eq(usuarios.orgaoId, orgaos.id))
          .where(eq(usuarios.email, email))
          .limit(1);

        const user = result[0];
        if (!user || !user.ativo) return null;

        const valid = await bcrypt.compare(password, user.senhaHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.nome,
          email: user.email,
          perfil: user.perfil,
          orgaoId: user.orgaoId,
          orgaoNome: user.orgaoNome,
          cargo: user.cargo,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.perfil = (user as any).perfil;
        token.orgaoId = (user as any).orgaoId;
        token.orgaoNome = (user as any).orgaoNome;
        token.cargo = (user as any).cargo;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        (session.user as any).perfil = token.perfil;
        (session.user as any).orgaoId = token.orgaoId;
        (session.user as any).orgaoNome = token.orgaoNome;
        (session.user as any).cargo = token.cargo;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
});
