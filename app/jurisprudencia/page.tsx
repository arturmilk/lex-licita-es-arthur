"use client";
import React, { useState } from "react";
import { Scale, Loader2, ExternalLink, Search } from "lucide-react";
import { buscarJulgadosMulti } from "@/lib/julgados";
import { CabecalhoPagina } from "@/components/Pagina";

interface Julgado {
  tribunal: string;
  numero: string;
  relator: string;
  orgaoJulgador: string;
  ementa: string;
  link: string;
  assunto: string;
}

const EXEMPLOS = ["exigência de atestados", "prazo de entrega", "cláusula restritiva", "ar-condicionado", "sobrepreço"];

export default function JurisprudenciaPage() {
  const [termo, setTermo] = useState("");
  const [buscado, setBuscado] = useState("");
  const [resultados, setResultados] = useState<Julgado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = async (t = termo) => {
    const q = t.trim();
    if (q.length < 3) return;
    setTermo(q);
    setBuscando(true);
    setResultados(null);
    setErro(null);
    try {
      const r = await buscarJulgadosMulti(q, 10);
      setResultados(r);
      setBuscado(q);
      if (r.length === 0) setErro("Nenhum julgado encontrado. Tente outro termo — o TCU pode estar limitando consultas; aguarde alguns segundos e tente de novo.");
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div>
      <CabecalhoPagina
        titulo="Jurisprudência"
        descricao="Acórdãos do TCU e do TCE-RO sobre um assunto ou objeto — para fundamentar o edital, a justificativa e os recursos."
      />

      <div className="card p-5">
        <form onSubmit={(e) => { e.preventDefault(); buscar(); }} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="termo-julgado" className="sr-only">Assunto ou objeto</label>
          <div className="relative flex-1">
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              id="termo-julgado"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Assunto ou objeto (ex.: exigência de atestados)"
              className="inp pl-10"
            />
          </div>
          <button type="submit" disabled={buscando || termo.trim().length < 3} className="btn btn-primary">
            {buscando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Scale size={16} aria-hidden />}
            Buscar julgados
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Temas frequentes:</span>
          {EXEMPLOS.map((ex) => (
            <button key={ex} type="button" onClick={() => buscar(ex)} className="chip">{ex}</button>
          ))}
        </div>
      </div>

      {erro && (
        <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{erro}</div>
      )}

      {buscando && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center" role="status">
          <Loader2 size={26} className="animate-spin text-ink-700" aria-hidden />
          <p className="text-sm text-slate-600">Consultando TCU e TCE-RO…</p>
        </div>
      )}

      {resultados && resultados.length > 0 && !buscando && (
        <section className="mt-8" aria-labelledby="julgados-titulo">
          <h2 id="julgados-titulo" className="mb-4 text-sm text-slate-600">
            <b className="font-semibold text-ink-950">{resultados.length}</b> {resultados.length === 1 ? "julgado encontrado" : "julgados encontrados"} para “{buscado}”
          </h2>
          <ul className="space-y-3">
            {resultados.map((j, i) => (
              <li key={i} className="card card-hover p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide ${j.tribunal === "tcu" ? "bg-ink-900 text-white" : "bg-ink-50 text-ink-800 ring-1 ring-ink-100"}`}>
                        {j.tribunal === "tcu" ? "TCU" : "TCE-RO"}
                      </span>
                      <p className="text-[15px] font-semibold text-ink-950">
                        Acórdão <span className="font-mono text-[14px] font-medium">{j.numero}</span>
                      </p>
                      {j.orgaoJulgador && <span className="text-[13px] text-slate-500">· {j.orgaoJulgador}</span>}
                    </div>
                    {(j.relator && j.relator !== "—") || j.assunto ? (
                      <p className="mt-1.5 text-[13px] text-slate-500">
                        {j.relator && j.relator !== "—" && <>Relator: {j.relator}</>}
                        {j.relator && j.relator !== "—" && j.assunto && " · "}
                        {j.assunto && <>Assunto: {j.assunto.slice(0, 120)}</>}
                      </p>
                    ) : null}
                    <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-700">
                      {j.ementa.slice(0, 350)}{j.ementa.length > 350 ? "…" : ""}
                    </p>
                  </div>
                  <a href={j.link} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm min-h-[44px] shrink-0 self-start">
                    Abrir julgado <ExternalLink size={14} aria-hidden />
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!resultados && !buscando && !erro && (
        <div className="mt-8 flex items-start gap-4 rounded-xl border border-dashed border-slate-300 px-5 py-5 text-sm text-slate-600">
          <span className="icon-tile" aria-hidden><Scale size={18} /></span>
          <p className="max-w-2xl leading-relaxed">
            Busque pelo <b className="font-semibold text-ink-950">assunto</b> (ex.: exigência de atestados) ou pelo{" "}
            <b className="font-semibold text-ink-950">objeto</b> da contratação (ex.: ar-condicionado). Cada resultado traz a ementa e o link para o acórdão completo.
          </p>
        </div>
      )}
    </div>
  );
}
