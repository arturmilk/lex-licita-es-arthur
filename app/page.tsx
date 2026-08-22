import { redirect } from "next/navigation";

// Raiz do sistema: usuário autenticado vai direto para a pesquisa.
// (sem sessão, o middleware já redireciona para /login)
export default function Home() {
  redirect("/pesquisa/nova");
}
