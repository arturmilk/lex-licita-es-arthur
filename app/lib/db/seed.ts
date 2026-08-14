import { db } from "./index";
import { orgaos, usuarios, configuracoes } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database...");

  // Create default org
  const [orgao] = await db
    .insert(orgaos)
    .values({
      nome: "Órgão Demonstração",
      cnpj: "00.000.000/0000-00",
      esfera: "federal",
    })
    .onConflictDoNothing()
    .returning();

  if (orgao) {
    // Create admin user
    const senhaHash = await bcrypt.hash("Admin@123", 12);
    await db
      .insert(usuarios)
      .values({
        nome: "Administrador",
        email: "admin@estima.ia",
        senhaHash,
        perfil: "administrador",
        orgaoId: orgao.id,
        cargo: "Administrador do Sistema",
      })
      .onConflictDoNothing();

    // Create default config
    await db
      .insert(configuracoes)
      .values({
        orgaoId: orgao.id,
      })
      .onConflictDoNothing();

    console.log("Seed complete!");
    console.log("Admin login: admin@estima.ia / Admin@123");
  }

  process.exit(0);
}

seed().catch(console.error);
