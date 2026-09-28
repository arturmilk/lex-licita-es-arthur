import React from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Peças de página do LEX — a mesma anatomia em todas as telas:
 * cabeçalho (título, descrição, ações) → indicadores → seções.
 * Consistência é o que faz o sistema parecer um só (Nielsen #4).
 */

export function CabecalhoPagina({
  titulo,
  descricao,
  sobretitulo,
  acoes,
  nivel = 1,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  sobretitulo?: React.ReactNode;
  acoes?: React.ReactNode;
  /** 2 quando a página está embutida em outra (ex.: Processos dentro de Histórico). */
  nivel?: 1 | 2;
}) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <header className={nivel === 1 ? "page-head" : "mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3"}>
      <div className="min-w-0">
        {sobretitulo && <p className="page-eyebrow">{sobretitulo}</p>}
        <Titulo className={nivel === 1 ? "page-title" : "text-xl font-semibold tracking-[-0.015em] text-ink-950"}>{titulo}</Titulo>
        {descricao && <p className={nivel === 1 ? "page-lead" : "mt-1 text-sm leading-relaxed text-slate-600"}>{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </header>
  );
}

/**
 * Indicador (o número que importa). Regras: rótulo em texto neutro (nunca a cor
 * do dado), valor grande em algarismos proporcionais, no máximo UM `destaque`
 * por tela, e estado crítico sempre com ícone + texto — nunca só cor.
 */
export function Indicador({
  rotulo,
  valor,
  nota,
  icone: Icone,
  destaque = false,
  critico = false,
  onClick,
  ativo = false,
  carregando = false,
}: {
  rotulo: string;
  valor: React.ReactNode;
  nota?: React.ReactNode;
  icone?: React.ElementType;
  destaque?: boolean;
  critico?: boolean;
  onClick?: () => void;
  ativo?: boolean;
  carregando?: boolean;
}) {
  const base = destaque
    ? "rounded-xl border border-ink-900 bg-ink-900 p-5 text-white shadow-raise"
    : `stat ${ativo ? "border-ink-300 ring-1 ring-ink-300" : ""}`;
  const interativo = onClick ? "card-hover text-left focus-visible:ring-4 focus-visible:ring-[#0a3a6e]/15" : "";

  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={destaque ? "text-[13px] font-medium text-white/70" : "stat-label"}>{rotulo}</p>
        {Icone && <Icone size={16} aria-hidden className={destaque ? "text-gold-400" : "text-slate-400"} />}
      </div>
      {carregando ? (
        <span className={`mt-3 block h-8 w-16 animate-pulse rounded-md ${destaque ? "bg-white/15" : "bg-slate-100"}`} aria-hidden />
      ) : (
        <p className={destaque ? "mt-3 text-[2rem] font-semibold leading-none tracking-[-0.03em] text-white" : "stat-value"}>{valor}</p>
      )}
      {nota && (
        <p className={`mt-2 flex items-center gap-1.5 text-xs leading-snug ${destaque ? "text-white/60" : critico ? "font-medium text-red-700" : "text-slate-500"}`}>
          {critico && <AlertTriangle size={13} aria-hidden className="shrink-0" />}
          {nota}
        </p>
      )}
    </>
  );

  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={ativo} className={`${base} ${interativo} w-full`}>
      {conteudo}
    </button>
  ) : (
    <div className={base}>{conteudo}</div>
  );
}

/** Seção: card com cabeçalho (ícone, título, descrição, ações) e corpo. */
export function Secao({
  titulo,
  descricao,
  icone: Icone,
  acoes,
  children,
  className = "",
  corpoClassName = "",
  nivel = 2,
}: {
  titulo?: React.ReactNode;
  descricao?: React.ReactNode;
  icone?: React.ElementType;
  acoes?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  corpoClassName?: string;
  nivel?: 2 | 3;
}) {
  const Titulo = nivel === 2 ? "h2" : "h3";
  return (
    <section className={`card overflow-hidden ${className}`}>
      {(titulo || acoes) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {Icone && (
              <span className="icon-tile h-9 w-9" aria-hidden>
                <Icone size={17} />
              </span>
            )}
            <div className="min-w-0">
              {titulo && <Titulo className="section-title">{titulo}</Titulo>}
              {descricao && <p className="section-desc">{descricao}</p>}
            </div>
          </div>
          {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
        </div>
      )}
      <div className={corpoClassName}>{children}</div>
    </section>
  );
}

type Tom = "neutral" | "info" | "success" | "warning" | "danger" | "gold";

/** Situações do sistema (pesquisas, processos, tarefas, buscas automáticas) — um só dicionário. */
export const SITUACOES: Record<string, { rotulo: string; tom: Tom }> = {
  // Pesquisas
  em_andamento: { rotulo: "Em andamento", tom: "info" },
  concluida: { rotulo: "Concluída", tom: "success" },
  cancelada: { rotulo: "Cancelada", tom: "danger" },
  // Processos
  rascunho: { rotulo: "Rascunho", tom: "neutral" },
  pesquisando: { rotulo: "Pesquisando", tom: "info" },
  estimado: { rotulo: "Estimado", tom: "gold" },
  concluido: { rotulo: "Concluído", tom: "success" },
  cancelado: { rotulo: "Cancelado", tom: "danger" },
  // Tarefas
  pendente: { rotulo: "Pendente", tom: "warning" },
  aguardando_outro: { rotulo: "Aguardando outra pessoa", tom: "neutral" },
  atrasada: { rotulo: "Atrasada", tom: "danger" },
  // Buscas automáticas
  executando: { rotulo: "Executando", tom: "warning" },
  aguardando: { rotulo: "Aguardando", tom: "neutral" },
  erro: { rotulo: "Erro", tom: "danger" },
};

// Nomes completos (o Tailwind só preserva classes que aparecem inteiras no código).
const CLASSE_TOM: Record<Tom, string> = {
  neutral: "pill-neutral",
  info: "pill-info",
  success: "pill-success",
  warning: "pill-warning",
  danger: "pill-danger",
  gold: "pill-gold",
};

export function Situacao({ status, rotulo }: { status: string; rotulo?: string }) {
  const s = SITUACOES[status] || { rotulo: status.replace(/_/g, " "), tom: "neutral" as Tom };
  return <span className={`pill ${CLASSE_TOM[s.tom]}`}>{rotulo || s.rotulo}</span>;
}

/** Aviso de erro padrão (o que houve + como seguir). */
export function AvisoErro({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
