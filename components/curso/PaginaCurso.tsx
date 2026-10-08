import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Check, CircleDollarSign, History, Home, Lock, MessageCircle, Scale } from "lucide-react";
import { NavCurso } from "./NavCurso";
import { Retrato } from "./Retrato";
import { Revelar } from "./Revelar";
import s from "./curso.module.css";

/**
 * Página de apresentação e venda do curso Lex Licitações (pública, em /curso).
 * Conceito: "os autos do curso" — a página se lê como um processo bem instruído. A capa abre,
 * cada seção é uma folha numerada (FLS. 02, 03…), o dourado é o carimbo que valida e o botão
 * de assinar é o despacho final. Todo "Assinar / Entrar" leva à tela de login do sistema.
 *
 * Textos do curso são provisórios (a ementa real vem do Israel). A foto entra em FOTO_ISRAEL.
 */

const ACESSO = "/login";
const FOTO_ISRAEL: string | undefined = undefined;

const MOTIVOS = [
  { titulo: "Segurança para decidir", texto: "Entenda o que a Lei nº 14.133/2021 e a IN SEGES nº 65/2021 pedem em cada etapa da pesquisa de preços." },
  { titulo: "O método de quem ensina", texto: "O passo a passo que o Israel apresenta nas palestras, organizado para a rotina do setor de compras." },
  { titulo: "Documentação que se sustenta", texto: "Justificativas e memória de cálculo prontas para acompanhar o processo." },
];

const TERMOS = ["Lei nº 14.133/2021", "IN SEGES nº 65/2021", "PNCP", "Compras.gov.br", "Cesta de preços", "Análise crítica", "Memória de cálculo", "Relatório final"];

const MOMENTOS = [
  { nome: "Preparar", texto: "Entender o que será comprado e organizar os itens da contratação." },
  { nome: "Precificação", texto: "Buscar preços nas fontes oficiais, como PNCP e Compras.gov.br." },
  { nome: "Conferir preços", texto: "Aceitar ou rejeitar referências e ler a estatística da amostra." },
  { nome: "Fechar relatório", texto: "Gerar o PDF e a planilha com a memória de cálculo." },
];

const MODULOS = [
  { titulo: "A pesquisa de preços no processo", texto: "Onde ela entra no planejamento da contratação, segundo a Lei nº 14.133/2021 e a IN SEGES nº 65/2021." },
  { titulo: "Parâmetros e fontes oficiais", texto: "Painel de Preços e PNCP, contratações similares, mídia especializada, fornecedores e notas fiscais." },
  { titulo: "Como montar a cesta de preços", texto: "Escolher referências comparáveis ao objeto e registrar a origem de cada uma." },
  { titulo: "Análise crítica da amostra", texto: "Identificar valores inexequíveis, inconsistentes ou excessivamente elevados — e justificar a exclusão." },
  { titulo: "Métodos de cálculo", texto: "Média, mediana ou menor preço, e o que o coeficiente de variação diz sobre a amostra." },
  { titulo: "Documentação para o processo", texto: "Justificativas, memória de cálculo e o relatório final que acompanha os autos." },
];

const RECURSOS = [
  "Integração oficial com PNCP, Compras.gov.br e Contratos.gov.br",
  "Análise crítica e estatística da amostra",
  "Relatório em PDF e planilha XLSX com memória de cálculo",
  "Assistente com IA para tirar dúvidas",
];

/** Revela ao rolar (ver Revelar.tsx): começa baixo e transparente, sobe ao entrar na tela. */
const REVELAR =
  "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.2,0.8,0.2,1)] data-[oculto]:translate-y-7 data-[oculto]:opacity-0";
const TITULO = "text-[2.25rem] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[3rem] lg:text-[3.5rem]";
const CONTEUDO = "mx-auto max-w-[76rem] px-5 sm:px-8";

const dois = (n: number) => String(n).padStart(2, "0");
const atraso = (ms: number) => ({ "--atraso": `${ms}ms` }) as CSSProperties;
const espera = (ms: number): CSSProperties => ({ transitionDelay: `${ms}ms` });

