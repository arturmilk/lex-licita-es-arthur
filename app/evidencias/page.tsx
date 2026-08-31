"use client";
import React, { useEffect, useState } from "react";
import { FileImage, FileText, FileSpreadsheet, Link2, Trash2, ExternalLink, Loader2 } from "lucide-react";
import { listarEvidenciasOrg, removerEvidencia } from "@/lib/actions";

type Ev = Awaited<ReturnType<typeof listarEvidenciasOrg>>[number];

function TipoIcon({ tipo }: { tipo: string }) {
  switch (tipo) {
    case "imagem": return <FileImage className="w-4 h-4 text-blue-500" />;
    case "pdf":    return <FileText className="w-4 h-4 text-red-500" />;
    case "xlsx":   return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    case "link":   return <Link2 className="w-4 h-4 text-slate-500" />;
    default:       return <FileText className="w-4 h-4 text-slate-400" />;
  }
}

function fmtData(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function EvidenciasPage() {
  const [evidencias, setEvidencias] = useState<Ev[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const carregar = () => {
    listarEvidenciasOrg()
      .then(setEvidencias)
      .catch(e => setErro(String(e?.message || e)));
  };

  useEffect(carregar, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta evidência?")) return;
    setRemovendo(id);
    try {
      await removerEvidencia(id);
      setEvidencias(prev => prev?.filter(e => e.id !== id) ?? null);
    } catch (e: any) {
      alert("Erro ao remover: " + (e?.message || e));
    } finally {
      setRemovendo(null);
    }
  };

  const comLink = evidencias?.filter(e => e.url) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Evidências</h1>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Erro: {erro}</div>
      )}

      {/* Links do PNCP aceitos */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden mb-6">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
          <Link2 className="w-5 h-5 text-[#032650]" />
          <h2 className="text-base font-semibold text-slate-800">Links de referências aceitas</h2>
        </div>
        <div className="px-6 py-2 text-xs text-slate-400 border-b border-slate-50">
          Links vinculados automaticamente a partir dos resultados aceitos nas pesquisas.
        </div>
        {evidencias === null ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : comLink.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-400">Nenhum link vinculado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Documento", "Processo", "Pesquisa", "Link"].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comLink.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{e.nome}</td>
                    <td className="py-2.5 px-4 font-mono text-xs">{e.processoNumero || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-[220px] truncate" title={e.pesquisaObjeto}>{e.pesquisaObjeto}</td>
                    <td className="py-2.5 px-4">
                      <a href={e.url!} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#032650] hover:text-[#042f5e] text-xs font-medium">
                        <ExternalLink className="w-3 h-3" /> Abrir
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Todos os documentos */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-800">Todos os documentos</h2>
        </div>
        {evidencias === null ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : evidencias.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            Nenhuma evidência registrada. Complete uma pesquisa para gerar evidências.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Documento", "Processo", "Pesquisa", "Tipo", "Origem", "Data", ""].map((h, i) => (
                    <th key={i} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evidencias.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <TipoIcon tipo={e.tipo} />
                        <span className="font-mono text-xs text-slate-700">{e.nome}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs">{e.processoNumero || "—"}</td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-[200px] truncate" title={e.pesquisaObjeto}>{e.pesquisaObjeto}</td>
                    <td className="py-2.5 px-4">
                      <span className="text-xs font-medium px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200 capitalize">{e.tipo}</span>
                    </td>
                    <td className="py-2.5 px-4 capitalize text-slate-500 text-xs">{e.origem}</td>
                    <td className="py-2.5 px-4 text-slate-500 text-xs">{fmtData(e.createdAt)}</td>
                    <td className="py-2.5 px-4 flex items-center gap-2">
                      {e.url && (
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-[#eef2f8] text-[#C9A227] hover:text-[#032650] transition-colors" title="Abrir">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        type="button"
                        disabled={removendo === e.id}
                        onClick={() => handleDelete(e.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40"
                        title="Remover"
                      >
                        {removendo === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
