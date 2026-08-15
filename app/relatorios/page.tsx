"use client";
import React, { useEffect, useState } from "react";
import { FileText, Table2, Loader2, ExternalLink, Download } from "lucide-react";
import { listarPesquisas } from "@/lib/actions";
import { gerarXLSX, downloadXLSX } from "@/lib/xlsx-generator";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPDFDocument } from "@/lib/pdf-generator";

type Row = Awaited<ReturnType<typeof listarPesquisas>>[number];

function fmtData(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtMoeda(v: string | null) {
  if (!v) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function RelatoriosPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarPesquisas()
      .then(r => setRows(r as unknown as Row[]))
      .catch(e => setErro(String(e?.message || e)));
  }, []);

  const concluidas = rows?.filter(r => r.status === "concluida") ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-slate-800">Relatórios</h1>
      </div>

      {erro && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Erro: {erro}</div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-sm text-slate-500">
            Relatórios gerados a partir de pesquisas concluídas. Baixe em PDF ou XLSX.
          </p>
        </div>

        {rows === null ? (
          <div className="flex items-center justify-center py-16 gap-2 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
          </div>
        ) : concluidas.length === 0 ? (
          <div className="py-16 text-center text-sm text-slate-400">
            Nenhuma pesquisa concluída ainda. Conclua uma pesquisa no wizard para gerar relatórios.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {["Processo", "Objeto", "Valor estimado", "Refs. aceitas", "Concluída em", "Exportar"].map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {concluidas.map(r => {
                  const nomeArquivo = `estimativa_${(r.processoNumero || r.id.slice(0, 8)).replace(/\//g, "_")}`;
                  const stats = (r.estatisticas as any) || null;
                  const relData = {
                    processo: { numero: r.processoNumero || "", orgao: "", unidade: "", responsavel: "", email: "" },
                    objeto: r.objeto,
                    quantidade: r.quantidade,
                    metodo: "media_aritmetica" as const,
                    estatisticas: stats || { n: 0, media: 0, mediana: 0, minimo: 0, maximo: 0, desvioPadrao: 0, coeficienteVariacao: 0 },
                    precoUnitario: r.precoUnitarioEstimado ? Number(r.precoUnitarioEstimado) : 0,
                    precoTotal: r.precoTotalEstimado ? Number(r.precoTotalEstimado) : 0,
                    justificativa: "",
                    referencias: [],
                    responsavel: "",
                    email: "",
                    linksEvidencias: [],
                  };

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600">{r.processoNumero || "—"}</td>
                      <td className="py-2.5 px-4 max-w-[280px] truncate" title={r.objeto}>{r.objeto}</td>
                      <td className="py-2.5 px-4 font-mono text-xs">{fmtMoeda(r.precoTotalEstimado)}</td>
                      <td className="py-2.5 px-4">{r.referenciasAceitas}</td>
                      <td className="py-2.5 px-4 text-slate-500 text-xs">{fmtData(r.createdAt)}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => { const b = gerarXLSX(relData); downloadXLSX(b, `${nomeArquivo}.xlsx`); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Table2 className="w-3.5 h-3.5 text-green-600" /> XLSX
                          </button>
                          <PDFDownloadLink
                            document={<RelatorioPDFDocument {...relData} />}
                            fileName={`${nomeArquivo}.pdf`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5 text-red-500" /> PDF
                          </PDFDownloadLink>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
