"use client";

import ProcessosPage from "@/app/processos/page";
import PesquisasPage from "@/app/pesquisas/page";
import Link from "next/link";
import { Plus } from "lucide-react";
import { CabecalhoPagina } from "@/components/Pagina";

export default function HistoricosPage() {
  return (
    <div>
      <CabecalhoPagina
        titulo="Histórico"
        descricao="Seus processos e, logo abaixo, as pesquisas de preços já realizadas."
        acoes={
          <Link href="/pesquisa/nova" className="btn btn-primary">
            <Plus size={16} aria-hidden /> Nova pesquisa de preço
          </Link>
        }
      />

      {/* Atalhos para as duas partes da página */}
      <nav aria-label="Seções do histórico" className="-mt-3 mb-8 flex flex-wrap gap-2">
        <a href="#processos" className="chip">Processos</a>
        <a href="#pesquisas" className="chip">Pesquisas de preços</a>
      </nav>

      <section id="processos" className="scroll-mt-6">
        <ProcessosPage />
      </section>

      <section id="pesquisas" className="mt-12 scroll-mt-6 border-t border-slate-200 pt-10">
        <PesquisasPage />
      </section>
    </div>
  );
}
