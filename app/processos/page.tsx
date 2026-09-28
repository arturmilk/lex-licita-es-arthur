"use client";
import React, { useEffect, useState } from "react";
import { Loader2, FileText, Plus, ChevronRight, Trash2 } from "lucide-react";
import { EsqueletoLista, EstadoVazio } from "@/components/Estados";
import { CabecalhoPagina, Situacao, AvisoErro } from "@/components/Pagina";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { listarProcessos, apagarProcesso } from "@/lib/actions";
import { useDialogos } from "@/components/Dialogos";

interface ProcessoRow {
  id: string;
  numero: string;
  objeto: string;
  unidade: string | null;
  status: string;
  updatedAt: Date | string;
}

const fmtData = (d: Date | string) => new Date(d).toLocaleDateString("pt-BR");

export default function ProcessosPage() {
  const [rows, setRows] = useState<ProcessoRow[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const dentroHistoricos = usePathname() === "/historicos";
  const { confirmar } = useDialogos();

  useEffect(() => {
    listarProcessos()
      .then((r) => setRows(r as unknown as ProcessoRow[]))
      .catch((e) => setErro(String(e?.message || e)));
  }, []);

  async function apagar(id: string) {
    const ok = await confirmar({
      titulo: "Apagar processo?",
      mensagem: "Todas as tarefas, minutas, julgados, pesquisas e conversas vinculadas serão removidas. Esta ação não pode ser desfeita.",
      confirmar: "Apagar processo",
      perigoso: true,
    });
    if (!ok) return;
    setApagando(id);
    try {
      await apagarProcesso(id);
      setRows(await listarProcessos() as unknown as ProcessoRow[]);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setApagando(null);
    }
  }

  const contar = (s: string) => rows?.filter((r) => r.status === s).length ?? 0;

  const BotaoExcluir = ({ r }: { r: ProcessoRow }) => (
    <button
      onClick={() => apagar(r.id)}
      disabled={apagando === r.id}
      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
      title="Apagar processo"
      aria-label={`Apagar processo ${r.numero}`}
    >
      {apagando === r.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  );

  return (
    <div>
      <CabecalhoPagina
        nivel={dentroHistoricos ? 2 : 1}
        titulo="Processos"
        descricao="Processos licitatórios vinculados ao órgão."
        acoes={
          !dentroHistoricos && (
            <Link href="/pesquisa/nova" className="btn btn-primary">
              <Plus size={16} aria-hidden /> Nova pesquisa de preço
            </Link>
          )
        }
      />

      {erro && <AvisoErro>{erro}</AvisoErro>}

      {/* Resumo em uma linha — a lista é o que importa aqui */}
      {rows && rows.length > 0 && (
        <p className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
          <span><b className="font-semibold text-ink-950">{rows.length}</b> no órgão</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span><b className="font-semibold text-ink-950">{contar("rascunho")}</b> em rascunho</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span><b className="font-semibold text-ink-950">{contar("pesquisando")}</b> pesquisando</span>
          <span aria-hidden className="text-slate-300">·</span>
          <span><b className="font-semibold text-ink-950">{contar("concluido")}</b> concluídos</span>
        </p>
      )}

      <div className="card overflow-hidden">
        {rows === null ? (
          <EsqueletoLista />
        ) : rows.length === 0 ? (
          <EstadoVazio
            icone={FileText}
            titulo="Nenhum processo por aqui"
            descricao="Os processos aparecem automaticamente quando você inicia uma pesquisa de preços."
            href="/pesquisa/nova"
            acao="Iniciar pesquisa"
          />
        ) : (
          <>
            {/* Celular: cartões empilhados */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((r) => (
                <li key={r.id} className="px-4 py-4">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="protocolo">{r.numero}</span>
                    <Situacao status={r.status} />
                  </div>
                  <p className="text-sm font-medium text-ink-950">{r.objeto}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[13px] text-slate-500">{r.unidade || "—"} · {fmtData(r.updatedAt)}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Link href={`/processos/${r.id}/jornada`} className="btn btn-outline btn-sm min-h-[44px]">
                        Abrir <ChevronRight size={14} aria-hidden />
                      </Link>
                      <BotaoExcluir r={r} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {/* Computador: tabela */}
            <div className="scroll-fino hidden overflow-x-auto md:block">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Objeto</th>
                    <th>Unidade</th>
                    <th>Situação</th>
                    <th>Atualizado</th>
                    <th><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td><span className="protocolo">{r.numero}</span></td>
                      <td className="max-w-[360px] truncate font-medium text-ink-950" title={r.objeto}>{r.objeto}</td>
                      <td className="text-[13px] text-slate-500">{r.unidade || "—"}</td>
                      <td><Situacao status={r.status} /></td>
                      <td className="whitespace-nowrap text-[13px] text-slate-500">{fmtData(r.updatedAt)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/processos/${r.id}/jornada`} className="btn btn-outline btn-sm">
                            Abrir processo <ChevronRight size={14} aria-hidden />
                          </Link>
                          <BotaoExcluir r={r} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
