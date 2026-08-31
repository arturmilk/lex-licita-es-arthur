"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { FONTES_CONFIG } from "@/lib/sources";
import type { FonteId } from "@/lib/sources";

const FONTE_ICONES: Record<string, string> = {
  pncp: "",
  painel_precos: "",
  compras_gov: "",
  bps: "",
  sinapi: "",
  sicro: "",
  manual: "",
};

interface Props {
  selecionadas: FonteId[];
  onChange: (fontes: FonteId[]) => void;
  termoBusca?: string;
}

export default function FonteSelectorPanel({ selecionadas, onChange, termoBusca }: Props) {
  function toggle(id: FonteId) {
    if (selecionadas.includes(id)) {
      onChange(selecionadas.filter((f) => f !== id));
    } else {
      onChange([...selecionadas, id]);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
        Fontes de pesquisa
      </p>
      <div className="grid grid-cols-1 gap-2">
        {FONTES_CONFIG.map((fonte) => {
          const ativa = selecionadas.includes(fonte.id);
          return (
            <button
              key={fonte.id}
              type="button"
              onClick={() => toggle(fonte.id)}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                ativa
                  ? "border-neutral-800 bg-neutral-900 text-white"
                  : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              <span className="text-xl">{FONTE_ICONES[fonte.id] || ""}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${ativa ? "text-white" : "text-neutral-800"}`}>
                  {fonte.nome}
                </p>
                <p className={`text-xs truncate ${ativa ? "text-neutral-300" : "text-neutral-500"}`}>
                  {fonte.descricao}
                </p>
              </div>
              {ativa && <Check className="w-4 h-4 text-white flex-shrink-0" />}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-neutral-400">
        {selecionadas.length} fonte(s) selecionada(s)
      </p>
    </div>
  );
}
