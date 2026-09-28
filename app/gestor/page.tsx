"use client";
import React, { useEffect, useState } from "react";
import { ListChecks, AlertTriangle, Users, Clock, Hourglass, TrendingUp } from "lucide-react";
import { EsqueletoLista, EstadoVazio } from "@/components/Estados";
import { CabecalhoPagina, Indicador, Secao, AvisoErro } from "@/components/Pagina";
import { obterPainelGestor } from "@/lib/actions-intencao";

function iniciais(nome: string) {
  return (nome || "S").trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export default function PainelGestorPage() {
  const [dados, setDados] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    obterPainelGestor().then(setDados).catch((e) => setErro(String(e?.message || e)));
  }, []);

  const carregando = !dados && !erro;
  const taxa = Math.max(0, Math.min(100, Number(dados?.taxaConclusao) || 0));

  return (
    <div>
      <CabecalhoPagina
        titulo="Painel do gestor"
        descricao="Gargalos, atrasos, carga de trabalho e produtividade da equipe — sem precisar cobrar por WhatsApp."
      />

      {erro && <AvisoErro>Não foi possível carregar o painel. {erro}</AvisoErro>}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador destaque rotulo="Total de tarefas" valor={dados?.totalTarefas ?? 0} nota="em processos do órgão" icone={ListChecks} carregando={carregando} />
        <Indicador
          rotulo="Atrasadas"
          valor={dados?.atrasadas.length ?? 0}
          nota={dados?.atrasadas.length > 0 ? "exigem ação" : "nenhuma em atraso"}
          critico={dados?.atrasadas.length > 0}
          icone={AlertTriangle}
          carregando={carregando}
        />
        <Indicador rotulo="Aguardando outra pessoa" valor={dados?.aguardandoOutro.length ?? 0} nota="dependem de outro setor" icone={Hourglass} carregando={carregando} />
        <Indicador rotulo="Paradas há 5+ dias" valor={dados?.paradas.length ?? 0} nota="sem movimentação" icone={Clock} carregando={carregando} />
      </div>

      {carregando && (
        <div className="card overflow-hidden">
          <EsqueletoLista linhas={5} />
        </div>
      )}

      {dados && (
        <div className="space-y-6">
          {/* Produtividade — medidor: preenchimento azul sobre trilho do mesmo azul, mais claro */}
          <Secao
            titulo="Produtividade da equipe"
            descricao="Tarefas concluídas em relação ao total."
            icone={TrendingUp}
            corpoClassName="px-5 py-5"
          >
            <div className="flex items-end justify-between gap-4">
              <p className="text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink-950">
                {taxa}
                <span className="ml-0.5 text-lg font-medium text-slate-500">%</span>
              </p>
              <p className="text-sm text-slate-600">
                <span className="font-semibold text-ink-950">{dados.conclusao}</span> de {dados.totalTarefas} concluídas
              </p>
            </div>
            <div
              className="mt-4 h-2.5 overflow-hidden rounded-full bg-ink-50"
              role="meter"
              aria-valuenow={taxa}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Taxa de conclusão"
            >
              <div className="h-full rounded-full bg-ink-800 transition-[width] duration-500" style={{ width: `${taxa}%` }} />
            </div>
          </Secao>

          {/* Carga por servidor */}
          <Secao titulo="Carga de trabalho por servidor" descricao="Quem está com mais tarefas ativas agora." icone={Users}>
            {dados.carga.length === 0 ? (
              <EstadoVazio compacto semAcao titulo="Nenhum servidor com tarefas ativas" descricao="Quando houver tarefas atribuídas, a distribuição aparece aqui." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {dados.carga.map((c: any) => (
                  <li key={c.nome} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-50 text-xs font-semibold text-ink-800" aria-hidden>
                      {iniciais(c.nome)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink-950">{c.nome}</span>
                      <span className="block truncate text-[13px] text-slate-500">{c.cargo || "Servidor"}</span>
                    </span>
                    <span className="text-[13px] text-slate-600">
                      <b className="font-semibold text-ink-950">{c.ativas}</b> ativas · <b className="font-semibold text-ink-950">{c.concluidas}</b> concluídas
                    </span>
                    {c.atrasadas > 0 && <span className="pill pill-danger">{c.atrasadas} atrasada{c.atrasadas > 1 ? "s" : ""}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Secao>

          {/* Gargalos: aguardando outro + paradas */}
          {(dados.aguardandoOutro.length > 0 || dados.paradas.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {dados.aguardandoOutro.length > 0 && (
                <Secao titulo="Aguardando outra pessoa" descricao="Gargalos fora da equipe." icone={Hourglass}>
                  <ul className="divide-y divide-slate-100">
                    {dados.aguardandoOutro.map((t: any) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-slate-700">
                        <span className="min-w-0 truncate">{t.titulo}</span>
                        <span className="pill pill-neutral shrink-0">Aguardando</span>
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}
              {dados.paradas.length > 0 && (
                <Secao titulo="Processos parados há 5+ dias" descricao="Sem nenhuma movimentação recente." icone={Clock}>
                  <ul className="divide-y divide-slate-100">
                    {dados.paradas.map((t: any) => (
                      <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm text-slate-700">
                        <span className="min-w-0 truncate">{t.titulo}</span>
                        <span className="pill pill-warning shrink-0">Parado</span>
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
