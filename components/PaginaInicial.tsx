import Link from "next/link";
import { ArrowRight, Check, ImageIcon, LogIn, Play } from "lucide-react";
import { LINK_ASSINATURA, TESTE_GRATIS } from "@/lib/assinatura";

/**
 * Página inicial pública (visitante): o curso em 70% e o sistema em 30%.
 * Conceito: o folder do curso em papel timbrado — à esquerda, o curso diagramado como
 * documento (ementa numerada como sumário, fotos como anexos); à direita, o cartão
 * azul-marinho do LEX com a única ação dourada da página: "Assine já".
 *
 * Vídeo e fotos são espaços reservados até o material chegar: para usar uma foto,
 * preencha `src` no item de FOTOS; o vídeo entra no lugar de <EspacoVideo />.
 */

const CURSO = {
  titulo: "Pesquisa de preços nas contratações públicas",
  chamada:
    "Aprenda a montar uma pesquisa de preços que se sustenta no processo — com fontes oficiais, análise crítica da amostra e memória de cálculo, como pedem a Lei nº 14.133/2021 e a IN SEGES nº 65/2021.",
  sobre: [
    "A pesquisa de preços é uma das etapas que mais geram dúvida na contratação. O curso percorre o caminho inteiro — do pedido do setor requisitante ao preço estimado — com exemplos do dia a dia do setor de compras.",
    "Você sai sabendo quais fontes usar, como tratar os valores que destoam da amostra e como registrar cada escolha para que a pesquisa se sustente no processo.",
  ],
  publico: ["Agentes de contratação", "Pregoeiros", "Equipes de planejamento", "Setores de compras"],
};

const EMENTA = [
  { titulo: "A pesquisa de preços no processo", texto: "Onde ela entra no planejamento da contratação, segundo a Lei nº 14.133/2021 e a IN SEGES nº 65/2021." },
  { titulo: "Parâmetros e fontes oficiais", texto: "Painel de Preços e PNCP, contratações similares, mídia especializada, fornecedores e notas fiscais eletrônicas." },
  { titulo: "Como montar a cesta de preços", texto: "Escolher referências comparáveis ao objeto e registrar a origem de cada uma." },
  { titulo: "Análise crítica da amostra", texto: "Identificar valores inexequíveis, inconsistentes ou excessivamente elevados — e justificar a exclusão." },
  { titulo: "Métodos de cálculo", texto: "Média, mediana ou menor preço, e o que o coeficiente de variação diz sobre a amostra." },
  { titulo: "Documentação para o processo", texto: "Justificativas, memória de cálculo e o relatório final que acompanha os autos." },
];

const FOTOS: { src?: string; alt: string }[] = Array.from({ length: 6 }, (_, i) => ({ alt: `Foto ${i + 1} do curso` }));

const FONTES_OFICIAIS = ["PNCP", "Compras.gov.br", "Contratos.gov.br"];

const RECURSOS = ["Pesquisa guiada, passo a passo", "Análise crítica da amostra", "Relatório em PDF e XLSX", "Assistente com IA"];

const dois = (n: number) => String(n).padStart(2, "0");

