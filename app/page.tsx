import { redirect } from "next/navigation";

// Raiz do sistema: usuário autenticado vai direto para o PAINEL DE TRABALHO.
// A experiência começa pelo trabalho do servidor ("o que você precisa fazer?"),
// não pelos menus.
export default function Home() {
  redirect("/painel");
}
