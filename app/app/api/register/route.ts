import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { usuarios, orgaos, configuracoes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  senha: z.string().min(8),
  orgaoNome: z.string().min(3),
  orgaoCnpj: z.string().optional(),
  esfera: z.enum(["federal", "estadual", "municipal", "distrital"]).default("federal"),
  cargo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    // Check email already exists
    const existing = await db
      .select({ id: usuarios.id })
      .from(usuarios)
      .where(eq(usuarios.email, data.email))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
    }

    // Create or find org
    let orgaoId: string;
    if (data.orgaoCnpj) {
      const existingOrgao = await db
        .select({ id: orgaos.id })
        .from(orgaos)
        .where(eq(orgaos.cnpj, data.orgaoCnpj))
        .limit(1);

      if (existingOrgao.length > 0) {
        orgaoId = existingOrgao[0].id;
      } else {
        const [newOrgao] = await db
          .insert(orgaos)
          .values({ nome: data.orgaoNome, cnpj: data.orgaoCnpj, esfera: data.esfera })
          .returning({ id: orgaos.id });
        orgaoId = newOrgao.id;
        // Create default config for new org
        await db.insert(configuracoes).values({ orgaoId }).onConflictDoNothing();
      }
    } else {
      const [newOrgao] = await db
        .insert(orgaos)
        .values({ nome: data.orgaoNome, esfera: data.esfera })
        .returning({ id: orgaos.id });
      orgaoId = newOrgao.id;
      await db.insert(configuracoes).values({ orgaoId }).onConflictDoNothing();
    }

    const senhaHash = await bcrypt.hash(data.senha, 12);
    const [usuario] = await db
      .insert(usuarios)
      .values({
        nome: data.nome,
        email: data.email,
        senhaHash,
        perfil: "administrador", // First user is admin
        orgaoId,
        cargo: data.cargo,
      })
      .returning({ id: usuarios.id, nome: usuarios.nome, email: usuarios.email });

    return NextResponse.json({ usuario }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
