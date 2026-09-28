import type { Metadata } from "next";
import AssistenteChat from "@/components/AssistenteChat";

export const metadata: Metadata = {
  title: "Assistente — LEX Licitações",
};

/**
 * /assistente — tela cheia do assistente.
 * O mesmo componente é reutilizado pela janela flutuante (canto inferior direito),
 * para não existirem dois chats diferentes no sistema.
 */
export default function AssistentePage() {
  return <AssistenteChat variante="pagina" />;
}
