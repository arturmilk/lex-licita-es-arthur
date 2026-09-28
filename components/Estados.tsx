import React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

/** Bloco de esqueleto (carregamento) — evita o "salto" de layout do spinner solto. */
export function Esqueleto({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-100 ${className}`} aria-hidden />;
}

/** Esqueleto de lista/tabela. Usado no lugar do "Carregando..." com spinner. */
export function EsqueletoLista({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="divide-y divide-slate-100" role="status" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Esqueleto className="h-3 w-20" />
          <Esqueleto className="h-3 max-w-[42%] flex-1" />
          <Esqueleto className="h-5 w-24 rounded-full" />
          <Esqueleto className="ml-auto h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/**
 * Estado vazio útil: sempre diz o que é e qual é o próximo passo.
 * (Heurística de Nielsen #10 — ajuda e documentação; e "uma tarefa por vez".)
 */
export function EstadoVazio({
  titulo,
  descricao,
  href,
  acao = "Começar",
  icone: Icone,
  semAcao = false,
  compacto = false,
}: {
  titulo: string;
  descricao?: string;
  href?: string;
  acao?: string;
  icone?: React.ElementType;
  semAcao?: boolean;
  compacto?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-4 px-6 text-center ${compacto ? "py-8" : "py-12"}`}>
      {Icone && (
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ink-50 text-ink-700 ring-1 ring-ink-100" aria-hidden>
          <Icone className="h-5 w-5" />
        </span>
      )}
      <div className="max-w-sm">
        <p className="text-[15px] font-semibold text-ink-950">{titulo}</p>
        {descricao && <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{descricao}</p>}
      </div>
      {!semAcao && href && (
        <Link href={href} className="btn btn-primary btn-sm">
          <Plus className="h-4 w-4" aria-hidden /> {acao}
        </Link>
      )}
    </div>
  );
}
