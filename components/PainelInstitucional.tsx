import Link from "next/link";

/**
 * Painel institucional das telas de acesso (login e cadastro).
 * Em vez de formas decorativas, mostra o próprio trâmite do LEX — os quatro
 * momentos da pesquisa de preços — sobre uma pauta discreta de documento.
 */
const MOMENTOS = [
  { nome: "Preparar", texto: "Conte o que precisa comprar ou contratar, do seu jeito." },
  { nome: "Precificação", texto: "Fontes oficiais como PNCP e Compras.gov.br." },
  { nome: "Conferir preços", texto: "Aceite ou rejeite referências e veja a estatística da amostra." },
  { nome: "Fechar relatório", texto: "PDF e planilha XLSX com a memória de cálculo." },
];

export function PainelInstitucional({
  titulo = "Pesquisa de preços para contratações públicas.",
  texto = "Do pedido ao relatório final, com fontes oficiais e memória de cálculo pronta para o processo.",
}: {
  titulo?: string;
  texto?: string;
}) {
  const pauta = "linear-gradient(to bottom, transparent, #000 18%, #000 72%, transparent)";
  return (
    <aside className="relative hidden w-[46%] max-w-[660px] shrink-0 flex-col justify-between overflow-hidden bg-ink-900 px-12 py-10 text-white lg:flex xl:px-16">
      {/* Pauta de documento: linhas de 1px a cada 32px, esmaecendo nas bordas */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 32px)",
          maskImage: pauta,
          WebkitMaskImage: pauta,
        }}
      />
      {/* Margem do documento: fio dourado vertical */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-8 w-px bg-gold-500/25 xl:left-10" />

      <Link href="/" className="relative flex w-fit items-center gap-3 rounded-lg focus-visible:outline-white">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm">
          <img src="/logo-lex.png" alt="" className="h-8 w-8 object-contain" />
        </span>
        <span className="text-lg font-semibold tracking-[-0.01em]">LEX Licitações</span>
      </Link>

      <div className="relative py-12">
        <p className="max-w-lg text-[2.5rem] font-semibold leading-[1.08] tracking-[-0.03em] [text-wrap:balance]">{titulo}</p>
        <p className="mt-5 max-w-md text-base leading-relaxed text-white/70">{texto}</p>

        <ol className="mt-10 max-w-md" aria-label="Como funciona">
          {MOMENTOS.map((m, i) => (
            <li key={m.nome} className="relative flex gap-4 pb-6 last:pb-0">
              {i < MOMENTOS.length - 1 && <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-px bg-white/15" />}
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold-500/50 bg-ink-900 font-mono text-[13px] font-medium text-gold-400">
                {i + 1}
              </span>
              <div className="pt-1">
                <p className="text-[15px] font-semibold">{m.nome}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/60">{m.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <p className="relative text-xs text-white/50">
        Conforme a IN SEGES nº 65/2021 · © {new Date().getFullYear()} LEX Licitações — um produto NOVAGENTE.
      </p>
    </aside>
  );
}
