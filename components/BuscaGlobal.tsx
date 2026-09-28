"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, X } from "lucide-react";
import { itensDoPerfil } from "@/lib/navegacao";

/**
 * Busca global (Ctrl/⌘+K) — atalho para quem já conhece o sistema, sem atrapalhar
 * quem não usa. Sem escrever nada, mostra os destinos; com 3+ letras, oferece
 * também buscar aquele texto no sistema. No celular abre pelo ícone do topo.
 */
export default function BuscaGlobal({ perfil }: { perfil: string }) {
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const destinos = useMemo(() => itensDoPerfil(perfil), [perfil]);

  const itens = useMemo(() => {
    const t = q.trim().toLowerCase();
    const paginas = t
      ? destinos.filter((d) => (d.label + " " + d.href + " " + d.grupo).toLowerCase().includes(t))
      : destinos;
    const lista: { label: string; sub: string; href: string; Icon: any }[] = paginas
      .slice(0, 8)
      .map((d) => ({ label: d.label, sub: d.grupo, href: d.href, Icon: d.icon }));
    if (q.trim().length >= 3) {
      lista.push({ label: `Buscar “${q.trim()}” no sistema`, sub: "Busca", href: `/busca?q=${encodeURIComponent(q.trim())}`, Icon: Search });
    }
    return lista;
  }, [q, destinos]);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((v) => !v);
      } else if (e.key === "Escape") {
        setAberto(false);
      }
    };
    const onAbrir = () => setAberto(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("lex:abrir-busca", onAbrir);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lex:abrir-busca", onAbrir);
    };
  }, []);

  useEffect(() => {
    if (aberto) {
      setQ("");
      setSel(0);
      const t = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(t);
    }
  }, [aberto]);

  useEffect(() => { setSel(0); }, [q]);

  const ir = (href: string) => {
    setAberto(false);
    router.push(href);
  };

  const onKeyInput = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, itens.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); const it = itens[sel]; if (it) ir(it.href); }
  };

  const dialogo = aberto && (
    <div className="fixed inset-0 z-[90] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Busca global">
      <div className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]" onClick={() => setAberto(false)} aria-hidden />
      <div className="relative w-full max-w-lg animate-entrar overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4">
          <Search size={17} className="shrink-0 text-slate-400" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyInput}
            placeholder="Buscar tela, assunto ou palavra-chave…"
            className="min-h-[56px] flex-1 bg-transparent text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
            aria-label="Buscar"
            role="combobox"
            aria-expanded="true"
            aria-controls="bg-lista"
          />
          <button onClick={() => setAberto(false)} aria-label="Fechar" className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X size={17} />
          </button>
        </div>
        <ul id="bg-lista" role="listbox" className="scroll-fino max-h-[52vh] overflow-y-auto p-2">
          {itens.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Nada encontrado. Tente outra palavra.</li>}
          {itens.map((it, i) => (
            <li key={it.href + i} role="option" aria-selected={i === sel}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => ir(it.href)}
                className={`flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${i === sel ? "bg-ink-50 text-ink-950" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <it.Icon size={16} className={i === sel ? "text-ink-700" : "text-slate-400"} aria-hidden />
                <span className="min-w-0 flex-1 truncate font-medium">{it.label}</span>
                <span className="shrink-0 text-xs text-slate-500">{it.sub}</span>
                {i === sel && <CornerDownLeft size={13} className="shrink-0 text-slate-400" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
        <div className="hidden items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500 sm:flex">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">Enter</kbd> abrir</span>
          <span><kbd className="font-mono">Esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="group flex min-h-[44px] w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 px-3 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:bg-white"
        aria-label="Abrir busca global"
      >
        <Search size={15} className="shrink-0 text-slate-400 transition-colors group-hover:text-ink-700" aria-hidden />
        <span className="flex-1 text-left">Buscar ou ir para…</span>
        <kbd className="hidden items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-500 lg:inline-flex">
          Ctrl K
        </kbd>
      </button>
      {montado && dialogo ? createPortal(dialogo, document.body) : null}
    </>
  );
}
