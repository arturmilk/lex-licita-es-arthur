"use client";
import React, { useEffect, useState } from "react";
import { Search, Loader2, Plus, Trash2, ChevronRight } from "lucide-react";
import { EsqueletoLista, EstadoVazio } from "@/components/Estados";
import { CabecalhoPagina, Situacao, AvisoErro } from "@/components/Pagina";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { listarPesquisas, apagarPesquisa } from "@/lib/actions";
import { useDialogos } from "@/components/Dialogos";

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
  const [apagando, setApagando] = useState<string | null>(null);
  const dentroHistoricos = usePathname() === "/historicos";
  const { confirmar } = useDialogos();

  useEffect(() => {
    listarPesquisas()
      .then((r) => setRows(r as unknown as PesquisaRow[]))
      .catch((e) => setErro(String(e?.message || e)));
  }, []);

  async function apagar(id: string) {
    const ok = await confirmar({
      titulo: "Apagar pesquisa?",
      mensagem: "Os resultados vinculados também serão removidos. Esta ação não pode ser desfeita.",
      confirmar: "Apagar pesquisa",
      perigoso: true,
    });
    if (!ok) return;
    setApagando(id);
    try {
      await apagarPesquisa(id);
      setRows(await listarPesquisas() as unknown as PesquisaRow[]);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setApagando(null);
    }
  }

  const fmt = (v: string | null) =>
    v == null ? "—" : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  const fmtData = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR");

  const concluidas = rows?.filter(r => r.status === "concluida").length ?? 0;
  const emAndamento = rows?.filter(r => r.status === "em_andamento").length ?? 0;
  const refs = rows?.reduce((s, r) => s + (r.referenciasAceitas || 0), 0) ?? 0;

  return (
    <div>
      <CabecalhoPagina
        nivel={dentroHistoricos ? 2 : 1}
        titulo="Pesquisas de preços"
        descricao="Todas as pesquisas realizadas, com valor estimado e referências aceitas."
        acoes={
          !dentroHistoricos && (
            <Link href="/pesquisa/nova" className="btn btn-primary">
              <Plus size={16} aria-hidden /> Nova pesquisa de preço
            </Link>
          )
        }
      />

      {erro && <AvisoErro>{erro}</AvisoErro>}

      {rows !== null && rows.length > 0 && (
        <p className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
          <span><b className="font-semibold text-ink-950">{rows.length}</b> realizadas</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span><b className="font-semibold text-ink-950">{emAndamento}</b> em andamento</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span><b className="font-semibold text-ink-950">{concluidas}</b> concluídas</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span><b className="font-semibold text-ink-950">{refs}</b> referências aceitas</span>
        </p>
      )}

      <div className="card overflow-hidden">
        {rows === null ? (
          <EsqueletoLista />
        ) : rows.length === 0 ? (
          <EstadoVazio
            icone={Search}
            titulo="Nenhuma pesquisa realizada"
            descricao="Faça a primeira pesquisa de preços e ela aparece aqui, com o valor estimado e as referências aceitas."
            href="/pesquisa/nova"
            acao="Iniciar pesquisa"
          />
        ) : (
          <div className="scroll-fino overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Processo</th>
                  <th>Objeto</th>
                  <th className="text-center">Refs. aceitas</th>
                  <th className="text-right">Preço estimado</th>
                  <th>Situação</th>
                  <th>Data</th>
                  <th><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className="protocolo">{r.processoNumero || "—"}</span></td>
                    <td className="max-w-[300px] truncate font-medium text-ink-950" title={r.objeto}>{r.objeto}</td>
                    <td className="text-center">
                      <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-semibold text-slate-700">{r.referenciasAceitas}</span>
                    </td>
                    <td className="text-right"><span className="valor">{fmt(r.precoTotalEstimado)}</span></td>
                    <td><Situacao status={r.status} /></td>
                    <td className="whitespace-nowrap text-[13px] text-slate-500">{fmtData(r.createdAt)}</td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/pesquisas/${r.id}`} className="btn btn-outline btn-sm">
                          Abrir <ChevronRight size={14} aria-hidden />
                        </Link>
                        <button
                          onClick={() => apagar(r.id)}
                          disabled={apagando === r.id}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Excluir pesquisa e resultados vinculados"
                          aria-label="Excluir pesquisa"
                        >
                          {apagando === r.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
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
