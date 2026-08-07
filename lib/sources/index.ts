import { buscarPNCP } from "./pncp";
import { buscarPainelPrecos } from "./painel-precos";
import { buscarComprasGov } from "./compras-gov";
import { buscarBPS, ehItemSaude } from "./bps";
import { buscarSINAPI, ehItemObras } from "./sinapi";
import type { BuscaParams, ResultadoFonte, FonteConfig, FonteId } from "./types";

export type { FonteId, ResultadoBruto, ResultadoFonte, BuscaParams, FonteConfig } from "./types";

export const FONTES_CONFIG: FonteConfig[] = [
  {
    id: "pncp",
    nome: "PNCP",
    descricao: "Portal Nacional de Contratações Públicas",
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
];

export async function buscarFonte(
  fonte: FonteId,
  params: BuscaParams
): Promise<ResultadoFonte> {
  switch (fonte) {
    case "pncp":
      return buscarPNCP(params);
    case "painel_precos":
      return buscarPainelPrecos(params);
    case "compras_gov":
      return buscarComprasGov(params);
    case "bps":
      return buscarBPS(params);
    case "sinapi":
      return buscarSINAPI(params);
    default:
      return { fonte, items: [], total: 0, erro: "Fonte não implementada" };
  }
}

export function sugerirFontes(termo: string): FonteId[] {
  const fontes: FonteId[] = ["pncp", "painel_precos", "compras_gov"];
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
