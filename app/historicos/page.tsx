"use client";

import ProcessosPage from "@/app/processos/page";
import PesquisasPage from "@/app/pesquisas/page";
import Link from "next/link";
import { Plus } from "lucide-react";

export default function HistoricosPage() {
  return (
    <div className="space-y-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Históricos</h1>
          <p className="text-sm text-slate-500 mt-1">Consulte seus processos e, logo abaixo, o histórico das pesquisas de preços realizadas.</p>
        </div>
        <Link
          href="/pesquisa/nova"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#032650] text-white text-sm font-semibold shadow-sm hover:bg-[#042f5e] hover:shadow-md transition-all"
        >
          <Plus size={16} /> Nova pesquisa de preço
        </Link>
      </div>

      <section className="scroll-mt-6">
        <ProcessosPage />
      </section>

      <section className="pt-10 border-t border-slate-200 scroll-mt-6">
        <PesquisasPage />
      </section>
    </div>
  );
}
