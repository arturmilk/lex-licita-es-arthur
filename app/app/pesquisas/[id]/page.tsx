"use client";
import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { buscarPesquisa } from "@/lib/actions";

interface ResultadoRow {
  id: string;
  orgao: string;
  descricao: string;
  quantidade: number | null;
  dataContrato: string | null;
  valorUnitario: string | null;
  valorTotal: string | null;
  localizacao: string | null;
  similaridade: number | null;
  documentoOrigem: string | null;
  linkEdital: string | null;
  avaliacao: string;
  justificativaRejeicao: string | null;
}

export default function PesquisaDetalhePage({ params }: { params: { id: string } }) {
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    buscarPesquisa(params.id)
      .then(setDados)
      .catch((e) => setErro(String(e?.message || e)));
  }, [params.id]);

  const fmt = (v: string | null | number | undefined) =>
    v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <button onClick={() => history.back()} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Pesquisa: {params.id.slice(0, 8)}</h1>
      </div>
      {erro && <p className="text-sm text-red-600 mb-3">Erro: {erro}</p>}
      {!dados && !erro && (
        <div className="flex items-center justify-center py-16 gap-2 text-neutral-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Carregando...
        </div>
      )}
      {dados && (
        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-neutral-500 uppercase">Processo</p><p className="font-medium">{dados.processoNumero}</p></div>
              <div><p className="text-xs text-neutral-500 uppercase">Unidade</p><p className="font-medium">{dados.processoUnidade || "—"}</p></div>
              <div><p className="text-xs text-neutral-500 uppercase">Quantidade</p><p className="font-medium">{dados.quantidade} {dados.unidadeMedida}</p></div>
              <div><p className="text-xs text-neutral-500 uppercase">Metodo</p><p className="font-medium">{String(dados.metodoCalculo || "").replace("_", " ")}</p></div>
            </div>
            <p className="mt-4 text-sm text-neutral-700">{dados.objeto}</p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold mb-3">Preco estimado</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><p className="text-xs text-neutral-500 uppercase">Unitario</p><p className="text-lg font-semibold">{fmt(dados.precoUnitarioEstimado)}</p></div>
              <div><p className="text-xs text-neutral-500 uppercase">Total</p><p className="text-lg font-semibold">{fmt(dados.precoTotalEstimado)}</p></div>
              <div><p className="text-xs text-neutral-500 uppercase">Status</p><p className="font-medium">{dados.status}</p></div>
            </div>
            {dados.justificativa && (
              <div className="mt-4 rounded-lg bg-neutral-50 border border-neutral-200 p-4 text-sm text-neutral-700 whitespace-pre-wrap">
                <strong className="block mb-2 text-neutral-800">Justificativa (IA):</strong>
                {dados.justificativa}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold mb-3">Referencias ({dados.resultados?.length || 0})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Orgao</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Descricao</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Qtd</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Data</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Valor unit.</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Local</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Sim.</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Avaliacao</th>
                </tr></thead>
                <tbody>
                  {(dados.resultados || []).map((r: ResultadoRow) => (
                    <tr key={r.id} className="border-b border-neutral-100">
                      <td className="py-2 px-3">{r.orgao}</td>
                      <td className="py-2 px-3 max-w-[220px] truncate" title={r.descricao}>{r.descricao}</td>
                      <td className="py-2 px-3">{r.quantidade ?? "—"}</td>
                      <td className="py-2 px-3">{r.dataContrato || "—"}</td>
                      <td className="py-2 px-3">{fmt(r.valorUnitario)}</td>
                      <td className="py-2 px-3">{r.localizacao || "—"}</td>
                      <td className="py-2 px-3">{r.similaridade ?? "—"}%</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${r.avaliacao === "aceito" ? "bg-green-100 text-green-700" : r.avaliacao === "rejeitado" ? "bg-red-100 text-red-700" : "bg-neutral-100 text-neutral-600"}`}>{r.avaliacao}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
