export type FonteId = "pncp" | "pncp_bd" | "painel_precos" | "compras_gov" | "precos_abertos" | "bps" | "sinapi" | "sicro" | "manual";

export interface ResultadoBruto {
  fonte: FonteId;
  orgao: string;
  descricao: string;
  quantidade: number | null;
  dataContrato: string | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  localizacao: string | null;
  similaridade: number;
  documentoOrigem: string | null;
  linkEdital: string | null;
  dadosBrutos: Record<string, unknown>;
}

export interface ResultadoFonte {
  items: ResultadoBruto[];
  total: number;
  fonte: FonteId;
  erro?: string;
  aviso?: string;
}

export interface FonteConfig {
  id: FonteId;
  nome: string;
  descricao: string;
  disponivel: boolean;
  categorias: string[];
}

export interface BuscaParams {
  termo: string;
  pagina?: number;
  tamanhoPagina?: number;
  dataInicial?: string;
  dataFinal?: string;
  uf?: string;
  modalidade?: number;
}
