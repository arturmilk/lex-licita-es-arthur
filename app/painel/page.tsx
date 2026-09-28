"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock, AlertTriangle, Clock, Bell, ArrowRight, Hourglass, Plus, MessageCircle,
  BookOpen, History, CheckCircle2, ListTodo, CircleAlert,
} from "lucide-react";
import { obterPainelServidor, marcarAlertaLido } from "@/lib/actions-intencao";
import { CabecalhoPagina, Indicador, Secao, Situacao, AvisoErro } from "@/components/Pagina";
import { EstadoVazio, EsqueletoLista } from "@/components/Estados";
import { useUsuario } from "@/components/UsuarioContexto";

function fmtData(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function hojePorExtenso() {
  const s = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Atalhos para quem ainda não sabe por onde começar — o sistema ensina em vez de exigir. */
const ATALHOS = [
  { href: "/pesquisa/nova", icone: Plus, titulo: "Nova pesquisa de preços", texto: "Passo a passo, com fontes oficiais e memória de cálculo." },
  { href: "/assistente", icone: MessageCircle, titulo: "Conversar com o assistente", texto: "Conte a necessidade; o LEX estrutura a contratação." },
  { href: "/procedimentos", icone: BookOpen, titulo: "Ver os procedimentos", texto: "O caminho de cada etapa, do DFD ao contrato." },
  { href: "/historicos", icone: History, titulo: "Retomar um trabalho", texto: "Processos e pesquisas anteriores do órgão." },
];

type Tom = "neutro" | "erro" | "espera" | "parado";

/** Linha de tarefa reutilizada pelas abas (menos variação visual = menos ruído). */
function TarefaLinha({
  titulo, detalhe, status, href, tom = "neutro",
}: {
  titulo: string; detalhe?: string; status?: string; href?: string; tom?: Tom;
}) {
  const Icone = tom === "erro" ? AlertTriangle : tom === "espera" ? Hourglass : tom === "parado" ? Clock : CalendarClock;
  const iconeCls = {
    neutro: "bg-ink-50 text-ink-700",
    erro: "bg-red-50 text-red-700",
    espera: "bg-slate-100 text-slate-600",
    parado: "bg-amber-50 text-amber-700",
  }[tom];

  const corpo = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconeCls}`} aria-hidden>
        <Icone size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink-950">{titulo}</span>
        {detalhe && <span className="mt-0.5 block truncate text-[13px] text-slate-500">{detalhe}</span>}
      </span>
      {status && <Situacao status={status} />}
      {href && <ArrowRight size={16} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />}
    </>
  );

  const base = "group flex items-center gap-3 px-5 py-3.5";
  return href
    ? <Link href={href} className={`${base} linha-clicavel`}>{corpo}</Link>
    : <div className={base}>{corpo}</div>;
}

export default function PainelPage() {
  const usuario = useUsuario();
  const [painel, setPainel] = useState<any | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState("hoje");

  useEffect(() => {
    obterPainelServidor().then(setPainel).catch((e) => setErro(String(e?.message || e)));
  }, []);

  async function lerAlerta(id: string) {
    await marcarAlertaLido(id);
    setPainel(await obterPainelServidor());
  }

  const primeiroNome = (usuario?.nome || "").trim().split(/\s+/)[0];

  const abas = painel
    ? [
        { chave: "hoje", label: "Para hoje", qtd: painel.tarefasHoje.length },
        { chave: "atrasadas", label: "Atrasadas", qtd: painel.atrasadas.length },
        { chave: "aguardando", label: "Aguardando outra pessoa", qtd: painel.aguardandoOutro.length },
        { chave: "paradas", label: "Sem movimento (5+ dias)", qtd: painel.paradas5dias.length },
        { chave: "pendentes", label: "Pendentes", qtd: painel.pendentes.length },
      ].filter((a) => a.qtd > 0 || a.chave === "hoje" || a.chave === aba)
    : [];

  const vazio = (titulo: string, descricao: string) => (
    <EstadoVazio compacto semAcao icone={CheckCircle2} titulo={titulo} descricao={descricao} />
  );

  return (
    <div>
      <CabecalhoPagina
        sobretitulo={<span suppressHydrationWarning>{hojePorExtenso()}</span>}
        titulo={
          <span suppressHydrationWarning>
            {saudacao()}
            {primeiroNome ? `, ${primeiroNome}` : ""}
          </span>
        }
        descricao="Aqui está o que precisa da sua atenção hoje."
        acoes={
          <>
            <Link href="/processos" className="btn btn-outline">
              Ver processos
            </Link>
            <Link href="/pesquisa/nova" className="btn btn-primary">
              <Plus size={16} aria-hidden /> Nova pesquisa
            </Link>
          </>
        }
      />

      {erro && <AvisoErro>Não foi possível carregar suas tarefas. {erro}</AvisoErro>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-6">
          {/* Resumo — 3 números que importam, nada além disso */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Indicador
              destaque
              rotulo="Para hoje"
              valor={painel?.tarefasHoje.length ?? 0}
              nota="tarefas com prazo hoje"
              icone={CalendarClock}
              carregando={!painel && !erro}
              onClick={() => setAba("hoje")}
              ativo={aba === "hoje"}
            />
            <Indicador
              rotulo="Pendentes"
              valor={painel?.pendentes.length ?? 0}
              nota="aguardando início"
              icone={ListTodo}
              carregando={!painel && !erro}
              onClick={() => setAba("pendentes")}
              ativo={aba === "pendentes"}
            />
            <Indicador
              rotulo="Atrasadas"
              valor={painel?.atrasadas.length ?? 0}
              nota={painel?.atrasadas.length > 0 ? "precisam de ação agora" : "nenhuma em atraso"}
              critico={painel?.atrasadas.length > 0}
              icone={CircleAlert}
              carregando={!painel && !erro}
              onClick={() => setAba("atrasadas")}
              ativo={aba === "atrasadas"}
            />
          </div>

          {/* Alertas */}
          {painel?.alertas?.length > 0 && (
            <section className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-card" aria-labelledby="alertas-titulo">
              <div className="flex items-center gap-2.5 border-b border-red-100 bg-red-50/70 px-5 py-3">
                <Bell size={16} className="text-red-700" aria-hidden />
                <h2 id="alertas-titulo" className="text-sm font-semibold text-red-800">
                  Alertas <span className="font-normal">({painel.alertas.length})</span>
                </h2>
              </div>
              <ul className="divide-y divide-slate-100">
                {painel.alertas.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-2">
                    <span className="flex items-center gap-2.5 text-sm text-slate-700">
                      {a.severidade === "alta"
                        ? <AlertTriangle size={15} className="shrink-0 text-red-600" aria-label="Alta" />
                        : <Clock size={15} className="shrink-0 text-amber-600" aria-label="Média" />}
                      {a.mensagem}
                    </span>
                    <button onClick={() => lerAlerta(a.id)} className="btn btn-ghost btn-sm shrink-0 min-h-[44px]">
                      Marcar como lido
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Tarefas por aba */}
          <Secao titulo="Suas tarefas" descricao="Organizadas por prazo e situação.">
            {!painel ? (
              <EsqueletoLista linhas={3} />
            ) : (
              <>
                <div role="tablist" aria-label="Filtrar tarefas" className="scroll-fino flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-3">
                  {abas.map((a) => {
                    const sel = aba === a.chave;
                    return (
                      <button
                        key={a.chave}
                        role="tab"
                        aria-selected={sel}
                        onClick={() => setAba(a.chave)}
                        className={`-mb-px inline-flex min-h-[46px] shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] font-semibold transition-colors ${
                          sel ? "border-ink-900 text-ink-950" : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {a.label}
                        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${sel ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {a.qtd}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="divide-y divide-slate-100" role="tabpanel">
                  {aba === "hoje" && (painel.tarefasHoje.length === 0
                    ? vazio("Nada para hoje. Tudo em dia.", "Quando uma tarefa vencer hoje, ela aparece aqui primeiro.")
                    : painel.tarefasHoje.map((t: any) => (
                        <TarefaLinha key={t.id} titulo={t.titulo} detalhe={t.descricao?.slice(0, 90)} status={t.status}
                          href={t.processoId ? `/processos/${t.processoId}/jornada` : undefined} />
                      )))}

                  {aba === "atrasadas" && (painel.atrasadas.length === 0
                    ? vazio("Nenhuma tarefa atrasada.", "Prazos vencidos aparecem aqui, com a data original.")
                    : painel.atrasadas.map((t: any) => (
                        <TarefaLinha key={t.id} titulo={t.titulo} detalhe={`Prazo: ${fmtData(t.prazo)}`} status={t.status} tom="erro" />
                      )))}

                  {aba === "aguardando" && (painel.aguardandoOutro.length === 0
                    ? vazio("Nada aguardando outra pessoa.", "Tarefas que dependem de outro setor ficam separadas aqui.")
                    : painel.aguardandoOutro.map((t: any) => (
                        <TarefaLinha key={t.id} titulo={t.titulo} detalhe={`Depende de: ${t.dependenteDe || "outro setor"}`} status={t.status} tom="espera" />
                      )))}

                  {aba === "paradas" && (painel.paradas5dias.length === 0
                    ? vazio("Nenhum processo sem movimento.", "Processos parados há 5 dias ou mais aparecem aqui.")
                    : painel.paradas5dias.map((t: any) => (
                        <TarefaLinha key={t.id} titulo={t.titulo} detalhe={`Criada em ${fmtData(t.createdAt)} · sem movimento`} status={t.status} tom="parado" />
                      )))}

                  {aba === "pendentes" && (painel.pendentes.length === 0
                    ? vazio("Nenhuma tarefa pendente.", "Tarefas que ainda não começaram aparecem aqui.")
                    : painel.pendentes.map((t: any) => (
                        <TarefaLinha key={t.id} titulo={t.titulo} detalhe={t.descricao?.slice(0, 90)} status={t.status} tom="espera" />
                      )))}
                </div>
              </>
            )}
          </Secao>
        </div>

        {/* Atalhos — o que dá para fazer daqui */}
        <aside aria-labelledby="atalhos-titulo" className="min-w-0">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 id="atalhos-titulo" className="section-title">Comece por aqui</h2>
              <p className="section-desc">Os caminhos mais usados no dia a dia.</p>
            </div>
            <ul className="divide-y divide-slate-100">
              {ATALHOS.map(({ href, icone: Icone, titulo, texto }) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-3.5 px-5 py-3.5 linha-clicavel">
                    <span className="icon-tile h-9 w-9 transition-colors group-hover:bg-ink-900 group-hover:text-gold-400" aria-hidden>
                      <Icone size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink-950">{titulo}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{texto}</span>
                    </span>
                    <ArrowRight size={15} className="shrink-0 text-slate-300 transition-all group-hover:translate-x-0.5 group-hover:text-ink-700" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
