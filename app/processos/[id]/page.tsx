import { redirect } from "next/navigation";

// A rota /processos/[id] não existe mais — o processo é visto na JORNADA GUIADA.
// Qualquer link antigo (ou acesso direto) é redirecionado automaticamente.
export default function ProcessoRedirect({ params }: { params: { id: string } }) {
  redirect(`/processos/${params.id}/jornada`);
}
