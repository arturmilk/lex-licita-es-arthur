"use client";
import React, { useEffect, useState } from "react";
import { ArrowLeft, Loader2, ExternalLink, Check, Trash2, AlertTriangle, Landmark, ListOrdered, FileSearch, Layers } from "lucide-react";
import { useRouter } from "next/navigation";
import { buscarPesquisa, apagarPesquisa } from "@/lib/actions";
import { useDialogos } from "@/components/Dialogos";
import { CabecalhoPagina, Secao, Situacao, AvisoErro } from "@/components/Pagina";
import { EsqueletoLista } from "@/components/Estados";

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

const METODO: Record<string, string> = {
  media_aritmetica: "Média aritmética",
  mediana: "Mediana",
  media_ponderada: "Média ponderada",
  menor_preco: "Menor preço",
};

const AVALIACAO: Record<string, { rotulo: string; classe: string }> = {
  aceito: { rotulo: "Aceita", classe: "pill-success" },
  rejeitado: { rotulo: "Rejeitada", classe: "pill-danger" },
};

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{rotulo}</dt>
      <dd className="mt-1 truncate text-sm font-medium text-ink-950">{children}</dd>
    </div>
  );
}

export default function PesquisaDetalhePage({ params }: { params: { id: string } }) {
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const { confirmar } = useDialogos();
  const router = useRouter();

  useEffect(() => {
    buscarPesquisa(params.id)
      .then(setDados)
      .catch((e) => setErro(String(e?.message || e)));
  }, [params.id]);

  async function apagar() {
    const ok = await confirmar({
      titulo: "Apagar pesquisa?",
      mensagem: "Os resultados vinculados também serão removidos. Esta ação não pode ser desfeita.",
      confirmar: "Apagar pesquisa",
      perigoso: true,
    });
    if (!ok) return;
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

  const nomeItem = (itemId?: string | null) =>
    (dados?.itens || []).find((i: any) => i.id === itemId)?.descricao || (itemId === "global" ? "Objeto (global)" : "—");

  return (
    <div>
      <button onClick={() => history.back()} className="btn btn-ghost btn-sm -ml-3 mb-3 min-h-[44px]">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Voltar
      </button>

      <CabecalhoPagina
        sobretitulo={dados?.processoNumero ? <>Pesquisa de preços · Processo <span className="font-mono normal-case tracking-normal">{dados.processoNumero}</span></> : "Pesquisa de preços"}
        titulo={<span className="line-clamp-2">{dados?.objeto || "Carregando pesquisa…"}</span>}
        acoes={
          <button onClick={apagar} disabled={apagando || !dados} className="btn btn-danger">
            {apagando ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Trash2 size={15} aria-hidden />}
            {apagando ? "Apagando…" : "Apagar pesquisa"}
          </button>
        }
      />

      {erro && <AvisoErro>Não foi possível abrir a pesquisa. {erro}</AvisoErro>}

      {!dados && !erro && (
        <div className="card overflow-hidden">
          <EsqueletoLista linhas={5} />
        </div>
      )}

      {dados && (
        <div className="space-y-6">
          {/* Resumo + preço */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <Secao titulo="Dados da pesquisa" icone={FileSearch} corpoClassName="p-5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
                <Dado rotulo="Processo"><span className="protocolo">{dados.processoNumero || "—"}</span></Dado>
                <Dado rotulo="Unidade">{dados.processoUnidade || "—"}</Dado>
                <Dado rotulo="Quantidade">{dados.quantidade} {dados.unidadeMedida}</Dado>
                <Dado rotulo="Método">{METODO[dados.metodoCalculo] || String(dados.metodoCalculo || "—").replace(/_/g, " ")}</Dado>
                <Dado rotulo="Parcelamento"><span className="capitalize">{dados.formaParcelamento || "—"}</span></Dado>
                <Dado rotulo="Local de entrega">{dados.localEntrega || "—"}</Dado>
                <Dado rotulo="Limite de CV">{dados.cvLimite ?? 20}%</Dado>
                <Dado rotulo="Período">{dados.premissas?.periodoPesquisa || "—"}</Dado>
              </dl>
            </Secao>

            <section className="rounded-xl border border-ink-900 bg-ink-900 p-5 text-white shadow-raise" aria-labelledby="preco-titulo">
              <div className="flex items-center justify-between gap-3">
                <h2 id="preco-titulo" className="text-[13px] font-medium text-white/70">Preço estimado</h2>
                <Landmark size={16} className="text-gold-400" aria-hidden />
              </div>
              <p className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white">{fmt(dados.precoTotalEstimado)}</p>
              <p className="mt-2 text-xs text-white/60">valor total</p>
              <div className="mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
                <div>
                  <p className="text-xs text-white/60">Unitário</p>
                  <p className="mt-0.5 font-mono text-[15px] font-medium text-white">{fmt(dados.precoUnitarioEstimado)}</p>
                </div>
                <Situacao status={dados.status} />
              </div>
            </section>
          </div>

          {(dados.justificativa || dados.meEpp?.aplicar || dados.premissas?.alertaCv) && (
            <Secao titulo="Fundamentação" descricao="Justificativa e observações que acompanham o valor estimado." corpoClassName="space-y-4 p-5">
              {dados.premissas?.alertaCv && (
                <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <p>
                    <b className="font-semibold">Alerta de coeficiente de variação:</b> dispersão de {Number(dados.premissas.alertaCv.cv).toFixed(1).replace(".", ",")}%
                    ultrapassou o limite ({dados.premissas.alertaCv.limite}%) — foi aplicado o menor preço.
                  </p>
                </div>
              )}
              {dados.meEpp?.aplicar && (
                <div className="rounded-lg border border-ink-100 bg-ink-50 px-4 py-3 text-sm text-ink-800">
                  <b className="font-semibold">ME/EPP (LC 123/2006):</b>{" "}
                  {dados.meEpp.tipo === "exclusividade" ? "exclusividade" : "reserva de 25%"} —{" "}
                  {fmtMoeda(dados.meEpp.valorReservado)} reservados · base legal: {dados.meEpp.baseLegal || "LC 123/2006, art. 48"}
                </div>
              )}
              {dados.justificativa && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Justificativa (gerada com IA)</p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{dados.justificativa}</p>
                </div>
              )}
            </Secao>
          )}

          {(dados.itens || []).length > 0 && (
            <Secao titulo={`Itens e lotes da contratação (${dados.itens.length})`} icone={ListOrdered}>
              <div className="scroll-fino overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Descrição</th>
                      <th>Especificação</th>
                      <th className="text-right">Qtd.</th>
                      <th>Un.</th>
                      <th>Item do edital</th>
                      <th>Obrigatório</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dados.itens || []).map((i: any, idx: number) => (
                      <tr key={i.id}>
                        <td className="font-mono text-[13px] text-slate-500">{idx + 1}</td>
                        <td className="font-medium text-ink-950">{i.descricao}</td>
                        <td className="max-w-[280px] text-[13px] text-slate-600">{i.especificacao || "—"}</td>
                        <td className="text-right tabular-nums">{i.quantidade}</td>
                        <td className="text-[13px]">{i.unidadeMedida || "un"}</td>
                        <td>
                          {i.itemEdital ? (
                            <a href={`https://pncp.gov.br/app/editais?q=${encodeURIComponent(i.itemEdital)}`} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 whitespace-nowrap text-[13px]">
                              {i.itemEdital} <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="text-[13px]">{i.obrigatorio ? "Sim" : "Não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Secao>
          )}

          {(dados.decomposicaoCustos || []).length > 0 && (
            <Secao titulo={`Decomposição de custos (${dados.decomposicaoCustos.length})`} icone={Layers} corpoClassName="space-y-3 p-5">
              {(dados.decomposicaoCustos || []).map((c: any) => (
                <div key={c.id} className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
                  <p className="mb-2 text-sm font-semibold text-ink-950">
                    {nomeItem(c.itemId) === "—" ? "Objeto (global)" : nomeItem(c.itemId)}
                    {c.nome ? ` — ${c.nome}` : ""}
                  </p>
                  <ul className="space-y-1.5 text-[13px] text-slate-600">
                    {(c.custos || []).map((x: any) => (
                      <li key={x.id} className="flex gap-2">
                        <Check size={14} className="mt-0.5 shrink-0 text-green-700" aria-hidden />
                        <span><b className="font-semibold text-slate-800">{x.tipo}:</b> {x.descricao}
                          {x.custoUnitario != null ? ` · ${fmtMoeda(x.custoUnitario)}` : ""}
                          {x.percentual != null ? ` · ${x.percentual}%` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Secao>
          )}

          <Secao titulo={`Referências de preço (${dados.resultados?.length || 0})`} descricao="Preços coletados nas fontes, com a avaliação de cada um.">
            {(dados.resultados || []).length === 0 ? (
              <p className="px-5 py-8 text-center text-[13px] text-slate-500">Nenhuma referência registrada nesta pesquisa.</p>
            ) : (
              <div className="scroll-fino overflow-x-auto">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Órgão</th>
                      <th>Item</th>
                      <th>Descrição</th>
                      <th className="text-right">Qtd.</th>
                      <th>Data</th>
                      <th className="text-right">Valor unit.</th>
                      <th>Local</th>
                      <th className="text-right">Similar.</th>
                      <th>CNPJ</th>
                      <th>Edital</th>
                      <th>Avaliação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dados.resultados || []).map((r: ResultadoRow) => (
                      <tr key={r.id}>
                        <td className="max-w-[180px] truncate text-[13px]" title={r.orgao}>{r.orgao}</td>
                        <td className="max-w-[160px] truncate text-[13px] text-slate-500">{nomeItem(r.itemId)}</td>
                        <td className="max-w-[220px] truncate" title={r.descricao}>{r.descricao}</td>
                        <td className="text-right tabular-nums">{r.quantidade ?? "—"}</td>
                        <td className="whitespace-nowrap text-[13px] text-slate-500">{r.dataContrato || "—"}</td>
                        <td className="text-right"><span className="valor">{fmt(r.valorUnitario)}</span></td>
                        <td className="text-[13px]">{r.localizacao || "—"}</td>
                        <td className="text-right tabular-nums">{r.similaridade != null ? `${r.similaridade}%` : "—"}</td>
                        <td className="whitespace-nowrap font-mono text-xs text-slate-500">{r.cnpj || "—"}</td>
                        <td>
                          {r.linkEdital ? (
                            <a href={r.linkEdital} target="_blank" rel="noopener noreferrer" className="link inline-flex items-center gap-1 whitespace-nowrap text-[13px]">
                              Ver <ExternalLink className="h-3 w-3" aria-hidden />
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td>
                          <span className={`pill ${AVALIACAO[r.avaliacao]?.classe || "pill-neutral"}`} title={r.justificativaRejeicao || undefined}>
                            {AVALIACAO[r.avaliacao]?.rotulo || "Pendente"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Secao>
        </div>
      )}
    </div>
  );
}
