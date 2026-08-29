import { buscarPNCP } from "./pncp";
import { buscarPNCPSearch } from "./pncp-search";
import { buscarPainelPrecos } from "./painel-precos";
import { buscarComprasGov } from "./compras-gov";
import { buscarPrecosAbertos } from "./precos-abertos";
import { buscarPNCPBigQuery } from "./pncp-bd";
import { buscarBPS, ehItemSaude } from "./bps";
import { buscarSINAPI, ehItemObras } from "./sinapi";
import { buscarContratosGovBr } from "./contratos-govbr";
import type { BuscaParams, ResultadoFonte, FonteConfig, FonteId } from "./types";

export type { FonteId, ResultadoBruto, ResultadoFonte, BuscaParams, FonteConfig } from "./types";

export const FONTES_CONFIG: FonteConfig[] = [
  {
    id: "pncp",
    nome: "PNCP (busca textual)",
    descricao: "Portal Nacional de Contratações Públicas — busca por texto com links de edital",
    disponivel: true,
    categorias: ["geral", "bens", "servicos", "obras"],
  },
  {
    id: "painel_precos",
    nome: "Painel de Preços",
    descricao: "Painel de Preços do Ministério do Planejamento",
    disponivel: true,
    categorias: ["geral", "bens", "servicos"],
  },
  {
    id: "compras_gov",
    nome: "Compras.gov.br",
    descricao: "SIASG - Sistema Integrado de Administração de Serviços Gerais",
    disponivel: true,
    categorias: ["geral", "bens", "servicos"],
  },
  {
    id: "precos_abertos",
    nome: "Pesquisa de Preços (Dados Abertos)",
    descricao: "Compras.gov.br - Pesquisa de Preços em Dados Abertos (CATMAT/PDM)",
    disponivel: true,
    categorias: ["geral", "bens", "servicos"],
  },
  {
    id: "pncp_bd",
    nome: "PNCP (Base dos Dados/BigQuery)",
    descricao: "Espelho completo do PNCP via Base dos Dados (BigQuery)",
    disponivel: true,
    categorias: ["geral", "bens", "servicos", "obras"],
  },
  {
    id: "bps",
    nome: "BPS - Saúde",
    descricao: "Banco de Preços em Saúde do Ministério da Saúde",
    disponivel: true,
    categorias: ["saude", "medicamentos", "equipamentos_medicos"],
  },
  {
    id: "sinapi",
    nome: "SINAPI",
    descricao: "Sistema Nacional de Pesquisa de Custos - Construção Civil",
    disponivel: true,
    categorias: ["obras", "construcao", "infraestrutura"],
  },
  {
    id: "contratos_govbr",
    nome: "Contratos.gov.br (preços pagos)",
    descricao: "Preços unitários REAIS pagos em contratos federais — a referência mais defensável em pesquisa de preços",
    disponivel: true,
    categorias: ["geral", "bens", "servicos", "obras"],
  },
];

export async function buscarFonte(
  fonte: FonteId,
  params: BuscaParams
): Promise<ResultadoFonte> {
  switch (fonte) {
    case "pncp":
      return buscarPNCPSearch(params);
    case "painel_precos":
      return buscarPainelPrecos(params);
    case "compras_gov":
      return buscarComprasGov(params);
    case "precos_abertos":
      return buscarPrecosAbertos(params);
    case "pncp_bd":
      return buscarPNCPBigQuery(params);
    case "bps":
      return buscarBPS(params);
    case "sinapi":
      return buscarSINAPI(params);
    case "contratos_govbr":
      return buscarContratosGovBr(params);
    default:
      return { fonte, items: [], total: 0, erro: "Fonte não implementada" };
  }
}

export function sugerirFontes(termo: string): FonteId[] {
  const fontes: FonteId[] = ["pncp", "pncp_bd", "painel_precos", "precos_abertos", "compras_gov"];
  if (ehItemSaude(termo)) fontes.push("bps");
  if (ehItemObras(termo)) fontes.push("sinapi");
  return fontes;
}

export async function buscarTodasFontes(
  fontes: FonteId[],
  params: BuscaParams
): Promise<ResultadoFonte[]> {
  return Promise.all(fontes.map((f) => buscarFonte(f, params)));
}
