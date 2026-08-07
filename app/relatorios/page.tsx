"use client";
import React from "react";
import { Download, FileText, Table } from "lucide-react";

const MOCK = [
  { nome: "estimativa_2026_0038.pdf", processo: "2026/0038", tipo: "pdf" as const, geradoEm: "05/08/2026" },
  { nome: "estimativa_2026_0038.xlsx", processo: "2026/0038", tipo: "xlsx" as const, geradoEm: "05/08/2026" },
  { nome: "estimativa_2026_0012.pdf", processo: "2026/0012", tipo: "pdf" as const, geradoEm: "04/08/2026" },
];

export default function RelatoriosPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Relatorios</h1>
        <span className="text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">DEMONSTRACAO</span>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Relatorio</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Processo</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Tipo</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Gerado em</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Acoes</th>
            </tr></thead>
            <tbody>
              {MOCK.map((r, i) => (
                <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3 flex items-center gap-2">
                    {r.tipo === "pdf" ? <FileText className="w-4 h-4 text-red-500" /> : <Table className="w-4 h-4 text-green-600" />}
                    <span className="font-mono text-xs">{r.nome}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs">{r.processo}</td>
                  <td className="py-2.5 px-3"><span className={`text-xs font-medium px-2 py-0.5 rounded border ${r.tipo === "pdf" ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>{r.tipo.toUpperCase()}</span></td>
                  <td className="py-2.5 px-3 text-neutral-500">{r.geradoEm}</td>
                  <td className="py-2.5 px-3">
                    <button onClick={() => alert(`Download: ${r.nome}`)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                      <Download className="w-3.5 h-3.5" /> Baixar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
