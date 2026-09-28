"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileSearch, Hourglass, CheckCircle2, Landmark, Search } from "lucide-react";
import { EsqueletoLista, EstadoVazio } from "@/components/Estados";
import { CabecalhoPagina, Indicador, Secao, Situacao, AvisoErro } from "@/components/Pagina";
import { listarDashboard } from "@/lib/actions";

type DashData = Awaited<ReturnType<typeof listarDashboard>>;

function fmtMoeda(v: number) {
  if (v === 0) return "—";
  return v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")} mi`
    : `R$ ${(v / 1_000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} mil`;
}

function fmtData(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashData | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    listarDashboard()
      .then(setData)
      .catch(e => setErro(String(e?.message || e)));
  }, []);

  const carregando = !data && !erro;

  return (
    <div>
      <CabecalhoPagina
        titulo="Indicadores"
        descricao={
          <>
            Visão consolidada das pesquisas do órgão, para acompanhamento da gestão. Suas tarefas do dia ficam em{" "}
            <Link href="/painel" className="link">Meu dia</Link>.
          </>
        }
        acoes={
          <Link href="/pesquisas" className="btn btn-outline">
            Ver pesquisas <ArrowRight size={15} aria-hidden />
          </Link>
        }
      />

      {erro && <AvisoErro>Não foi possível carregar os indicadores. {erro}</AvisoErro>}

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicador destaque rotulo="Total de pesquisas" valor={data?.total ?? 0} nota="realizadas pelo órgão" icone={FileSearch} carregando={carregando} />
        <Indicador rotulo="Em andamento" valor={data?.emAndamento ?? 0} nota="pesquisas ativas" icone={Hourglass} carregando={carregando} />
        <Indicador rotulo="Concluídas" valor={data?.concluidas ?? 0} nota="com relatório final" icone={CheckCircle2} carregando={carregando} />
        <Indicador rotulo="Valor total estimado" valor={data ? fmtMoeda(data.valorTotal) : "—"} nota="somado nas contratações" icone={Landmark} carregando={carregando} />
      </div>

      <Secao
        titulo="Pesquisas recentes"
        descricao="As últimas pesquisas de preços do órgão."
        acoes={
          <Link href="/pesquisas" className="btn btn-ghost btn-sm">
            Ver todas <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        {!data ? (
          <EsqueletoLista linhas={5} />
        ) : data.pesquisasRecentes.length === 0 ? (
          <EstadoVazio
            icone={Search}
            titulo="Nenhuma pesquisa realizada ainda"
            descricao="Quando a primeira pesquisa for iniciada, os números e a lista aparecem aqui."
            href="/pesquisa/nova"
            acao="Iniciar primeira pesquisa"
          />
        ) : (
          <div className="scroll-fino overflow-x-auto">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Processo</th>
                  <th>Objeto</th>
                  <th>Situação</th>
                  <th className="text-right">Valor estimado</th>
                  <th>Data</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                {data.pesquisasRecentes.map(a => {
                  const valor = a.precoTotalEstimado
                    ? `R$ ${Number(a.precoTotalEstimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                    : "—";
                  return (
                    <tr key={a.id}>
                      <td><span className="protocolo">{a.processoNumero || "—"}</span></td>
                      <td className="max-w-[280px] truncate text-ink-950" title={a.objeto}>{a.objeto}</td>
                      <td><Situacao status={a.status} /></td>
                      <td className="text-right"><span className="valor">{valor}</span></td>
                      <td className="whitespace-nowrap text-[13px] text-slate-500">{fmtData(a.createdAt)}</td>
                      <td className="text-[13px] text-slate-600">{a.usuarioNome || "—"}</td>
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
