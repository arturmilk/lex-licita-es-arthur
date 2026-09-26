"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, AlertTriangle, Clock, Bell, ArrowRight, Hourglass } from "lucide-react";
import { obterPainelServidor, marcarAlertaLido } from "@/lib/actions-intencao";

function fmtData(d: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pendente: { label: "Pendente", cls: "badge-warning" },
  em_andamento: { label: "Em andamento", cls: "badge-info" },
  concluida: { label: "Concluída", cls: "badge-success" },
  aguardando_outro: { label: "Aguardando outro", cls: "badge-neutral" },
  atrasada: { label: "Atrasada", cls: "badge-danger" },
};

function Badge({ status }: { status: string }) {
  const s = STATUS[status] || { label: status, cls: "badge-neutral" };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

/** Linha de tarefa reutilizada pelas abas (menos variação visual = menos ruído). */
function TarefaLinha({
  titulo, detalhe, status, href, tom = "neutro",
}: {
  titulo: string; detalhe?: string; status?: string; href?: string; tom?: "neutro" | "erro" | "espera" | "parado";
}) {
  const tomCls = {
    neutro: "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
    erro: "border-red-100 bg-red-50/60",
    espera: "border-slate-200 bg-slate-50",
    parado: "border-amber-100 bg-amber-50/60",
  }[tom];
  const Icone = tom === "erro" ? AlertTriangle : tom === "espera" ? Hourglass : tom === "parado" ? Clock : CalendarClock;
  const iconeCls = tom === "erro" ? "text-red-600" : tom === "parado" ? "text-amber-600" : "text-ink-700";

  const corpo = (
    <>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tom === "erro" ? "bg-red-100" : tom === "parado" ? "bg-amber-100" : "bg-ink-50"}`}>
        <Icone size={16} className={iconeCls} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-800">{titulo}</span>
        {detalhe && <span className="block truncate text-xs text-slate-500">{detalhe}</span>}
      </span>
      {status && <Badge status={status} />}
      {href && <ArrowRight size={15} className="shrink-0 text-slate-400" />}
    </>
  );

  const base = `flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${tomCls}`;
  return href
    ? <Link href={href} className={base}>{corpo}</Link>
    : <div className={base}>{corpo}</div>;
}

function Vazio({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-slate-600">{texto}</p>;
}

export default function PainelPage() {
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

  const resumo = painel && [
    { chave: "hoje", rotulo: "Para hoje", valor: painel.tarefasHoje.length, destaque: true },
    { chave: "pendentes", rotulo: "Pendentes", valor: painel.pendentes.length },
    { chave: "atrasadas", rotulo: "Atrasadas", valor: painel.atrasadas.length, alerta: painel.atrasadas.length > 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {erro && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{erro}</div>}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Meu dia</h1>
          <p className="mt-1 text-sm text-slate-600">O que precisa da sua atenção hoje.</p>
        </div>
        <Link href="/processos" className="btn btn-outline btn-sm">
          Ver processos <ArrowRight size={14} />
        </Link>
      </div>

      {/* Resumo — 3 números que importam, nada além disso */}
      {painel && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {resumo!.map((c: { chave: string; rotulo: string; valor: number; destaque?: boolean; alerta?: boolean }) => {
            const ativo = aba === c.chave;
            return (
              <button
                key={c.chave}
                onClick={() => setAba(c.chave)}
                className={`rounded-xl border p-5 text-left shadow-card transition-colors ${
                  c.destaque
                    ? "border-ink-900 bg-ink-900 text-white"
                    : ativo
                    ? "border-ink-300 bg-white ring-1 ring-ink-300"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <p className={`eyebrow ${c.destaque ? "text-white/70" : "text-slate-600"}`}>{c.rotulo}</p>
                <p className={`mt-1 text-4xl font-bold tabular-nums ${c.destaque ? "text-white" : c.alerta ? "text-red-700" : "text-slate-800"}`}>
                  {c.valor}
                </p>
                <p className={`mt-1 text-xs ${c.destaque ? "text-white/60" : "text-slate-600"}`}>
                  {c.chave === "hoje" ? "no seu dia" : c.chave === "pendentes" ? "aguardando início" : "precisam de ação"}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Alertas */}
      {painel?.alertas?.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50/60 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Bell size={16} className="text-red-700" />
            <h2 className="text-sm font-semibold text-red-800">Alertas ({painel.alertas.length})</h2>
          </div>
          <div className="space-y-2">
            {painel.alertas.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  {a.severidade === "alta" ? <AlertTriangle size={15} className="shrink-0 text-red-600" /> : <Clock size={15} className="shrink-0 text-amber-600" />}
                  {a.mensagem}
                </div>
                <button onClick={() => lerAlerta(a.id)} className="shrink-0 text-xs font-medium text-slate-600 hover:text-slate-900">
                  Marcar como lido
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tarefas por aba */}
      {painel && (
        <div className="card overflow-hidden">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3">
            {[
              { chave: "hoje", label: "Para hoje", qtd: painel.tarefasHoje.length },
              { chave: "atrasadas", label: "Atrasadas", qtd: painel.atrasadas.length },
              { chave: "aguardando", label: "Aguardando outra pessoa", qtd: painel.aguardandoOutro.length },
              { chave: "paradas", label: "Sem movimento (5+ dias)", qtd: painel.paradas5dias.length },
              { chave: "pendentes", label: "Pendentes", qtd: painel.pendentes.length },
            ].filter((a) => a.qtd > 0 || a.chave === "hoje").map((a) => (
              <button
                key={a.chave}
                onClick={() => setAba(a.chave)}
                aria-current={aba === a.chave ? "true" : undefined}
                className={`shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                  aba === a.chave ? "border-ink-900 text-ink-900" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {a.label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${aba === a.chave ? "bg-ink-900 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {a.qtd}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2 p-4">
            {aba === "hoje" && (painel.tarefasHoje.length === 0
              ? <Vazio texto="Nada para hoje. Tudo em dia." />
              : painel.tarefasHoje.map((t: any) => (
                  <TarefaLinha key={t.id} titulo={t.titulo} detalhe={t.descricao?.slice(0, 90)} status={t.status}
                    href={t.processoId ? `/processos/${t.processoId}/jornada` : undefined} />
                )))}

            {aba === "atrasadas" && (painel.atrasadas.length === 0
              ? <Vazio texto="Nenhuma tarefa atrasada." />
              : painel.atrasadas.map((t: any) => (
                  <TarefaLinha key={t.id} titulo={t.titulo} detalhe={`Prazo: ${fmtData(t.prazo)}`} status={t.status} tom="erro" />
                )))}

            {aba === "aguardando" && (painel.aguardandoOutro.length === 0
              ? <Vazio texto="Nada aguardando outra pessoa." />
              : painel.aguardandoOutro.map((t: any) => (
                  <TarefaLinha key={t.id} titulo={t.titulo} detalhe={`Depende de: ${t.dependenteDe || "outro setor"}`} status={t.status} tom="espera" />
                )))}

            {aba === "paradas" && (painel.paradas5dias.length === 0
              ? <Vazio texto="Nenhum processo sem movimento." />
              : painel.paradas5dias.map((t: any) => (
                  <TarefaLinha key={t.id} titulo={t.titulo} detalhe={`Criada em ${fmtData(t.createdAt)} — sem movimento`} status={t.status} tom="parado" />
                )))}

            {aba === "pendentes" && (painel.pendentes.length === 0
              ? <Vazio texto="Nenhuma tarefa pendente." />
              : painel.pendentes.map((t: any) => (
                  <TarefaLinha key={t.id} titulo={t.titulo} detalhe={t.descricao?.slice(0, 90)} status={t.status} tom="espera" />
                )))}
          </div>
        </div>
      )}
    </div>
  );
}