/** Pauta de documento (linhas de 1px) + fio dourado de margem — a assinatura do LEX. */
function Papel({ escuro = false }: { escuro?: boolean }) {
  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${escuro ? "opacity-[0.04]" : "opacity-[0.05]"}`}
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, ${escuro ? "#fff" : "#032650"} 0 1px, transparent 1px 32px)`,
        }}
      />
      <div aria-hidden className={`pointer-events-none absolute inset-y-0 left-3 w-px sm:left-5 ${escuro ? "bg-gold-500/25" : "bg-gold-500/35"}`} />
    </>
  );
}

/** Número da folha, como nos autos. */
function Folha({ n, escuro = false }: { n: number; escuro?: boolean }) {
  return (
    <span aria-hidden className={`absolute right-5 top-6 font-mono text-xs tracking-[0.16em] sm:right-8 ${escuro ? "text-white/40" : "text-slate-400"}`}>
      FLS. {dois(n)}
    </span>
  );
}

function Rubrica({ children, escuro = false }: { children: ReactNode; escuro?: boolean }) {
  return (
    <p className={`flex items-center gap-3 font-mono text-xs font-medium uppercase tracking-[0.16em] ${escuro ? "text-gold-400" : "text-ink-500"}`}>
      <span aria-hidden className="h-px w-8 bg-gold-500" />
      {children}
    </p>
  );
}

function Carimbo({ id, claro = false, className = "" }: { id: string; claro?: boolean; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none ${className}`}>
      <div className="relative h-full w-full">
        <svg viewBox="0 0 200 200" className={`h-full w-full ${s.carimbo}`}>
          <defs>
            <path id={id} d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0" />
          </defs>
          <circle cx="100" cy="100" r="96" fill="none" stroke="currentColor" strokeOpacity="0.35" className={claro ? "text-gold-700" : "text-gold-400"} />
          <text fontSize="13.5" letterSpacing="3" className={`font-mono ${claro ? "fill-gold-700" : "fill-gold-400"}`}>
            <textPath href={`#${id}`} textLength="486" lengthAdjust="spacing">
              LEX LICITAÇÕES • MÉTODO ISRAEL EVANGELISTA •
            </textPath>
          </text>
        </svg>
        <span className="absolute inset-[29%] flex items-center justify-center rounded-full border border-gold-500/60 bg-ink-900">
          <Scale className="h-1/2 w-1/2 text-gold-400" strokeWidth={1.5} />
        </span>
      </div>
    </div>
  );
}

function BotaoAssinar({ children = "Assinar / Entrar", grande = false }: { children?: ReactNode; grande?: boolean }) {
  return (
    <Link
      href={ACESSO}
      className={`btn ${s.brilho} group bg-gold-500 text-ink-950 hover:bg-gold-400 focus-visible:ring-white/40 ${grande ? "min-h-[56px] px-7 text-base" : "min-h-[52px] px-6 text-base"}`}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
    </Link>
  );
}

