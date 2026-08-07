"use client";
import React from "react";
import { Eye } from "lucide-react";

const MOCK = [
  { id: "#P-9201", processo: "2026/0038", objeto: "Consultoria em TI", referencias: 8, preco: "R$ 18.500,00", data: "05/08/2026" },
  { id: "#P-9200", processo: "2026/0012", objeto: "Papel A4", referencias: 12, preco: "R$ 32,40", data: "04/08/2026" },
  { id: "#P-9198", processo: "2026/0009", objeto: "Veiculos administrativos", referencias: 6, preco: "R$ 98.700,00", data: "02/08/2026" },
];

export default function PesquisasPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Pesquisas realizadas</h1>
        <span className="text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">DEMONSTRACAO</span>
      </div>
      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">ID</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Processo</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Objeto</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Ref.</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Preco estimado</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Data</th>
              <th></th>
            </tr></thead>
            <tbody>
              {MOCK.map((p, i) => (
                <tr key={i} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-xs">{p.id}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{p.processo}</td>
                  <td className="py-2.5 px-3">{p.objeto}</td>
                  <td className="py-2.5 px-3">{p.referencias}</td>
                  <td className="py-2.5 px-3 font-medium">{p.preco}</td>
                  <td className="py-2.5 px-3 text-neutral-500">{p.data}</td>
                  <td className="py-2.5 px-3"><button className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500" title="Visualizar"><Eye className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
