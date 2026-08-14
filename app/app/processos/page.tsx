"use client";
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { listarProcessos } from "@/lib/actions";

interface ProcessoRow {
  id: string;
  numero: string;
  objeto: string;
  unidade: string | null;
  status: string;
  updatedAt: Date | string;
}

export default function ProcessosPage() {
  const [rows, setRows] = useState<ProcessoRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarProcessos()
      .then((r) => setRows(r as unknown as ProcessoRow[]))
      .catch((e) => setErro(String(e?.message || e)));
  }, []);

  const statusLabel = (s: string) => ({ rascunho: "rascunho", pesquisando: "pesquisando", estimado: "estimado", concluido: "concluido", cancelado: "cancelado" }[s] || s);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Processos</h1>
        <span className="text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">DEMONSTRACAO</span>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        {erro && <p className="text-sm text-red-600 mb-3">Erro ao carregar: {erro}</p>}
        {rows === null ? (
          <div className="flex items-center justify-center py-16 gap-2 text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando processos...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-neutral-500 py-10 text-center">Nenhum processo salvo ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-200">
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Numero</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Objeto</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Unidade</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Status</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Atualizado</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-2 px-3 font-mono text-xs">{r.numero}</td>
                    <td className="py-2 px-3 max-w-[320px] truncate" title={r.objeto}>{r.objeto}</td>
                    <td className="py-2 px-3">{r.unidade || "—"}</td>
                    <td className="py-2 px-3"><span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">{statusLabel(r.status)}</span></td>
                    <td className="py-2 px-3">{new Date(r.updatedAt).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