/** Tela do sistema desenhada em HTML (ilustração, sem dados reais). */
function TelaSistema() {
  const fases = ["Preparar", "Precificação", "Conferir preços", "Fechar relatório"];
  const referencias: [string, number, boolean][] = [
    ["PNCP", 72, true],
    ["Compras.gov.br", 58, true],
    ["Contratos.gov.br", 66, false],
    ["PNCP", 49, true],
  ];
  return (
    <div
      role="img"
      aria-label="Ilustração da tela de precificação do sistema LEX"
      className="overflow-hidden rounded-2xl bg-white text-left shadow-[0_50px_100px_-40px_rgb(0_0_0/0.75)] ring-1 ring-white/10"
    >
      <div className="flex h-10 items-center gap-2 border-b border-slate-200 bg-slate-50 px-4">
        <Lock className="h-3.5 w-3.5 text-slate-400" aria-hidden />
        <span className="font-mono text-xs text-slate-500">lex licitações · precificação</span>
      </div>
      <div className="flex">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-2.5 bg-ink-900 py-4 sm:flex">
          {[Home, CircleDollarSign, History, MessageCircle].map((Icone, i) => (
            <span key={i} className={`flex h-9 w-9 items-center justify-center rounded-lg ${i === 1 ? "bg-white/10 text-gold-400" : "text-white/40"}`}>
              <Icone className="h-4 w-4" aria-hidden />
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <ol className="flex items-center gap-3 sm:grid sm:grid-cols-4 sm:gap-2">
            {fases.map((f, i) => (
              <li key={f} className={i === 1 ? "min-w-0 flex-1" : "shrink-0 sm:min-w-0"}>
                <span className="flex items-center gap-1.5">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                      i === 0 ? "bg-ink-100 text-ink-800" : i === 1 ? `${s.pulso} bg-ink-900 text-white` : "border border-slate-300 text-slate-400"
                    }`}
                  >
                    {i === 0 ? <Check className="h-3 w-3" aria-hidden /> : i + 1}
                  </span>
                  <span className={`truncate text-xs font-medium ${i === 1 ? "text-ink-950" : "hidden text-slate-400 sm:inline"}`}>{f}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div data-revelar className="h-full w-[38%] origin-left rounded-full bg-ink-800 transition-transform delay-300 duration-[1200ms] data-[oculto]:scale-x-0" />
          </div>
          <p className="mt-5 text-sm font-semibold text-ink-950">Referências encontradas</p>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
            {referencias.map(([fonte, barra, aceita], i) => (
              <li key={i} data-revelar className={`${REVELAR} flex items-center gap-3 px-3 py-2.5`} style={espera(350 + i * 140)}>
                <span className="w-28 shrink-0 truncate font-mono text-xs text-ink-800">{fonte}</span>
                <span className="h-1.5 flex-1 rounded-full bg-slate-100">
                  <span className="block h-full rounded-full bg-slate-300" style={{ width: `${barra}%` }} />
                </span>
                <span className={`pill ${aceita ? "pill-success" : "pill-warning"}`}>{aceita ? "aceita" : "em análise"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5">
            <span className="text-xs font-semibold text-ink-800">Memória de cálculo</span>
            <span className="font-mono text-xs text-ink-700">PDF · XLSX</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaginaCurso() {
  return (
    <div className="overflow-x-clip bg-canvas">
      <NavCurso acesso={ACESSO} />
      <Revelar />

      <main>
        {/* ── Capa ─────────────────────────────────────────────────────────── */}
        <section id="inicio" className="relative isolate overflow-hidden bg-ink-900 text-white">
          <Papel escuro />
          <p
            aria-hidden
            className="pointer-events-none absolute -bottom-[0.2em] -left-[0.04em] select-none whitespace-nowrap text-[27vw] font-semibold leading-none tracking-[-0.05em] text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/0.07)]"
          >
            14.133
          </p>

          <div className={`${CONTEUDO} relative grid min-h-[100svh] items-center gap-16 pb-24 pt-32 lg:grid-cols-12 lg:gap-10 lg:pt-36`}>
            <div className="lg:col-span-7">
              <div className={s.entrar}>
                <Rubrica escuro>Curso · Lex Licitações</Rubrica>
              </div>
              <h1 className="mt-6 text-[3.25rem] font-semibold leading-[0.98] tracking-[-0.04em] text-white sm:text-[4.5rem] lg:text-[5.5rem]">
                <span className={s.linha}>
                  <span className={s.linhaTexto} style={atraso(100)}>
                    Licitações
                  </span>
                </span>
                <span className={s.linha}>
                  <span className={s.linhaTexto} style={atraso(230)}>
                    com <span className={s.grifo}>método</span>.
                  </span>
                </span>
              </h1>
              <p className={`${s.entrar} mt-7 max-w-xl text-xl font-medium leading-snug text-white sm:text-2xl`} style={atraso(520)}>
                Do pedido ao preço que se sustenta no processo.
              </p>
              <p className={`${s.entrar} mt-4 max-w-xl text-base leading-relaxed text-white/70 sm:text-[17px]`} style={atraso(640)}>
                Israel Evangelista, advogado e mestre em licitações, reúne a metodologia das suas palestras em um curso próprio — e você
                aplica tudo no sistema LEX, no dia a dia do seu órgão.
              </p>
              <div className={`${s.entrar} mt-9 flex flex-wrap gap-3`} style={atraso(780)}>
                <BotaoAssinar>Quero assinar</BotaoAssinar>
                <a
                  href="#metodo"
                  className="btn min-h-[52px] border border-white/25 px-6 text-base text-white hover:border-white/40 hover:bg-white/10 focus-visible:ring-white/40"
                >
                  Conhecer o método
                </a>
              </div>
            </div>

            <div className={`${s.entrar} relative mx-auto w-full max-w-[400px] lg:col-span-5 lg:max-w-none`} style={atraso(350)}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-ink-50 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)] ring-1 ring-white/10">
                <Papel />
                <Retrato foto={FOTO_ISRAEL} className="absolute inset-x-0 bottom-0 h-[92%] w-full" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-950/90 via-ink-950/50 to-transparent px-6 pb-5 pt-20">
                  <p className="text-lg font-semibold text-white">Israel Evangelista</p>
                  <p className="mt-0.5 font-mono text-xs uppercase tracking-[0.12em] text-gold-400">Advogado · Mestre em licitações</p>
                </div>
              </div>
              <Carimbo id="carimbo-capa" className="absolute -left-2 -top-10 h-32 w-32 sm:-left-12 sm:h-40 sm:w-40" />
            </div>
          </div>

          <a
            href="#curso"
            className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 rounded-lg p-1 text-white/60 hover:text-white focus-visible:outline-white sm:flex"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.2em]">Role</span>
            <span aria-hidden className={`${s.rolar} h-12 w-px bg-white/20`} />
          </a>
        </section>

        {/* ── Por que este curso ───────────────────────────────────────────── */}
        <section id="curso" className="relative scroll-mt-16 bg-canvas">
          <Papel />
          <Folha n={2} />
          <div className={`${CONTEUDO} relative grid gap-14 py-24 lg:grid-cols-12 lg:gap-10 lg:py-32`}>
            <div className="lg:col-span-6">
              <div data-revelar className={REVELAR}>
                <Rubrica>Por que este curso</Rubrica>
              </div>
              <h2 data-revelar className={`${REVELAR} mt-5 ${TITULO}`} style={espera(80)}>
                Toda contratação começa com um preço. <span className="text-ink-400">E todo preço precisa ser explicado.</span>
              </h2>
            </div>
            <ol className="lg:col-span-5 lg:col-start-8 lg:pt-10">
              {MOTIVOS.map((m, i) => (
                <li
                  key={m.titulo}
                  data-revelar
                  className={`${REVELAR} grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 border-t border-slate-200 py-7 last:border-b`}
                  style={espera(150 + i * 120)}
                >
                  <span className="pt-1 font-mono text-sm font-medium text-gold-700">{dois(i + 1)}</span>
                  <div>
                    <h3 className="text-lg font-semibold">{m.titulo}</h3>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{m.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Faixa corrida ────────────────────────────────────────────────── */}
        <div aria-hidden className="overflow-hidden border-y border-white/10 bg-ink-950 py-5">
          <div className={s.faixa}>
            {[0, 1].map((copia) => (
              <div key={copia} className="flex shrink-0 items-center">
                {TERMOS.map((t) => (
                  <span key={t} className="flex items-center gap-8 pr-8 font-mono text-sm uppercase tracking-[0.14em] text-white/70">
                    {t}
                    <span className="h-1.5 w-1.5 rotate-45 bg-gold-500" />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── O método ─────────────────────────────────────────────────────── */}
        <section id="metodo" className="relative scroll-mt-16 overflow-hidden bg-ink-900 text-white">
          <Papel escuro />
          <Folha n={3} escuro />
          <div className={`${CONTEUDO} relative py-24 lg:py-32`}>
            <div className="max-w-3xl">
              <div data-revelar className={REVELAR}>
                <Rubrica escuro>O método</Rubrica>
              </div>
              <h2 data-revelar className={`${REVELAR} mt-5 text-white ${TITULO}`} style={espera(80)}>
                Do pedido ao relatório, em quatro momentos.
              </h2>
              <p data-revelar className={`${REVELAR} mt-5 max-w-2xl text-[17px] leading-relaxed text-white/70`} style={espera(160)}>
                É o caminho que o curso ensina — e o mesmo que o sistema LEX segue, tela a tela.
              </p>
            </div>

            <div className="relative mt-16">
              <div aria-hidden className="absolute left-5 right-5 top-5 hidden h-px bg-white/15 lg:block" />
              <div
                aria-hidden
                data-revelar
                className="absolute left-5 right-5 top-5 hidden h-px origin-left bg-gold-500 transition-transform duration-[1600ms] ease-[cubic-bezier(0.65,0,0.35,1)] data-[oculto]:scale-x-0 lg:block"
              />
              <div aria-hidden className="absolute bottom-5 left-5 top-5 w-px bg-white/15 lg:hidden" />
              <div
                aria-hidden
                data-revelar
                className="absolute bottom-5 left-5 top-5 w-px origin-top bg-gold-500 transition-transform duration-[1600ms] ease-[cubic-bezier(0.65,0,0.35,1)] data-[oculto]:scale-y-0 lg:hidden"
              />
              <ol className="relative grid gap-12 lg:grid-cols-4 lg:gap-8">
                {MOMENTOS.map((m, i) => (
                  <li key={m.nome} data-revelar className={`${REVELAR} relative flex gap-5 lg:block`} style={espera(250 + i * 220)}>
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold-500/60 bg-ink-900 font-mono text-sm font-medium text-gold-400">
                      {dois(i + 1)}
                    </span>
                    <div className="pt-1.5 lg:mt-6 lg:pt-0">
                      <h3 className="text-xl font-semibold text-white">{m.nome}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-white/70">{m.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ── Conteúdo ─────────────────────────────────────────────────────── */}
        <section id="conteudo" className="relative scroll-mt-16 bg-white">
          <Folha n={4} />
          <div className={`${CONTEUDO} py-24 lg:py-32`}>
            <div className="grid gap-6 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-7">
                <div data-revelar className={REVELAR}>
                  <Rubrica>Conteúdo</Rubrica>
                </div>
                <h2 data-revelar className={`${REVELAR} mt-5 ${TITULO}`} style={espera(80)}>
                  O que você vai aprender
                </h2>
              </div>
              <p data-revelar className={`${REVELAR} text-[17px] leading-relaxed text-slate-600 lg:col-span-4 lg:col-start-9`} style={espera(160)}>
                Seis módulos, do fundamento legal ao relatório final que acompanha os autos.
              </p>
            </div>

            <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MODULOS.map((m, i) => (
                <li key={m.titulo} data-revelar className={REVELAR} style={espera((i % 3) * 110)}>
                  <div className="group relative h-full overflow-hidden rounded-2xl border border-slate-200 bg-canvas p-6 transition-[transform,box-shadow,background-color,border-color] duration-300 hover:-translate-y-1 hover:border-ink-100 hover:bg-white hover:shadow-raise">
                    <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] origin-top scale-y-0 bg-gold-500 transition-transform duration-500 group-hover:scale-y-100" />
                    <div className="flex items-start justify-between gap-4">
                      <span className="font-mono text-xs uppercase tracking-[0.14em] text-ink-500">Módulo {dois(i + 1)}</span>
                      <span aria-hidden className="font-mono text-4xl font-medium leading-none text-ink-100 transition-colors duration-300 group-hover:text-gold-500">
                        {dois(i + 1)}
                      </span>
                    </div>
                    <h3 className="mt-10 text-lg font-semibold leading-snug">{m.titulo}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{m.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Curso + sistema ──────────────────────────────────────────────── */}
        <section id="sistema" className="relative scroll-mt-16 overflow-hidden bg-ink-950 text-white">
          <Papel escuro />
          <Folha n={5} escuro />
          <div className={`${CONTEUDO} relative grid items-center gap-16 py-24 lg:grid-cols-12 lg:gap-10 lg:py-32`}>
            <div className="lg:col-span-5">
              <div data-revelar className={REVELAR}>
                <Rubrica escuro>Curso + sistema</Rubrica>
              </div>
              <h2 data-revelar className={`${REVELAR} mt-5 text-white ${TITULO}`} style={espera(80)}>
                Você não sai só com a teoria.
              </h2>
              <p data-revelar className={`${REVELAR} mt-5 text-[17px] leading-relaxed text-white/70`} style={espera(160)}>
                Quem assina usa o LEX, o sistema de pesquisa de preços com integração oficial. O que você aprende no curso vira rotina no seu
                órgão.
              </p>
              <ul className="mt-8 space-y-3.5">
                {RECURSOS.map((r, i) => (
                  <li key={r} data-revelar className={`${REVELAR} flex gap-3 text-[15px] leading-snug text-white/85`} style={espera(220 + i * 90)}>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold-500/50">
                      <Check className="h-3 w-3 text-gold-400" aria-hidden />
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
              <div data-revelar className={`${REVELAR} mt-10`} style={espera(560)}>
                <BotaoAssinar />
              </div>
            </div>
            <div data-revelar className={`${REVELAR} lg:col-span-7`} style={espera(200)}>
              <div className="transition-transform duration-700 ease-out lg:[transform:perspective(1600px)_rotateY(-11deg)_rotateX(4deg)] lg:hover:[transform:perspective(1600px)]">
                <TelaSistema />
              </div>
            </div>
          </div>
        </section>

        {/* ── Quem ensina ──────────────────────────────────────────────────── */}
        <section id="instrutor" className="relative scroll-mt-16 bg-canvas">
          <Papel />
          <Folha n={6} />
          <div className={`${CONTEUDO} relative grid items-center gap-16 py-24 lg:grid-cols-12 lg:gap-16 lg:py-32`}>
            <div data-revelar className={`${REVELAR} relative mx-auto w-full max-w-[400px] lg:col-span-5 lg:max-w-none`}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-gold-50 shadow-raise ring-1 ring-gold-100">
                <Papel />
                <Retrato foto={FOTO_ISRAEL} className="absolute inset-x-0 bottom-0 h-[92%] w-full" />
              </div>
              <Carimbo id="carimbo-instrutor" claro className="absolute -bottom-12 -right-4 h-32 w-32 sm:-right-10 sm:h-36 sm:w-36" />
            </div>
            <div className="lg:col-span-7">
              <div data-revelar className={REVELAR}>
                <Rubrica>Quem ensina</Rubrica>
              </div>
              <h2 data-revelar className={`${REVELAR} mt-5 ${TITULO}`} style={espera(80)}>
                Israel Evangelista
              </h2>
              <ul data-revelar className={`${REVELAR} mt-5 flex flex-wrap gap-2`} style={espera(140)}>
                {["Advogado", "Mestre em licitações", "Palestrante"].map((t) => (
                  <li key={t} className="rounded-full border border-ink-100 bg-white px-3.5 py-1.5 font-mono text-xs uppercase tracking-[0.1em] text-ink-800">
                    {t}
                  </li>
                ))}
              </ul>
              <div data-revelar className={`${REVELAR} mt-7 max-w-2xl space-y-4 text-[17px] leading-relaxed text-slate-700`} style={espera(200)}>
                <p>Advogado e mestre em licitações, Israel ministrou diversas palestras sobre contratações públicas.</p>
                <p>
                  Agora, reúne a sua metodologia em um curso próprio: o Lex Licitações. A ideia é levar para o dia a dia de quem faz a
                  contratação acontecer o método que ele apresenta nas palestras — com um sistema feito para aplicá-lo.
                </p>
              </div>
              <div data-revelar className={`${REVELAR} mt-9`} style={espera(280)}>
                <Link href={ACESSO} className="btn btn-primary group min-h-[52px] px-6 text-base">
                  Quero aprender com o Israel
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Despacho final ───────────────────────────────────────────────── */}
        <section id="assinar" className="relative scroll-mt-16 overflow-hidden bg-ink-900 text-white">
          <Papel escuro />
          <Folha n={7} escuro />
          <div className={`${CONTEUDO} relative grid items-center gap-12 py-28 lg:grid-cols-12 lg:py-36`}>
            <div className="lg:col-span-8">
              <div data-revelar className={REVELAR}>
                <Rubrica escuro>Despacho final</Rubrica>
              </div>
              <h2
                data-revelar
                className={`${REVELAR} mt-5 text-[2.5rem] font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-[3.5rem] lg:text-[4.25rem]`}
                style={espera(80)}
              >
                Pronto para aplicar o método no seu órgão?
              </h2>
              <p data-revelar className={`${REVELAR} mt-6 max-w-xl text-[17px] leading-relaxed text-white/70`} style={espera(160)}>
                Assine o Lex Licitações e leve o método do Israel para o dia a dia da sua equipe.
              </p>
              <div data-revelar className={`${REVELAR} mt-10`} style={espera(240)}>
                <BotaoAssinar grande />
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
                  Você vai para a área de acesso do sistema. Primeiro acesso? Lá mesmo você cadastra o seu órgão.
                </p>
              </div>
            </div>
            <div className="hidden lg:col-span-4 lg:flex lg:justify-end">
              <Carimbo id="carimbo-final" className="h-60 w-60" />
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-ink-950 text-white/60">
        <div className={`${CONTEUDO} flex flex-col gap-2 py-8 text-xs sm:flex-row sm:items-center sm:justify-between`}>
          <p>© {new Date().getFullYear()} Lex Licitações — um produto NOVAGENTE.</p>
          <p className="font-mono">Lei nº 14.133/2021 · IN SEGES nº 65/2021</p>
        </div>
      </footer>
    </div>
  );
}
