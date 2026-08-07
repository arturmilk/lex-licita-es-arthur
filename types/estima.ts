export type Esfera = "federal" | "estadual" | "municipal" | "distrital";
export type Perfil = "pesquisador" | "administrador" | "gestor";
export type StatusProcesso = "rascunho" | "pesquisando" | "estimado" | "concluido" | "cancelado";
export type StatusPesquisa = "em_andamento" | "concluida" | "cancelada";
export type StatusAvaliacao = "pendente" | "aceito" | "rejeitado";
export type TipoEvidencia = "pdf" | "xlsx" | "imagem" | "link" | "print" | "outro";
export type TipoRelatorio = "pdf" | "xlsx";
export type MetodoCalculo = "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
export type PeriodoPesquisa = "6_meses" | "12_meses" | "24_meses";
export type RegiaoPesquisa = "brasil" | "centro_oeste" | "sudeste" | "sul" | "nordeste" | "norte";
export type FormaParcelamento = "item" | "lote" | "global";

export interface Orgao { id: string; cnpj: string; nome: string; sigla?: string; esfera: Esfera; created_at: string; }
export interface Usuario { id: string; nome: string; email: string; orgao_id: string; unidade?: string; perfil: Perfil; ativo: boolean; created_at: string; }
export interface Processo { id: string; numero: string; orgao_id: string; unidade?: string; responsavel_id?: string; objeto_descricao: string; status: StatusProcesso; created_at: string; updated_at: string; }
export interface Pesquisa { id: string; processo_id: string; quantidade: number; unidade_medida: string; local_entrega?: string; caracteristicas_ia: Record<string, unknown>; periodo: PeriodoPesquisa; regiao: RegiaoPesquisa; qtd_min_referencias: number; metodo_calculo: MetodoCalculo; preco_unitario_estimado?: number; preco_total_estimado?: number; justificativa?: string; status: StatusPesquisa; created_at: string; updated_at: string; }
export interface ResultadoPNCP { id: string; pesquisa_id: string; orgao: string; descricao: string; quantidade?: number; data_contrato?: string; valor_unitario: number; valor_total?: number; localizacao?: string; similaridade: number; documento_origem?: string; link_origem?: string; status_avaliacao: StatusAvaliacao; justificativa_rejeicao?: string; dados_brutos: Record<string, unknown>; created_at: string; }
export interface Evidencia { id: string; pesquisa_id?: string; processo_id?: string; nome: string; tipo: TipoEvidencia; url?: string; storage_path?: string; origem: string; created_at: string; }
export interface Relatorio { id: string; pesquisa_id?: string; processo_id?: string; tipo: TipoRelatorio; nome_arquivo: string; storage_path?: string; url?: string; created_at: string; }
export interface Configuracao { id: string; orgao_id: string; similaridade_minima: number; cv_alerta_percentual: number; periodo_padrao: PeriodoPesquisa; metodo_padrao: MetodoCalculo; updated_at: string; }

export interface ProcessoFormData { numero: string; orgao_id: string; unidade?: string; responsavel_id?: string; objeto_descricao: string; }
export interface PesquisaFormData { processo_id: string; quantidade: number; unidade_medida: string; local_entrega?: string; periodo: PeriodoPesquisa; regiao: RegiaoPesquisa; qtd_min_referencias: number; metodo_calculo: MetodoCalculo; }

export interface EstatisticasPreco { n: number; media: number; mediana: number; minimo: number; maximo: number; desvioPadrao: number; coeficienteVariacao: number; }
export interface CaracteristicaIA { caracteristica: string; valor: string; confianca: number; }
export interface ExtracaoIA { categoria: string; caracteristicas: CaracteristicaIA[]; }