/** Pauta de documento (linhas de 1px) — a mesma assinatura do painel do login. */
function Pauta({ clara = false }: { clara?: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${clara ? "opacity-[0.06]" : "opacity-[0.04]"}`}
      style={{
        backgroundImage: clara
          ? "repeating-linear-gradient(to bottom, #032650 0 1px, transparent 1px 24px)"
          : "repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 32px)",
      }}
    />
  );
}

function EspacoVideo() {
  return (
    <div
      role="img"
      aria-label="Espaço reservado para o vídeo de apresentação do curso"
      className="relative mt-8 aspect-video overflow-hidden rounded-2xl bg-ink-950 text-white shadow-raise"
    >
      <Pauta />
      <div aria-hidden className="absolute inset-y-0 left-6 w-px bg-gold-500/25 sm:left-8" />
      <div className="relative flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-gold-500/50 bg-white/[0.04] sm:h-[4.5rem] sm:w-[4.5rem]">
          <Play className="ml-1 h-6 w-6 fill-gold-400 text-gold-400" aria-hidden />
        </span>
        <div>
          <p className="text-[15px] font-semibold">Vídeo de apresentação</p>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em] text-white/60">Em breve</p>
        </div>
      </div>
    </div>
  );
}

function CabecalhoSecao({ id, titulo, texto }: { id: string; titulo: string; texto?: string }) {
  return (
    <>
      <h2 id={id} className="text-xl font-semibold tracking-[-0.015em] sm:text-[1.375rem]">{titulo}</h2>
      {texto && <p className="mt-1.5 text-[15px] text-slate-600">{texto}</p>}
    </>
  );
}

function CartaoSistema() {
  return (
    // Acompanha a rolagem só quando cabe inteiro na tela (~670px de altura; ~735px em 1024px de largura).
    <aside
      aria-labelledby="sistema-titulo"
      className="relative animate-entrar self-start overflow-hidden rounded-2xl bg-ink-900 text-white shadow-raise lg:col-start-2 lg:row-span-4 lg:row-start-1 lg:top-[5.5rem] lg:[@media(min-height:840px)]:sticky xl:[@media(min-height:780px)]:sticky"
    >
      <Pauta />
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-4 w-px bg-gold-500/25" />

      <div className="relative px-7 py-6 sm:px-9 lg:px-7">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-gold-400">O sistema</p>
        <h2 id="sistema-titulo" className="mt-3 text-2xl font-semibold leading-[1.15] tracking-[-0.02em] text-white">
          Pesquisa de preços com integração oficial
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">
          O LEX consulta as bases oficiais e organiza a pesquisa do pedido ao relatório final.
        </p>

        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Bases oficiais integradas">
          {FONTES_OFICIAIS.map((f) => (
            <li key={f} className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-1 font-mono text-xs text-white/90">
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-6 border-t border-white/10 pt-6">
          <p className="inline-flex items-center rounded-full border border-gold-500/50 px-3 py-1 font-mono text-xs font-medium uppercase tracking-[0.12em] text-gold-400">
            Teste grátis · {TESTE_GRATIS}
          </p>
          <p className="mt-3 text-sm text-white/70">Cadastre o órgão e comece na hora.</p>
          <Link
            href={LINK_ASSINATURA}
            className="btn mt-4 w-full bg-gold-500 text-[15px] text-ink-950 shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-gold-400 active:bg-gold-600 focus-visible:ring-white/40"
          >
            Assine já <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-3 text-center text-[13px] text-white/60">
            Já é assinante?{" "}
            <Link href="/login" className="font-semibold text-white underline underline-offset-4 hover:text-gold-400 focus-visible:outline-white">
              Faça login
            </Link>
          </p>
        </div>

        <div className="mt-6 border-t border-white/10 pt-6">
          <p className="text-xs font-medium text-white/60">O que o LEX faz</p>
          <ul className="mt-3 space-y-2.5">
            {RECURSOS.map((r) => (
              <li key={r} className="flex gap-2.5 text-sm leading-snug text-white/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

export function PaginaInicial() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-content items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-h-[44px] items-center gap-3 rounded-lg">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-card ring-1 ring-slate-200">
              <img src="/logo-lex.png" alt="" className="h-7 w-7 object-contain" />
            </span>
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink-950">LEX Licitações</span>
          </Link>
          <Link href="/login" className="btn btn-outline">
            <LogIn className="h-4 w-4" aria-hidden /> Faça login
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-content gap-x-10 gap-y-12 px-4 pb-16 pt-8 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)] lg:px-8 lg:pt-12 xl:gap-x-14">
        {/* 70% — o curso */}
        <section aria-labelledby="curso-titulo" className="animate-entrar lg:col-start-1">
          <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">
            <span aria-hidden className="h-px w-6 bg-gold-500" /> Curso
          </p>
          <h1
            id="curso-titulo"
            className="mt-3 max-w-3xl text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[2.5rem] xl:text-[2.75rem]"
          >
            {CURSO.titulo}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-[17px]">{CURSO.chamada}</p>
          <EspacoVideo />
        </section>

        {/* 30% — o sistema. No celular vem logo depois da abertura do curso. */}
        <CartaoSistema />

        <section aria-labelledby="sobre-titulo" className="border-t border-slate-200 pt-10 lg:col-start-1">
          <CabecalhoSecao id="sobre-titulo" titulo="Sobre o curso" />
          <div className="mt-4 max-w-[68ch] space-y-4 text-[15px] leading-relaxed text-slate-700">
            {CURSO.sobre.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <h3 className="mt-7 text-sm font-semibold">Para quem é</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {CURSO.publico.map((p) => (
              <li key={p} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[13px] text-slate-700">
                {p}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ementa-titulo" className="border-t border-slate-200 pt-10 lg:col-start-1">
          <CabecalhoSecao id="ementa-titulo" titulo="Ementa" texto="O que você vai aprender." />
          <ol className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            {EMENTA.map((m, i) => (
              <li
                key={m.titulo}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-b border-slate-100 px-5 py-4 last:border-0 sm:grid-cols-[3rem_minmax(0,1fr)] sm:px-6 sm:py-5"
              >
                <span className="pt-px font-mono text-sm font-medium tabular-nums text-gold-700">{dois(i + 1)}</span>
                <div>
                  <h3 className="text-[15px] font-semibold">{m.titulo}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{m.texto}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="fotos-titulo" className="border-t border-slate-200 pt-10 lg:col-start-1">
          <CabecalhoSecao id="fotos-titulo" titulo="Fotos do curso" texto="Registros de turmas do curso." />
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FOTOS.map((foto, i) => (
              <li key={foto.alt} className={i === 0 ? "sm:col-span-2 sm:row-span-2" : undefined}>
                {foto.src ? (
                  <img
                    src={foto.src}
                    alt={foto.alt}
                    className={`h-full w-full rounded-xl object-cover ${i === 0 ? "aspect-[4/3] sm:aspect-auto" : "aspect-[4/3]"}`}
                  />
                ) : (
                  <div
                    role="img"
                    aria-label={`${foto.alt} (espaço reservado)`}
                    className={`relative flex h-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white ${i === 0 ? "aspect-[4/3] sm:aspect-auto" : "aspect-[4/3]"}`}
                  >
                    <Pauta clara />
                    <ImageIcon className={`relative text-slate-400 ${i === 0 ? "h-8 w-8" : "h-6 w-6"}`} aria-hidden />
                    <span className="absolute bottom-2.5 left-3 font-mono text-xs text-slate-500">Foto {dois(i + 1)}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <p className="mx-auto max-w-content px-4 py-6 text-xs text-slate-500 sm:px-6 lg:px-8">
          Conforme a IN SEGES nº 65/2021 · © {new Date().getFullYear()} LEX Licitações — um produto NOVAGENTE.
        </p>
      </footer>
    </div>
  );
}
