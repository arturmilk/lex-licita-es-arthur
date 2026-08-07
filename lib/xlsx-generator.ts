import * as XLSX from "xlsx";

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
    ["Metodo de calculo", dados.metodo],
    [],
    ["ESTATISTICAS"],
    ["Referencias aceitas", dados.estatisticas.n],
    ["Media", dados.estatisticas.media],
    ["Mediana", dados.estatisticas.mediana],
    ["Minimo", dados.estatisticas.minimo],
    ["Maximo", dados.estatisticas.maximo],
    ["Desvio padrao", dados.estatisticas.desvioPadrao],
    ["CV (%)", dados.estatisticas.coeficienteVariacao],
    [],
    ["PRECO ESTIMADO"],
    ["Valor unitario", dados.precoUnitario],
    ["Valor total", dados.precoTotal],
    [],
    ["JUSTIFICATIVA"],
    [dados.justificativa],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  // --- Aba 2: Referencias ---
  const refsHeader = ["Orgao", "Descricao", "Quantidade", "Data", "Valor unitario", "Valor total", "Localizacao", "Similaridade (%)", "Documento de origem", "Link do edital"];
  const refsData = [refsHeader, ...dados.referencias.map((r: any) => [r.orgao, r.descricao, r.quantidade, r.data, r.valor_unitario, r.valor_total, r.localizacao, r.similaridade, r.documento_origem, r.link_origem])];
  const wsRefs = XLSX.utils.aoa_to_sheet(refsData);
  XLSX.utils.book_append_sheet(wb, wsRefs, "Referencias");

  // --- Aba 3: Links e Evidencias ---
  const linksData = [
    ["Links e Evidencias"], [],
    ["Tipo", "Nome", "URL"],
    ...(dados.linksEvidencias || []).map((l: any) => ["Referencia PNCP", l.nome, l.url]),
    ["Documento", "Termo de referencia", "Anexado ao processo"],
    ["Documento", "Prints da pesquisa", "Anexado ao processo"],
    ["Documento", "Planilha de calculo", "Gerado pelo sistema"],
  ];
  const wsLinks = XLSX.utils.aoa_to_sheet(linksData);
  XLSX.utils.book_append_sheet(wb, wsLinks, "Links e Evidencias");

  // --- Aba 4: Memoria de calculo ---
  const memoriaData = [
    ["Memoria de calculo"], [],
    ["Formula", "Descricao", "Valor"],
    ["N", "Numero de referencias aceitas", dados.estatisticas.n],
    ["SOMA", "Soma dos valores unitarios", dados.referencias.filter((r: any) => r.similaridade > 0).reduce((a: number, r: any) => a + r.valor_unitario, 0)],
    ["MEDIA", "SOMA / N", dados.estatisticas.media],
    ["MEDIANA", "Valor central do conjunto ordenado", dados.estatisticas.mediana],
    ["MINIMO", "Menor valor unitario", dados.estatisticas.minimo],
    ["MAXIMO", "Maior valor unitario", dados.estatisticas.maximo],
    ["DESVIO PADRAO", "raiz(variancia)", dados.estatisticas.desvioPadrao],
    ["CV (%)", "(DP / Media) x 100", dados.estatisticas.coeficienteVariacao],
    [],
    ["Preco unitario estimado", "Conforme metodo selecionado", dados.precoUnitario],
    ["Preco total estimado", "Unitario x Quantidade", dados.precoTotal],
  ];
  const wsMemoria = XLSX.utils.aoa_to_sheet(memoriaData);
  XLSX.utils.book_append_sheet(wb, wsMemoria, "Memoria de calculo");

  return XLSX.write(wb, { bookType: "xlsx", type: "array" });
}

export function downloadXLSX(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
