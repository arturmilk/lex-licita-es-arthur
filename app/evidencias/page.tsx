"use client";
import React, { useEffect, useState } from "react";
import { FileImage, FileText, FileSpreadsheet, Link2, Trash2, ExternalLink, Loader2, FolderOpen } from "lucide-react";
import { EsqueletoLista, EstadoVazio } from "@/components/Estados";
import { CabecalhoPagina, Secao, AvisoErro } from "@/components/Pagina";
import { listarEvidenciasOrg, removerEvidencia } from "@/lib/actions";
import { useDialogos } from "@/components/Dialogos";

type Ev = Awaited<ReturnType<typeof listarEvidenciasOrg>>[number];

const TIPO: Record<string, { icone: React.ElementType; rotulo: string }> = {
  imagem: { icone: FileImage, rotulo: "Imagem" },
  pdf: { icone: FileText, rotulo: "PDF" },
  xlsx: { icone: FileSpreadsheet, rotulo: "Planilha" },
  link: { icone: Link2, rotulo: "Link" },
};

function TipoIcon({ tipo }: { tipo: string }) {
  const Icone = TIPO[tipo]?.icone || FileText;
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-50 text-ink-700" aria-hidden>
      <Icone className="h-4 w-4" />
    </span>
  );
}

function fmtData(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function EvidenciasPage() {
  const [evidencias, setEvidencias] = useState<Ev[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const { confirmar, avisar } = useDialogos();

  const carregar = () => {
    listarEvidenciasOrg()
      .then(setEvidencias)
      .catch(e => setErro(String(e?.message || e)));
  };

  useEffect(carregar, []);

  const handleDelete = async (id: string) => {
    const ok = await confirmar({
      titulo: "Remover evidência?",
      mensagem: "A evidência será removida deste processo. Esta ação não pode ser desfeita.",
      confirmar: "Remover",
      perigoso: true,
    });
    if (!ok) return;
    setRemovendo(id);
    try {
      await removerEvidencia(id);
      setEvidencias(prev => prev?.filter(e => e.id !== id) ?? null);
    } catch (e: any) {
      await avisar("Não foi possível remover a evidência: " + (e?.message || e), "Não deu certo");
    } finally {
      setRemovendo(null);
    }
  };

  const comLink = evidencias?.filter(e => e.url) ?? [];

  return (
    <div>
      <CabecalhoPagina
        titulo="Evidências"
        descricao="Documentos e links que comprovam de onde vieram os preços usados nas pesquisas."
      />

      {erro && <AvisoErro>Não foi possível carregar as evidências. {erro}</AvisoErro>}

      <div className="space-y-6">
        {/* Links das referências aceitas */}
        <Secao
          titulo="Links das referências aceitas"
          descricao="Vinculados automaticamente quando você aceita um preço na pesquisa."
          icone={Link2}
        >
          {evidencias === null ? (
            <EsqueletoLista linhas={3} />
          ) : comLink.length === 0 ? (
            <EstadoVazio compacto semAcao titulo="Nenhum link vinculado ainda" descricao="Os links entram aqui automaticamente quando você aceita referências da pesquisa." />
          ) : (
            <div className="scroll-fino overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Processo</th>
                    <th>Pesquisa</th>
                    <th><span className="sr-only">Abrir</span></th>
                  </tr>
                </thead>
                <tbody>
                  {comLink.map(e => (
                    <tr key={e.id}>
                      <td className="max-w-[280px] truncate text-ink-950" title={e.nome}>{e.nome}</td>
                      <td><span className="protocolo">{e.processoNumero || "—"}</span></td>
                      <td className="max-w-[240px] truncate text-slate-600" title={e.pesquisaObjeto}>{e.pesquisaObjeto}</td>
                      <td className="text-right">
                        <a href={e.url!} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm min-h-[44px]">
                          Abrir <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Secao>

        {/* Todos os documentos */}
        <Secao titulo="Todos os documentos" descricao="Arquivos anexados e comprovantes gerados nas pesquisas." icone={FolderOpen}>
          {evidencias === null ? (
            <EsqueletoLista />
          ) : evidencias.length === 0 ? (
            <EstadoVazio
              icone={FileText}
              titulo="Nenhuma evidência registrada"
              descricao="Conclua uma pesquisa (ou envie um arquivo) para as evidências aparecerem aqui."
              href="/pesquisa/nova"
              acao="Ir para Nova pesquisa"
            />
          ) : (
            <div className="scroll-fino overflow-x-auto">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Documento</th>
                    <th>Processo</th>
                    <th>Pesquisa</th>
                    <th>Tipo</th>
                    <th>Origem</th>
                    <th>Data</th>
                    <th><span className="sr-only">Ações</span></th>
                  </tr>
                </thead>
                <tbody>
                  {evidencias.map(e => (
                    <tr key={e.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <TipoIcon tipo={e.tipo} />
                          <span className="max-w-[240px] truncate text-ink-950" title={e.nome}>{e.nome}</span>
                        </div>
                      </td>
                      <td><span className="protocolo">{e.processoNumero || "—"}</span></td>
                      <td className="max-w-[200px] truncate text-slate-600" title={e.pesquisaObjeto}>{e.pesquisaObjeto}</td>
                      <td><span className="pill pill-neutral">{TIPO[e.tipo]?.rotulo || e.tipo}</span></td>
                      <td className="text-[13px] capitalize text-slate-500">{e.origem}</td>
                      <td className="whitespace-nowrap text-[13px] text-slate-500">{fmtData(e.createdAt)}</td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          {e.url && (
                            <a
                              href={e.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-ink-50 hover:text-ink-900"
                              title="Abrir"
                              aria-label={`Abrir ${e.nome}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                          <button
                            type="button"
                            disabled={removendo === e.id}
                            onClick={() => handleDelete(e.id)}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            title="Remover"
                            aria-label={`Remover ${e.nome}`}
                          >
                            {removendo === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}
