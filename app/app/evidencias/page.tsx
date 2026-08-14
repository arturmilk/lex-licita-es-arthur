"use client";
import React, { useState } from "react";
import { Upload, FileImage, FileText, FileSpreadsheet, Link2, Trash2, ExternalLink } from "lucide-react";

interface Evidencia {
  id: string;
  nome: string;
  processo: string;
  tipo: "imagem" | "pdf" | "xlsx" | "link";
  origem: string;
  anexadoEm: string;
  url?: string;
}

const MOCK: Evidencia[] = [
  { id: "1", nome: "print_pncp_001.png", processo: "2026/0042", tipo: "imagem", origem: "PNCP", anexadoEm: "06/08/2026", url: "https://pncp.gov.br/compra/982341" },
  { id: "2", nome: "termo_referencia.pdf", processo: "2026/0042", tipo: "pdf", origem: "upload", anexadoEm: "06/08/2026" },
  { id: "3", nome: "planilha_calculo.xlsx", processo: "2026/0038", tipo: "xlsx", origem: "sistema", anexadoEm: "05/08/2026" },
  { id: "4", nome: "link_pncp_consulta", processo: "2026/0042", tipo: "link", origem: "PNCP", anexadoEm: "06/08/2026", url: "https://pncp.gov.br/compra/982341" },
  { id: "5", nome: "edital_techsolucoes.pdf", processo: "2026/0042", tipo: "pdf", origem: "edital", anexadoEm: "06/08/2026", url: "https://pncp.gov.br/edital/techsolucoes-2026" },
];

function ti(t: string) {
  switch (t) {
    case "imagem": return <FileImage className="w-4 h-4 text-blue-500" />;
    case "pdf": return <FileText className="w-4 h-4 text-red-500" />;
    case "xlsx": return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    case "link": return <Link2 className="w-4 h-4 text-neutral-500" />;
    default: return null;
  }
}

export default function EvidenciasPage() {
  const [evidencias, setEvidencias] = useState(MOCK);
  const handleDelete = (id: string) => { if (confirm("Remover esta evidencia?")) setEvidencias(prev => prev.filter(e => e.id !== id)); };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Evidencias</h1>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-blue-600" />
          <h2 className="text-base font-medium">Links das referencias aceitas</h2>
        </div>
        <p className="text-sm text-neutral-500 mb-3">Links automaticamente vinculados dos resultados do PNCP que foram aceitos na pesquisa.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Documento de origem</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Processo</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Link</th>
            </tr></thead>
            <tbody>
              {evidencias.filter(e => e.url).map(e => (
                <tr key={e.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-xs">{e.nome}</td>
                  <td className="py-2.5 px-3 font-mono text-xs">{e.processo}</td>
                  <td className="py-2.5 px-3">
                    <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                      <ExternalLink className="w-3 h-3" /> Abrir link
                    </a>
                  </td>
                </tr>
              ))}
              {evidencias.filter(e => e.url).length === 0 && (
                <tr><td colSpan={3} className="py-4 text-center text-neutral-400 text-sm">Nenhum link vinculado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex justify-between mb-4">
          <h2 className="text-base font-medium">Todos os documentos</h2>
          <button onClick={() => alert("Upload simulado")} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800">
            <Upload className="w-4 h-4" /> Anexar evidencia
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-neutral-200">
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Documento</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Processo</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Tipo</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Origem</th>
              <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Anexado em</th>
              <th></th>
            </tr></thead>
            <tbody>
              {evidencias.map(e => (
                <tr key={e.id} className="border-b border-neutral-100 hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 px-3 flex items-center gap-2">{ti(e.tipo)}<span className="font-mono text-xs">{e.nome}</span></td>
                  <td className="py-2.5 px-3 font-mono text-xs">{e.processo}</td>
                  <td className="py-2.5 px-3"><span className="text-xs font-medium px-2 py-0.5 rounded border bg-neutral-50 text-neutral-600 border-neutral-200 capitalize">{e.tipo}</span></td>
                  <td className="py-2.5 px-3 capitalize">{e.origem}</td>
                  <td className="py-2.5 px-3 text-neutral-500">{e.anexadoEm}</td>
                  <td className="py-2.5 px-3">
                    <button onClick={() => handleDelete(e.id)} className="p-1.5 rounded hover:bg-red-100 text-neutral-400 hover:text-red-600 transition-colors" title="Remover"><Trash2 className="w-4 h-4" /></button>
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
