/**
 * Análise crítica das referências de preço (Nível 1 — estatístico/determinístico).
 *
 * Objetivo (documento de melhorias do cliente): ao calcular e analisar, o sistema
 * deve gerar uma comparação entre as contratações — explicando diferenças de valor
 * sem "inventar" motivos. Tudo aqui é determinístico e baseado nos dados reais das
 * referências (quantidade, unidade, região, data), com linguagem de hipótese:
 * "esta referência está X% acima da mediana — possível causa: quantidade menor".
 *
 * Quem usa: funcionário que realiza a licitação (pregoeiro). O texto gerado serve
 * como apoio à justificativa, nunca como conclusão automática.
 */

export interface ReferenciaAnalise {
  id: string;
  orgao: string;
  descricao: string;
  quantidade: number | null;
  unidadeMedida?: string | null;
  dataContrato?: string | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  localizacao?: string | null;
  regiao?: string | null;
  similaridade?: number | null;
  itemId?: string | null;
}

export interface PontoAnalise {
  severidade: "info" | "atencao" | "alerta";
  titulo: string;
  detalhe: string;
  refId?: string;
}

export interface ResultadoAnaliseCritica {
  pontos: PontoAnalise[];
  resumo: string;
  sugestaoJustificativa: string;
  forcaDispersao: "baixa" | "media" | "alta";
}

/** Mapa UF → região para inferir região quando só temos a UF na localização. */
const UF_REGIAO: Record<string, string> = {
  AC: "norte", AM: "norte", AP: "norte", PA: "norte", RO: "norte", RR: "norte", TO: "norte",
  AL: "nordeste", BA: "nordeste", CE: "nordeste", MA: "nordeste", PB: "nordeste", PE: "nordeste", PI: "nordeste", RN: "nordeste", SE: "nordeste",
  DF: "centro_oeste", GO: "centro_oeste", MT: "centro_oeste", MS: "centro_oeste",
  ES: "sudeste", MG: "sudeste", RJ: "sudeste", SP: "sudeste",
  PR: "sul", RS: "sul", SC: "sul",
};

function extrairUF(localizacao?: string | null): string | null {
  if (!localizacao) return null;
  const m = localizacao.toUpperCase().match(/\b([A-Z]{2})\b/);
  return m ? m[1] : null;
}

function regiaoDe(localizacao?: string | null): string | null {
  const uf = extrairUF(localizacao);
  return uf ? UF_REGIAO[uf] ?? null : null;
}

