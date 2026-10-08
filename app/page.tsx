import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PaginaInicial } from "@/components/PaginaInicial";

export const metadata: Metadata = {
  title: "LEX Licitações — Curso e sistema de pesquisa de preços",
  description:
    "Curso de pesquisa de preços nas contratações públicas e o LEX, sistema com integração oficial ao PNCP e ao Compras.gov.br.",
};

// Raiz do sistema: quem já entrou vai direto para o PAINEL DE TRABALHO ("Meu dia");
// o visitante vê a página inicial — o curso e o sistema, com o login no topo.
export default async function Home() {
  if (await auth()) redirect("/painel");
  return <PaginaInicial />;
}
