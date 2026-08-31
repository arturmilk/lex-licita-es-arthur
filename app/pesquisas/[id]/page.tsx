"use client";
import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ExternalLink, Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { buscarPesquisa, apagarPesquisa } from "@/lib/actions";

function fmtMoeda(v: number | null | undefined) {
  if (v == null || isNaN(Number(v))) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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
  itemId?: string | null;
  cnpj?: string | null;
}

export default function PesquisaDetalhePage({ params }: { params: { id: string } }) {
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const router = useRouter();

  useEffect(() => {
    buscarPesquisa(params.id)
      .then(setDados)
      .catch((e) => setErro(String(e?.message || e)));
  }, [params.id]);

  async function apagar() {
    if (!window.confirm("Tem certeza que deseja apagar esta pesquisa? Os resultados vinculados também serão removidos. Esta ação não pode ser desfeita.")) return;
    setApagando(true);
    try {
      await apagarPesquisa(params.id);
      router.push("/pesquisas");
    } catch (e: any) {
      setErro(String(e?.message || e));
      setApagando(false);
    }
  }

  const fmt = (v: string | null | number | undefined) =>
    v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div>
      <button onClick={() => history.back()} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-4">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Pesquisa: {params.id.slice(0, 8)}</h1>
        <button
          onClick={apagar}
          disabled={apagando}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50 transition-colors"
        >
          {apagando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          {apagando ? "Apagando…" : "Apagar pesquisa"}
        </button>
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
              <div><p className="text-xs text-neutral-500 uppercase">Parcelamento</p><p className="font-medium">{dados.formaParcelamento || "—"}</p></div>
              <div><p className="text-xs text-neutral-500 uppercase">Local de entrega</p><p className="font-medium">{dados.localEntrega || "—"}</p></div>
              <div><p className="text-xs text-neutral-500 uppercase">Limite de CV</p><p className="font-medium">{dados.cvLimite ?? 20}%</p></div>
              <div><p className="text-xs text-neutral-500 uppercase">Período</p><p className="font-medium">{dados.premissas?.periodoPesquisa || "—"}</p></div>
            </div>
            <p className="mt-4 text-sm text-neutral-700">{dados.objeto}</p>
          </div>

          {(dados.itens || []).length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold mb-3">Itens / lotes da contratação ({dados.itens.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-200">
                    {["#", "Descrição", "Especificação", "Qtd", "Un.", "Item edital", "Obrigatório"].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(dados.itens || []).map((i: any, idx: number) => (
                      <tr key={i.id} className="border-b border-neutral-100">
                        <td className="py-2 px-3">{idx + 1}</td>
                        <td className="py-2 px-3 font-medium">{i.descricao}</td>
                        <td className="py-2 px-3 max-w-[280px] text-neutral-600">{i.especificacao || "—"}</td>
                        <td className="py-2 px-3">{i.quantidade}</td>
                        <td className="py-2 px-3">{i.unidadeMedida || "un"}</td>
                        <td className="py-2 px-3">
                          {i.itemEdital ? (
                            <a href={`https://pncp.gov.br/app/editais?q=${encodeURIComponent(i.itemEdital)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#032650] hover:text-[#042f5e] text-xs font-medium whitespace-nowrap">
                              {i.itemEdital} <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : <span className="text-xs text-neutral-400">—</span>}
                        </td>
                        <td className="py-2 px-3">{i.obrigatorio ? "Sim" : "Não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
            {dados.meEpp?.aplicar && (
              <div className="mt-4 rounded-lg bg-[#eef2f8] border border-[#d5dce8] p-4 text-sm text-[#042f5e]">
                <strong>ME/EPP (LC 123/2006):</strong>{" "}
                {dados.meEpp.tipo === "exclusividade" ? "exclusividade" : "reserva de 25%"} —{" "}
                {fmtMoeda(dados.meEpp.valorReservado)} reservados · base legal: {dados.meEpp.baseLegal || "LC 123/2006, art. 48"}
              </div>
            )}
            {dados.premissas?.alertaCv && (
              <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                <strong>Alerta de CV:</strong> dispersão de {Number(dados.premissas.alertaCv.cv).toFixed(1).replace(".", ",")}%
                ultrapassou o limite ({dados.premissas.alertaCv.limite}%) — foi aplicado o menor preço.
              </div>
            )}
          </div>

          {(dados.decomposicaoCustos || []).length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold mb-3">Decomposição de custos ({dados.decomposicaoCustos.length})</h2>
              {(dados.decomposicaoCustos || []).map((c: any) => (
                <div key={c.id} className="mb-4 rounded-lg bg-neutral-50 border border-neutral-200 p-4">
                  <p className="text-sm font-medium mb-2">
                    {(dados.itens || []).find((i: any) => i.id === c.itemId)?.descricao || "Objeto (global)"}
                    {c.nome ? ` — ${c.nome}` : ""}
                  </p>
                  <ul className="text-xs text-neutral-600 space-y-1">
                    {(c.custos || []).map((x: any) => (
                      <li key={x.id} className="flex gap-2">
                        <Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                        <span><strong>{x.tipo}:</strong> {x.descricao}
                          {x.custoUnitario != null ? ` · ${fmtMoeda(x.custoUnitario)}` : ""}
                          {x.percentual != null ? ` · ${x.percentual}%` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-semibold mb-3">Referencias ({dados.resultados?.length || 0})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-200">
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Orgao</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Item</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Descricao</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Qtd</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Data</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Valor unit.</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Local</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Sim.</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">CNPJ</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Edital</th>
                  <th className="text-left py-2 px-3 font-medium text-neutral-500 text-xs uppercase">Avaliacao</th>
                </tr></thead>
                <tbody>
                  {(dados.resultados || []).map((r: ResultadoRow) => (
                    <tr key={r.id} className="border-b border-neutral-100">
                      <td className="py-2 px-3">{r.orgao}</td>
                      <td className="py-2 px-3 text-xs text-neutral-500">
                        {(dados.itens || []).find((i: any) => i.id === r.itemId)?.descricao || (r.itemId === "global" ? "Objeto (global)" : "—")}
                      </td>
                      <td className="py-2 px-3 max-w-[220px] truncate" title={r.descricao}>{r.descricao}</td>
                      <td className="py-2 px-3">{r.quantidade ?? "—"}</td>
                      <td className="py-2 px-3">{r.dataContrato || "—"}</td>
                      <td className="py-2 px-3">{fmt(r.valorUnitario)}</td>
                      <td className="py-2 px-3">{r.localizacao || "—"}</td>
                      <td className="py-2 px-3">{r.similaridade ?? "—"}%</td>
                      <td className="py-2 px-3 text-xs font-mono text-neutral-500">{r.cnpj || "—"}</td>
                      <td className="py-2 px-3">
                        {r.linkEdital ? (
                          <a href={r.linkEdital} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#032650] hover:text-[#042f5e] text-xs font-medium whitespace-nowrap">
                            <ExternalLink className="w-3 h-3" /> Ver
                          </a>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>
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
