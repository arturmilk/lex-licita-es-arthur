"use client";
import React, { useEffect, useState } from "react";
import { FileText, Table2, Loader2, ExternalLink, Download } from "lucide-react";
import { EsqueletoLista, EstadoVazio } from "@/components/Estados";
import { CabecalhoPagina, Secao, AvisoErro } from "@/components/Pagina";
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
      <CabecalhoPagina
        titulo="Relatórios"
        descricao="Baixe em PDF ou planilha (XLSX) o relatório de cada pesquisa concluída, com a memória de cálculo."
      />

      {erro && <AvisoErro>Não foi possível carregar os relatórios. {erro}</AvisoErro>}

      <Secao titulo="Pesquisas concluídas" descricao="Um relatório por pesquisa, pronto para juntar ao processo.">
        {rows === null ? (
          <EsqueletoLista />
        ) : concluidas.length === 0 ? (
          <EstadoVazio
            icone={FileText}
            titulo="Nenhuma pesquisa concluída ainda"
            descricao="Relatórios em PDF e XLSX são gerados a partir de pesquisas concluídas. Conclua uma pesquisa para vê-los aqui."
            href="/pesquisa/nova"
            acao="Ir para Nova pesquisa"
          />
        ) : (
          <div className="scroll-fino overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Processo</th>
                  <th>Objeto</th>
                  <th className="text-right">Valor estimado</th>
                  <th className="text-center">Refs. aceitas</th>
                  <th>Concluída em</th>
                  <th>Baixar</th>
                </tr>
              </thead>
              <tbody>
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
                    <tr key={r.id}>
                      <td><span className="protocolo">{r.processoNumero || "—"}</span></td>
                      <td className="max-w-[280px] truncate font-medium text-ink-950" title={r.objeto}>{r.objeto}</td>
                      <td className="text-right"><span className="valor">{fmtMoeda(r.precoTotalEstimado)}</span></td>
                      <td className="text-center">{r.referenciasAceitas}</td>
                      <td className="whitespace-nowrap text-[13px] text-slate-500">{fmtData(r.createdAt)}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <PDFDownloadLink
                            document={<RelatorioPDFDocument {...relData} />}
                            fileName={`${nomeArquivo}.pdf`}
                            className="btn btn-outline btn-sm min-h-[44px]"
                          >
                            <FileText className="h-4 w-4 text-ink-700" aria-hidden /> PDF
                          </PDFDownloadLink>
                          <button
                            type="button"
                            onClick={() => { const b = gerarXLSX(relData); downloadXLSX(b, `${nomeArquivo}.xlsx`); }}
                            className="btn btn-outline btn-sm min-h-[44px]"
                          >
                            <Table2 className="h-4 w-4 text-ink-700" aria-hidden /> XLSX
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}
