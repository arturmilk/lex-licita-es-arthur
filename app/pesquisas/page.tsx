"use client";
import React, { useEffect, useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { listarPesquisas } from "@/lib/actions";

interface PesquisaRow {
  id: string;
  objeto: string;
  quantidade: number;
  status: string;
  precoUnitarioEstimado: string | null;
  precoTotalEstimado: string | null;
  createdAt: Date | string;
  processoNumero: string | null;
  referenciasAceitas: number;
}

export default function PesquisasPage() {
  const [rows, setRows] = useState<PesquisaRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarPesquisas()
      .then((r) => setRows(r as unknown as PesquisaRow[]))
      .catch((e) => setErro(String(e?.message || e)));
  }, []);

  const fmt = (v: string | null) => (v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const fmtData = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR");
  const statusLabel = (s: string) => ({ em_andamento: "em andamento", concluida: "concluida", cancelada: "cancelada" }[s] || s);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Pesquisas realizadas</h1>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        {erro && <p className="text-sm text-red-600 mb-3">Erro ao carregar: {erro}</p>}
        {rows === null ? (
          <div className="flex items-center justify-center py-16 gap-2 text-neutral-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando pesquisas...
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-neutral-500 py-10 text-center">Nenhuma pesquisa salva ainda. Inicie uma nova pesquisa no wizard.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-neutral-200">
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">ID</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Processo</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Objeto</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Ref. aceitas</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Preco estimado</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Status</th>
                <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Data</th>
                <th></th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                    <td className="py-2 px-3 font-mono text-xs">{r.id.slice(0, 8)}</td>
                    <td className="py-2 px-3 font-medium">{r.processoNumero || "—"}</td>
                    <td className="py-2 px-3 max-w-[260px] truncate" title={r.objeto}>{r.objeto}</td>
                    <td className="py-2 px-3">{r.referenciasAceitas}</td>
                    <td className="py-2 px-3">{fmt(r.precoTotalEstimado)}</td>
                    <td className="py-2 px-3"><span className="text-xs px-2 py-0.5 rounded bg-neutral-100 text-neutral-600">{statusLabel(r.status)}</span></td>
                    <td className="py-2 px-3">{fmtData(r.createdAt)}</td>
                    <td className="py-2 px-3 text-right">
                      <button className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium" onClick={() => window.open(`/pesquisas/${r.id}`, "_blank")}>
                        <Eye className="w-3.5 h-3.5" /> Ver
                      </button>
                    </td>
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
