"use client";
import React, { useState } from "react";
import { Scale, Loader2, ExternalLink, Search } from "lucide-react";
import { buscarJulgadosMulti } from "@/lib/julgados";

interface Julgado {
  tribunal: string;
  numero: string;
  relator: string;
  orgaoJulgador: string;
  ementa: string;
  link: string;
  assunto: string;
}

export default function JurisprudenciaPage() {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<Julgado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = async () => {
    if (termo.trim().length < 3) return;
    setBuscando(true);
    setResultados(null);
    setErro(null);
    try {
      const r = await buscarJulgadosMulti(termo.trim(), 10);
      setResultados(r);
      if (r.length === 0) setErro("Nenhum julgado encontrado. Tente outro termo (o TCU pode estar limitando consultas — aguarde alguns segundos e tente de novo).");
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-1">⚖️ Jurisprudência (TCU / TCE-RO)</h1>
      <p className="text-sm text-slate-500 mb-6">
        Busque acórdãos sobre um assunto ou objeto — servem de parâmetro para fundamentar o edital, a justificativa e recursos.
      </p>

      <div className="flex gap-2 mb-6">
        <input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && buscar()}
          placeholder="Ex.: exigência de atestados, prazo de entrega, cláusula restritiva, ar-condicionado..."
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-400 text-sm"
        />
        <button
          onClick={buscar}
          disabled={buscando}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 cursor-pointer disabled:opacity-50"
        >
          {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar julgados
        </button>
      </div>

      {erro && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{erro}</div>}

      {buscando && (
        <div className="flex items-center justify-center py-16 gap-3">
          <Loader2 size={24} className="animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">Consultando TCU e TCE-RO…</p>
        </div>
      )}

      {resultados && resultados.length > 0 && !buscando && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {resultados.length} julgado(s) encontrados para "{termo}"
          </p>
          {resultados.map((j, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-indigo-200 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${j.tribunal === "tcu" ? "bg-indigo-100 text-indigo-700" : "bg-rose-100 text-rose-700"}`}>
                      {j.tribunal === "tcu" ? "TCU" : "TCE-RO"}
                    </span>
                    <p className="text-sm font-bold text-slate-800">Acórdão {j.numero}</p>
                    {j.orgaoJulgador && <span className="text-[11px] text-slate-400">· {j.orgaoJulgador}</span>}
                  </div>
                  {j.relator && j.relator !== "—" && (
                    <p className="text-[11px] text-slate-500 mt-0.5">Rel. {j.relator}</p>
                  )}
                  {j.assunto && <p className="text-[11px] text-slate-400 mt-0.5">Assunto: {j.assunto.slice(0, 120)}</p>}
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">{j.ementa.slice(0, 350)}{j.ementa.length > 350 ? "…" : ""}</p>
                </div>
                <a
                  href={j.link}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg"
                >
                  Abrir julgado <ExternalLink size={11} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
