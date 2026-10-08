"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import s from "./curso.module.css";

const LINKS = [
  { href: "#curso", rotulo: "O curso" },
  { href: "#metodo", rotulo: "Método" },
  { href: "#conteudo", rotulo: "Conteúdo" },
  { href: "#sistema", rotulo: "Sistema" },
  { href: "#instrutor", rotulo: "Instrutor" },
];

/**
 * Menu fixo da página do curso. Na capa é transparente e alto; ao rolar, encolhe, fica branco,
 * ganha sombra e o nome some (fica só o selo). Uma régua dourada mostra quanto já foi lido e o
 * link da seção atual acende. No celular, as três barras viram um X e abrem o menu.
 */
export function NavCurso({ acesso }: { acesso: string }) {
  const [rolado, setRolado] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState<string | null>(null);
  const regua = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let quadro = 0;
    const medir = () => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        const y = window.scrollY;
        setRolado(y > 80);
        const total = document.documentElement.scrollHeight - window.innerHeight;
        if (regua.current) regua.current.style.transform = `scaleX(${total > 0 ? Math.min(1, y / total) : 0})`;
      });
    };
    medir();
    window.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      cancelAnimationFrame(quadro);
      window.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) if (e.isIntersecting) setAtual(`#${e.target.id}`);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    document.querySelectorAll("main > section[id]").forEach((secao) => obs.observe(secao));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aberto]);

  const claro = rolado || aberto;
  const fechar = () => setAberto(false);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[height,background-color,box-shadow] duration-300 ${
        claro ? "h-16 bg-white shadow-[0_4px_30px_-5px_rgb(3_38_80/0.18)]" : "h-24 bg-transparent"
      }`}
    >
      <nav aria-label="Seções da página" className="mx-auto flex h-full max-w-[76rem] items-center justify-between gap-4 px-5 sm:px-8">
        <a
          href="#inicio"
          onClick={fechar}
          className={`flex min-h-[44px] items-center gap-3 rounded-lg ${claro ? "" : "focus-visible:outline-white"}`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/5">
            <img src="/logo-lex.png" alt="" className="h-7 w-7 object-contain" />
          </span>
          <span
            className={`overflow-hidden whitespace-nowrap text-[17px] font-semibold tracking-[-0.01em] transition-[max-width,opacity,color] duration-300 ${
              rolado ? "max-w-0 opacity-0" : "max-w-[12rem] opacity-100"
            } ${claro ? "text-ink-950" : "text-white"}`}
          >
            Lex Licitações
          </span>
        </a>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                aria-current={atual === l.href ? "true" : undefined}
                className={`relative flex min-h-[44px] items-center rounded-lg px-3 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:bottom-1.5 after:h-[2px] after:origin-left after:scale-x-0 after:rounded-full after:bg-gold-500 after:transition-transform after:duration-300 hover:after:scale-x-100 aria-[current=true]:after:scale-x-100 ${
                  claro
                    ? "text-slate-600 hover:text-ink-950 aria-[current=true]:text-ink-950"
                    : "text-white/75 hover:text-white focus-visible:outline-white aria-[current=true]:text-white"
                }`}
              >
                {l.rotulo}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link
            href={acesso}
            className={`btn ${s.brilho} group bg-gold-500 text-ink-950 hover:bg-gold-400 focus-visible:ring-gold-500/40`}
          >
            <span className="sm:hidden">Assinar</span>
            <span className="hidden sm:inline">Assinar / Entrar</span>
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => setAberto(!aberto)}
            aria-expanded={aberto}
            aria-controls="menu-curso"
            aria-label={aberto ? "Fechar menu" : "Abrir menu"}
            className={`group flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden ${
              claro ? "bg-ink-50 hover:bg-ink-100" : "bg-white/10 hover:bg-white/15 focus-visible:outline-white"
            }`}
          >
            <span aria-hidden className="flex flex-col items-end">
              {[
                aberto ? "w-[22px] translate-y-[7px] rotate-45" : "w-[22px]",
                aberto ? "w-[22px] scale-0" : "my-[5px] w-[17px] group-hover:w-[22px]",
                aberto ? "w-[22px] -translate-y-[7px] -rotate-45" : "w-[12px] group-hover:w-[22px]",
              ].map((forma, i) => (
                <span
                  key={i}
                  className={`block h-[2px] rounded-full transition-all duration-300 ease-in-out ${aberto && i === 1 ? "my-[5px]" : ""} ${
                    claro ? "bg-ink-900" : "bg-white"
                  } ${forma}`}
                />
              ))}
            </span>
          </button>
        </div>
      </nav>

      {/* Régua de leitura */}
      <div ref={regua} aria-hidden className="absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-gold-500" />

      {/* Menu do celular */}
      <div
        id="menu-curso"
        className={`absolute inset-x-0 top-full overflow-hidden border-t border-slate-100 bg-white shadow-[0_24px_40px_-24px_rgb(3_38_80/0.35)] transition-[max-height,opacity,visibility] duration-300 lg:hidden ${
          aberto ? "visible max-h-[480px] opacity-100" : "invisible max-h-0 opacity-0"
        }`}
      >
        <ul className="px-5 pb-6 pt-2 sm:px-8">
          {LINKS.map((l, i) => (
            <li
              key={l.href}
              className={`border-b border-slate-100 transition-[opacity,transform] duration-300 ${aberto ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"}`}
              style={{ transitionDelay: aberto ? `${80 + i * 50}ms` : "0ms" }}
            >
              <a href={l.href} onClick={fechar} className="flex min-h-[52px] items-center justify-between text-lg font-semibold text-ink-950">
                {l.rotulo}
                <span className="font-mono text-xs text-slate-400">{String(i + 2).padStart(2, "0")}</span>
              </a>
            </li>
          ))}
          <li className="pt-5">
            <Link href={acesso} className="btn btn-primary w-full text-base">
              Assinar / Entrar <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </li>
        </ul>
      </div>
    </header>
  );
}
