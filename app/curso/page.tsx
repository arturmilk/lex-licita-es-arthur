import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PaginaCurso } from "@/components/curso/PaginaCurso";

export const metadata: Metadata = {
  title: "Lex Licitações — o curso de Israel Evangelista",
  description:
    "Licitações com método: o curso de Israel Evangelista, advogado e mestre em licitações, com o sistema LEX para aplicar no dia a dia.",
};

// Página de apresentação e venda do curso (pública). Quem já entrou vai para o painel:
// para usuário logado, o layout do sistema (barra lateral) envolveria a página de vendas.
export default async function CursoPage() {
  if (await auth()) redirect("/painel");
  return <PaginaCurso />;
}
