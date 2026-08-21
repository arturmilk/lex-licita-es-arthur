import * as XLSX from "xlsx";

function fm(v: number) { return v == null || isNaN(v) ? "" : "R$ " + v.toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

export function gerarXLSX(dados: any): Uint8Array {
  const wb = XLSX.utils.book_new();
  wb.Props = { Title: "Estimativa " + dados.processo.numero, Subject: "Pesquisa de Precos", Author: "Estima.IA", CreatedDate: new Date() };

  // --- Aba 1: Resumo ---
  const resumoData = [
    ["Estima.IA - Pesquisa de Precos"], [],
    ["RESPONSAVEL E IDENTIFICACAO"],
    ["Nome", dados.responsavel || dados.processo.responsavel],
    ["E-mail / Login", dados.email || dados.processo.email],
    ["Orgao", dados.processo.orgao],
    ["Unidade", dados.processo.unidade],
    ["Processo", dados.processo.numero],
    ["Data do relatorio", new Date().toLocaleDateString("pt-BR")],
    [],
    ["OBJETO"],
    ["Descricao", dados.objeto],
    ["Quantidade", dados.quantidade],
    ["Unidade de medida", dados.premissas?.unidadeMedida || ""],
    ["Forma de parcelamento", dados.premissas?.formaParcelamento || ""],
    ["Local de entrega", dados.premissas?.localEntrega || ""],
    ["Metodo de calculo (efetivo)", dados.metodo],
    dados.premissas?.alertaCv ? ["Alerta de CV", `CV ${(dados.premissas.alertaCv.cv || 0).toFixed(1)}% acima do limite (${dados.premissas.alertaCv.limite}%) — menor preco aplicado automaticamente`] : [],
    [],
    ["ESTATISTICAS"],
    ["Referencias aceitas", dados.estatisticas.n],
    ...(dados.premissas?.parametrosRelatorio?.exibirMedia !== false ? [["Media", dados.estatisticas.media]] : []),
    ["Mediana", dados.estatisticas.mediana],
    ...(dados.premissas?.parametrosRelatorio?.exibirMinimo !== false ? [["Minimo", dados.estatisticas.minimo]] : []),
    ...(dados.premissas?.parametrosRelatorio?.exibirMaximo !== false ? [["Maximo", dados.estatisticas.maximo]] : []),
    ...(dados.premissas?.parametrosRelatorio?.exibirDesvio !== false ? [["Desvio padrao", dados.estatisticas.desvioPadrao]] : []),
    ["CV (%)", dados.estatisticas.coeficienteVariacao],
    [],
    ["ME/EPP (LC 123/2006)"],
    ["Aplicar", dados.premissas?.meEpp?.aplicar ? "Sim" : "Nao"],
    ["Tipo", dados.premissas?.meEpp?.tipo === "exclusividade" ? "Exclusividade (ate R$ 80.000)" : "Reserva de 25%"],
    ["Valor reservado", dados.premissas?.meEpp ? fm(dados.premissas.meEpp.valorReservado) : ""],
    ["Base legal", dados.premissas?.meEpp?.baseLegal || ""],
    [],
    ["PRECO ESTIMADO"],
    ["Valor unitario", dados.precoUnitario],
    ["Valor total", dados.precoTotal],
    [],
    ["JUSTIFICATIVA"],
    [dados.justificativa],
  ].filter((linha) => linha.length > 0);
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // --- Aba 2: Itens da contratacao ---
  const itens = dados.premissas?.itens || [];
  if (itens.length > 0) {
    const itensData = [
      ["Itens / Lotes da contratacao"], [],
      ["#", "Descricao", "Especificacao", "Quantidade", "Unidade", "N do item no edital", "Obrigatorio"],
      ...itens.map((i: any, idx: number) => [idx + 1, i.descricao, i.especificacao, i.quantidade, i.unidadeMedida, i.itemEdital || "", i.obrigatorio ? "Sim" : "Nao"]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(itensData), "Itens");
  }

  // --- Aba 3: Referencias ---
  const refsHeader = ["Item", "Fonte", "Orgao", "Descricao", "Quantidade", "Data", "Valor unitario", "Valor total", "Localizacao", "Similaridade (%)", "CNPJ (cotacao manual)", "Documento de origem", "Link do edital"];
  const refsData = [refsHeader, ...dados.referencias.map((r: any) => {
    const rotulo = (dados.premissas?.itens || []).find((i: any) => i.id === r.itemId)?.descricao || (r.itemId === "global" ? "Objeto (global)" : "");
    return [rotulo || "", r.fonte, r.orgao, r.descricao, r.quantidade, r.data, r.valor_unitario, r.valor_total, r.localizacao, r.similaridade, r.cnpj || "", r.documento_origem, r.link_origem];
  })];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(refsData), "Referencias");

  // --- Aba 4: Pesquisa de mercado (cotações manuais) ---
  const merc = dados.premissas?.pesquisaMercado || [];
  if (merc.length > 0) {
    const mercData = [
      ["Pesquisa de mercado (cotacoes manuais)"], [],
      ["Item", "Fornecedor", "CNPJ", "Fonte", "Valor (R$)", "Data", "Observacao"],
      ...merc.map((r: any) => {
        const rotulo = (dados.premissas?.itens || []).find((i: any) => i.id === r.itemId)?.descricao || "Objeto (global)";
        return [rotulo, r.fornecedor, r.cnpj, r.fonte, r.valor, r.data, r.observacao || ""];
      }),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mercData), "Pesquisa de mercado");
  }

  // --- Aba 5: Decomposicao de custos ---
  const decomps = dados.premissas?.decomposicaoCustos || [];
  if (decomps.length > 0) {
    const decData = [
      ["Decomposicao de custos"], [],
      ["Item", "Composicao", "Tipo", "Descricao", "Unidade", "Quantidade", "Custo unitario (R$)", "Percentual (%)"],
      ...decomps.flatMap((c: any) => {
        const rotulo = (dados.premissas?.itens || []).find((i: any) => i.id === c.itemId)?.descricao || "Objeto (global)";
        if (c.custos.length === 0) return [[rotulo, c.nome, "", "", "", "", "", ""]];
        return c.custos.map((x: any) => [rotulo, c.nome, x.tipo, x.descricao, x.unidade || "", x.quantidade ?? "", x.custoUnitario ?? "", x.percentual ?? ""]);
      }),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(decData), "Decomposicao de custos");
  }

  // --- Aba 6: Links e Evidencias ---
  const linksData = [
    ["Links e Evidencias"], [],
    ["Tipo", "Nome", "URL"],
    ...(dados.linksEvidencias || []).map((l: any) => ["Referencia PNCP", l.nome, l.url]),
    ["Documento", "Termo de referencia", "Anexado ao processo"],
    ["Documento", "Prints da pesquisa", "Anexado ao processo"],
    ["Documento", "Planilha de calculo", "Gerado pelo sistema"],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linksData), "Links e Evidencias");

  // --- Aba 7: Memoria de calculo ---
  const memoriaData = [
    ["Memoria de calculo"], [],
    ["Formula", "Descricao", "Valor"],
    ["N", "Numero de referencias aceitas", dados.estatisticas.n],
    ["SOMA", "Soma dos valores unitarios", dados.referencias.filter((r: any) => r.valor_unitario != null && r.valor_unitario > 0).reduce((a: number, r: any) => a + r.valor_unitario, 0)],
    ["MEDIA", "SOMA / N", dados.estatisticas.media],
    ["MEDIANA", "Valor central do conjunto ordenado", dados.estatisticas.mediana],
    ["MINIMO", "Menor valor unitario", dados.estatisticas.minimo],
    ["MAXIMO", "Maior valor unitario", dados.estatisticas.maximo],
    ["DESVIO PADRAO", "raiz(variancia)", dados.estatisticas.desvioPadrao],
    ["CV (%)", "(DP / Media) x 100", dados.estatisticas.coeficienteVariacao],
    ["Limite de CV", "Alerta de dispersao", dados.premissas?.cvLimite ?? ""],
    [],
    ["Preco unitario estimado", "Conforme metodo efetivo", dados.precoUnitario],
    ["Preco total estimado", "Unitario x Quantidade", dados.precoTotal],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(memoriaData), "Memoria de calculo");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

export function downloadXLSX(bytes: Uint8Array, nome: string) {
  // Normaliza o retorno do xlsx no browser: pode vir como array comum de números,
  // cujo `.buffer` é undefined (geraria um Blob com o texto "undefined").
  const arr = new Uint8Array(bytes as unknown as ArrayLike<number>);
  const blob = new Blob([arr.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // revoke assíncrono: revogar na mesma tick pode cancelar o download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