export function analisarReferencias(refs: ReferenciaAnalise[]): ResultadoAnaliseCritica {
  const pontos: PontoAnalise[] = [];
  const comValor = refs.filter((r) => r.valorUnitario != null || r.valorTotal != null);

  if (comValor.length < 2) {
    return {
      pontos: [{ severidade: "info", titulo: "Referências insuficientes", detalhe: "São necessárias ao menos 2 referências com valor para uma análise crítica comparativa." }],
      resumo: "Análise crítica não aplicável: poucas referências com valor.",
      sugestaoJustificativa: "",
      forcaDispersao: "baixa",
    };
  }

  // Valor de referência: unitário quando disponível (compara preço justo), senão total
  const valores = comValor.map((r) => (r.valorUnitario ?? r.valorTotal) as number);
  const ordenados = [...valores].sort((a, b) => a - b);
  const mediana = ordenados.length % 2 === 0
    ? (ordenados[ordenados.length / 2 - 1] + ordenados[ordenados.length / 2]) / 2
    : ordenados[Math.floor(ordenados.length / 2)];
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  const dp = Math.sqrt(valores.reduce((a, v) => a + (v - media) ** 2, 0) / valores.length);
  const cv = media === 0 ? 0 : (dp / media) * 100;

  const forcaDispersao: "baixa" | "media" | "alta" = cv < 15 ? "baixa" : cv < 35 ? "media" : "alta";

  // 1. Outliers (≥60% acima ou ≥40% abaixo da mediana)
  for (const r of comValor) {
    const v = (r.valorUnitario ?? r.valorTotal) as number;
    if (mediana === 0) continue;
    const pct = ((v - mediana) / mediana) * 100;
    if (pct >= 60) {
      const causas = [];
      if (r.quantidade != null && r.quantidade < 10) causas.push("quantidade reduzida no contrato");
      const reg = regiaoDe(r.localizacao);
      if (reg === "norte" || reg === "nordeste") causas.push(`região ${reg} (logística/distância de centros)`);
      pontos.push({
        severidade: "alerta",
        titulo: `Referência ${pct.toFixed(0)}% acima da mediana`,
        detalhe: `${r.orgao} — R$ ${v.toLocaleString("pt-BR")}${r.quantidade != null ? ` (qtd ${r.quantidade})` : ""}${r.localizacao ? ` · ${r.localizacao}` : ""}.${causas.length ? ` Possíveis razões observáveis: ${causas.join("; ")}.` : " Verificar especificação técnica no edital de origem."}`,
        refId: r.id,
      });
    } else if (pct <= -40) {
      const causas = [];
      if (r.quantidade != null && r.quantidade >= 100) causas.push("economia de escala (lote grande)");
      const reg = regiaoDe(r.localizacao);
      if (reg === "sudeste" || reg === "sul") causas.push(`região ${reg} (proximidade de grandes centros)`);
      pontos.push({
        severidade: "atencao",
        titulo: `Referência ${Math.abs(pct).toFixed(0)}% abaixo da mediana`,
        detalhe: `${r.orgao} — R$ ${v.toLocaleString("pt-BR")}${r.quantidade != null ? ` (qtd ${r.quantidade})` : ""}${r.localizacao ? ` · ${r.localizacao}` : ""}.${causas.length ? ` Possíveis razões observáveis: ${causas.join("; ")}.` : " Verificar se a especificação é equivalente."}`,
        refId: r.id,
      });
    }
  }

  // 2. Dispersão geral
  if (cv >= 35) {
    pontos.push({
      severidade: "alerta",
      titulo: `Alta dispersão entre as referências (CV ${cv.toFixed(1)}%)`,
      detalhe: "As referências variam muito entre si. Recomenda-se verificar especificações técnicas (marca/modelo, capacidade, instalação), unidades de medida (resma vs caixa) e regiões antes de adotar a média.",
    });
  } else if (cv >= 15) {
    pontos.push({
      severidade: "atencao",
      titulo: `Dispersão moderada entre as referências (CV ${cv.toFixed(1)}%)`,
      detalhe: "As referências apresentam variação relevante. Verifique se há diferenças de especificação, unidade de medida ou região.",
    });
  } else {
    pontos.push({
      severidade: "info",
      titulo: "Referências consistentes",
      detalhe: `Dispersão baixa (CV ${cv.toFixed(1)}%) — as referências são coerentes entre si.`,
    });
  }

  // 3. Diferença entre maior e menor
  const menor = ordenados[0];
  const maior = ordenados[ordenados.length - 1];
  if (maior > 0 && menor > 0) {
    const razao = maior / menor;
    if (razao >= 2) {
      pontos.push({
        severidade: "alerta",
        titulo: `Maior referência é ${razao.toFixed(1)}x a menor`,
        detalhe: `R$ ${menor.toLocaleString("pt-BR")} vs R$ ${maior.toLocaleString("pt-BR")}. Diferença expressiva — investigar quantidade, unidade de medida (ex.: resma individual vs fardo), região e especificação técnica.`,
      });
    }
  }

  // 4. Diversidade regional
  const regioes = new Set(comValor.map((r) => regiaoDe(r.localizacao)).filter(Boolean));
  if (regioes.size >= 2) {
    pontos.push({
      severidade: "info",
      titulo: `Referências de ${regioes.size} regiões diferentes`,
      detalhe: `Regiões identificadas: ${Array.from(regioes).join(", ")}. Preços podem variar por logística — considere priorizar referências da região do órgão.`,
    });
  }

  // 5. Normalização de unidade (melhoria): resma vs caixa/fardo/pacote
  // Detecta quando a unidade de medida difere entre referências e aponta
  // o risco de comparação indevida — o caso clássico "resma R$ 15 vs caixa R$ 63".
  const unidades = new Map<string, { n: number; exemplos: string[] }>();
  for (const r of comValor) {
    const un = (r.unidadeMedida || r.descricao || "").toLowerCase();
    const chave = /(resma|pacote com|caixa com|fardo|cx\b|bloco)/.test(un)
      ? (un.match(/(resma|pacote com|caixa com|fardo|bloco)/) || ["outra"])[0]
      : "unidade_avulsa";
    if (!unidades.has(chave)) unidades.set(chave, { n: 0, exemplos: [] });
    const e = unidades.get(chave)!;
    e.n += 1;
    if (e.exemplos.length < 2) e.exemplos.push(`${r.orgao} (${un || "un"})`);
  }
  if (unidades.size >= 2) {
    const descricao = Array.from(unidades.entries())
      .map(([k, v]) => `${k}: ${v.n} ref(s) [${v.exemplos.join("; ")}]`)
      .join(" · ");
    pontos.push({
      severidade: "alerta",
      titulo: "Unidades de medida diferentes entre as referências",
      detalhe: `${descricao}. Verifique se todas as referências são comparáveis — uma "resma" não pode ser comparada diretamente a uma "caixa com 10 resmas". Considere normalizar o preço para a mesma unidade antes de calcular a média.`,
    });
  }

  // 6. Alerta de aceitabilidade (Lei 14.133/2021, art. 23 §1º): critério de
  // aceitabilidade de preços — a proposta com preço acima do parâmetro deve
  // ser rejeitada. Aqui sinalizamos referências muito acima da mediana.
  const acimaAceitavel = comValor.filter((r) => {
    const v = (r.valorUnitario ?? r.valorTotal) as number;
    return mediana > 0 && (v - mediana) / mediana > 0.30; // >30% acima da mediana
  });
  if (acimaAceitavel.length > 0) {
    pontos.push({
      severidade: "atencao",
      titulo: `Referências ${acimaAceitavel.length} acima de 30% da mediana (critério de aceitabilidade)`,
      detalhe: "A Lei nº 14.133/2021 (art. 23, §1º) permite rejeitar propostas com preço manifestamente acima do parâmetro. Referências muito acima da mediana merecem verificação de especificação antes de entrarem na base de cálculo.",
    });
  }

  // Resumo + sugestão de justificativa
  const n = comValor.length;
  const resumo = `${n} referência(s) aceita(s) · mediana R$ ${mediana.toLocaleString("pt-BR")} · média R$ ${media.toLocaleString("pt-BR")} · CV ${cv.toFixed(1)}% (dispersão ${forcaDispersao}).`;

  const sugestaoJustificativa = [
    `Para a estimativa de preços, foram utilizadas ${n} referência(s) de contratações públicas, com valores unitários e totais coletados no PNCP.`,
    `A mediana calculada foi de R$ ${mediana.toLocaleString("pt-BR")}, com coeficiente de variação de ${cv.toFixed(1)}%, indicando ${forcaDispersao === "baixa" ? "boa consistência" : forcaDispersao === "media" ? "dispersão moderada, verificada e considerada aceitável" : "dispersão elevada — foram adotados critérios conservadores"} entre as referências.`,
    pontos.filter((p) => p.severidade !== "info").length > 0
      ? "Diferenças entre as referências foram analisadas quanto a quantidade contratada, unidade de medida e região de origem, conforme metodologia de pesquisa de preços."
      : "As referências apresentam valores coerentes entre si, sem discrepâncias relevantes.",
  ].filter(Boolean).join(" ");

  return { pontos, resumo, sugestaoJustificativa, forcaDispersao };
}
