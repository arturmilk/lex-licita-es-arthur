import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const esferaEnum = pgEnum("esfera", ["federal", "estadual", "municipal", "distrital"]);
export const perfilEnum = pgEnum("perfil", ["pesquisador", "administrador", "gestor"]);
export const statusProcessoEnum = pgEnum("status_processo", ["rascunho", "pesquisando", "estimado", "concluido", "cancelado"]);
export const statusPesquisaEnum = pgEnum("status_pesquisa", ["em_andamento", "concluida", "cancelada"]);
export const statusAvaliacaoEnum = pgEnum("status_avaliacao", ["pendente", "aceito", "rejeitado"]);
export const tipoEvidenciaEnum = pgEnum("tipo_evidencia", ["pdf", "xlsx", "imagem", "link", "print", "outro"]);
export const tipoRelatorioEnum = pgEnum("tipo_relatorio", ["pdf", "xlsx"]);
export const metodocalculoEnum = pgEnum("metodo_calculo", ["media_aritmetica", "mediana", "media_ponderada", "menor_preco"]);
export const statusAgenteEnum = pgEnum("status_agente", ["aguardando", "executando", "concluido", "erro", "cancelado"]);
export const fonteEnum = pgEnum("fonte", ["pncp", "pncp_bd", "painel_precos", "compras_gov", "precos_abertos", "pesquisa_precos_gov", "bps", "sinapi", "sicro", "manual", "contratos_govbr"]);

export const orgaos = pgTable("orgaos", {
  id: uuid("id").defaultRandom().primaryKey(),
  cnpj: varchar("cnpj", { length: 18 }).unique(),
  nome: varchar("nome", { length: 255 }).notNull(),
  esfera: esferaEnum("esfera").notNull().default("federal"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  senhaHash: varchar("senha_hash", { length: 255 }).notNull(),
  perfil: perfilEnum("perfil").notNull().default("pesquisador"),
  orgaoId: uuid("orgao_id").references(() => orgaos.id, { onDelete: "restrict" }),
  cargo: varchar("cargo", { length: 255 }),
  matricula: varchar("matricula", { length: 100 }),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("usuarios_email_idx").on(t.email),
  index("usuarios_orgao_idx").on(t.orgaoId),
]);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  chave: varchar("chave", { length: 255 }).notNull().unique(),
  orgaoId: uuid("orgao_id").references(() => orgaos.id, { onDelete: "cascade" }),
  ativo: boolean("ativo").notNull().default(true),
  ultimoUso: timestamp("ultimo_uso"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const processos = pgTable("processos", {
  id: uuid("id").defaultRandom().primaryKey(),
  numero: varchar("numero", { length: 100 }).notNull(),
  objeto: text("objeto").notNull(),
  orgaoId: uuid("orgao_id").notNull().references(() => orgaos.id, { onDelete: "restrict" }),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id, { onDelete: "restrict" }),
  unidade: varchar("unidade", { length: 255 }),
  status: statusProcessoEnum("status").notNull().default("rascunho"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("processos_orgao_idx").on(t.orgaoId),
  index("processos_usuario_idx").on(t.usuarioId),
]);

export const pesquisas = pgTable("pesquisas", {
  id: uuid("id").defaultRandom().primaryKey(),
  processoId: uuid("processo_id").notNull().references(() => processos.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").notNull().references(() => usuarios.id, { onDelete: "restrict" }),
  objeto: text("objeto").notNull(),
  especificacoes: jsonb("especificacoes"),
  itens: jsonb("itens"),
  pesquisaMercado: jsonb("pesquisa_mercado"),
  quantidade: integer("quantidade").notNull().default(1),
  unidadeMedida: varchar("unidade_medida", { length: 50 }).default("unidade"),
  localEntrega: varchar("local_entrega", { length: 255 }),
  formaParcelamento: varchar("forma_parcelamento", { length: 20 }).default("item"),
  caracteristicasIA: jsonb("caracteristicas_ia"),
  periodoPesquisa: varchar("periodo_pesquisa", { length: 10 }).default("12_meses"),
  regiaoPesquisa: varchar("regiao_pesquisa", { length: 50 }).default("brasil"),
  metodoCalculo: metodocalculoEnum("metodo_calculo").default("media_aritmetica"),
  qtdMinReferencias: integer("qtd_min_referencias").default(3),
  cvLimite: integer("cv_limite").default(20),
  parametrosRelatorio: jsonb("parametros_relatorio"),
  meEpp: jsonb("me_epp"),
  decomposicaoCustos: jsonb("decomposicao_custos"),
  premissas: jsonb("premissas"),
  precoUnitarioEstimado: numeric("preco_unitario_estimado", { precision: 15, scale: 2 }),
  precoTotalEstimado: numeric("preco_total_estimado", { precision: 15, scale: 2 }),
  estatisticas: jsonb("estatisticas"),
  justificativa: text("justificativa"),
  fontesAtivas: jsonb("fontes_ativas").$type<string[]>().default(["pncp", "painel_precos"]),
  status: statusPesquisaEnum("status").notNull().default("em_andamento"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("pesquisas_processo_idx").on(t.processoId),
  index("pesquisas_usuario_idx").on(t.usuarioId),
]);

export const sessoesAgente = pgTable("sessoes_agente", {
  id: uuid("id").defaultRandom().primaryKey(),
  pesquisaId: uuid("pesquisa_id").notNull().references(() => pesquisas.id, { onDelete: "cascade" }),
  nomeAgente: varchar("nome_agente", { length: 255 }).notNull(),
  fonte: fonteEnum("fonte").notNull(),
  status: statusAgenteEnum("status").notNull().default("aguardando"),
  totalEncontrado: integer("total_encontrado").default(0),
  progresso: integer("progresso").default(0),
  mensagem: varchar("mensagem", { length: 500 }),
  erro: text("erro"),
  iniciadoEm: timestamp("iniciado_em"),
  concluidoEm: timestamp("concluido_em"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("sessoes_pesquisa_idx").on(t.pesquisaId)]);

export const resultadosPesquisa = pgTable("resultados_pesquisa", {
  id: uuid("id").defaultRandom().primaryKey(),
  pesquisaId: uuid("pesquisa_id").notNull().references(() => pesquisas.id, { onDelete: "cascade" }),
  sessaoAgenteId: uuid("sessao_agente_id").references(() => sessoesAgente.id, { onDelete: "set null" }),
  fonte: fonteEnum("fonte").notNull().default("pncp"),
  itemId: varchar("item_id", { length: 64 }),
  cnpj: varchar("cnpj", { length: 18 }),
  fonteDados: varchar("fonte_dados", { length: 120 }),
  orgao: varchar("orgao", { length: 500 }).notNull(),
  descricao: text("descricao").notNull(),
  quantidade: integer("quantidade"),
  dataContrato: varchar("data_contrato", { length: 20 }),
  valorUnitario: numeric("valor_unitario", { precision: 15, scale: 2 }),
  valorTotal: numeric("valor_total", { precision: 15, scale: 2 }),
  localizacao: varchar("localizacao", { length: 100 }),
  similaridade: integer("similaridade").default(0),
  documentoOrigem: varchar("documento_origem", { length: 500 }),
  linkEdital: text("link_edital"),
  avaliacao: statusAvaliacaoEnum("avaliacao").notNull().default("pendente"),
  justificativaRejeicao: text("justificativa_rejeicao"),
  dadosBrutos: jsonb("dados_brutos"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("resultados_pesquisa_idx").on(t.pesquisaId),
  index("resultados_fonte_idx").on(t.fonte),
]);

export const evidencias = pgTable("evidencias", {
  id: uuid("id").defaultRandom().primaryKey(),
  pesquisaId: uuid("pesquisa_id").notNull().references(() => pesquisas.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 500 }).notNull(),
  tipo: tipoEvidenciaEnum("tipo").notNull(),
  url: text("url").notNull(),
  origem: varchar("origem", { length: 100 }).default("upload"),
  tamanhoBytes: integer("tamanho_bytes"),
  mimeType: varchar("mime_type", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("evidencias_pesquisa_idx").on(t.pesquisaId)]);

export const relatorios = pgTable("relatorios", {
  id: uuid("id").defaultRandom().primaryKey(),
  pesquisaId: uuid("pesquisa_id").notNull().references(() => pesquisas.id, { onDelete: "cascade" }),
  tipo: tipoRelatorioEnum("tipo").notNull(),
  nomeArquivo: varchar("nome_arquivo", { length: 500 }).notNull(),
  url: text("url").notNull(),
  tamanhoBytes: integer("tamanho_bytes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("relatorios_pesquisa_idx").on(t.pesquisaId)]);

export const configuracoes = pgTable("configuracoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgaoId: uuid("orgao_id").notNull().unique().references(() => orgaos.id, { onDelete: "cascade" }),
  similaridadeMinima: integer("similaridade_minima").notNull().default(75),
  cvAlerta: integer("cv_alerta").notNull().default(20),
  periodoPadrao: varchar("periodo_padrao", { length: 10 }).notNull().default("12_meses"),
  metodoPadrao: metodocalculoEnum("metodo_padrao").notNull().default("media_aritmetica"),
  fontesAtivas: jsonb("fontes_ativas").$type<string[]>().default(["pncp", "painel_precos"]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const logsSistema = pgTable("logs_sistema", {
  id: uuid("id").defaultRandom().primaryKey(),
  ts: timestamp("ts").defaultNow().notNull(),
  evento: varchar("evento", { length: 100 }).notNull(),
  dados: jsonb("dados").$type<Record<string, unknown>>(),
}, (t) => [
  index("logs_sistema_ts_idx").on(t.ts),
  index("logs_sistema_evento_idx").on(t.evento),
]);

export const feedbacks = pgTable("feedbacks", {
  id: uuid("id").defaultRandom().primaryKey(),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  orgaoId: uuid("orgao_id").references(() => orgaos.id, { onDelete: "set null" }),
  mensagem: text("mensagem").notNull(),
  pagina: varchar("pagina", { length: 255 }),
  lido: boolean("lido").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("feedbacks_orgao_idx").on(t.orgaoId)]);

/* ================= SISTEMA ORIENTADO À INTENÇÃO ================= */

/** Tipos de processo com checklist automático (documentos, etapas, validações). */
export const tiposProcesso = pgTable("tipos_processo", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgaoId: uuid("orgao_id").references(() => orgaos.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("tipos_processo_orgao_idx").on(t.orgaoId)]);

/** Etapas guiadas de cada tipo de processo (checklist automático). */
export const etapasProcesso = pgTable("etapas_processo", {
  id: uuid("id").defaultRandom().primaryKey(),
  tipoProcessoId: uuid("tipo_processo_id").notNull().references(() => tiposProcesso.id, { onDelete: "cascade" }),
  ordem: integer("ordem").notNull().default(1),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  instrucao: text("instrucao"),
  // Documentos necessários nesta etapa (array de nomes)
  documentosNecessarios: jsonb("documentos_necessarios").$type<string[]>().default([]),
  // Campos obrigatórios a preencher nesta etapa
  camposObrigatorios: jsonb("campos_obrigatorios").$type<string[]>().default([]),
  // Validações automáticas: [{tipo: "documento"|"campo"|"assinatura"|"data", alvo: "...", mensagem: "..."}]
  validacoes: jsonb("validacoes").$type<Record<string, unknown>[]>().default([]),
  responsavel: varchar("responsavel", { length: 100 }).default("servidor"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("etapas_tipo_idx").on(t.tipoProcessoId)]);

/** Tarefas do servidor (painel de trabalho). */
export const tarefas = pgTable("tarefas", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgaoId: uuid("orgao_id").notNull().references(() => orgaos.id, { onDelete: "cascade" }),
  processoId: uuid("processo_id").references(() => processos.id, { onDelete: "set null" }),
  tipoProcessoId: uuid("tipo_processo_id").references(() => tiposProcesso.id, { onDelete: "set null" }),
  responsavelId: uuid("responsavel_id").references(() => usuarios.id, { onDelete: "set null" }),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  descricao: text("descricao"),
  etapa: varchar("etapa", { length: 255 }),
  status: varchar("status", { length: 30 }).notNull().default("pendente"), // pendente | em_andamento | concluida | aguardando_outro | atrasada
  prioridade: varchar("prioridade", { length: 20 }).notNull().default("media"), // alta | media | baixa
  prazo: timestamp("prazo"),
  dependenteDe: varchar("dependente_de", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  concluidaEm: timestamp("concluida_em"),
}, (t) => [index("tarefas_responsavel_idx").on(t.responsavelId), index("tarefas_status_idx").on(t.status), index("tarefas_prazo_idx").on(t.prazo)]);

/** Alertas inteligentes (prazos, documentos faltantes, etapas paradas). */
export const alertas = pgTable("alertas", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgaoId: uuid("orgao_id").notNull().references(() => orgaos.id, { onDelete: "cascade" }),
  processoId: uuid("processo_id").references(() => processos.id, { onDelete: "cascade" }),
  tarefaId: uuid("tarefa_id").references(() => tarefas.id, { onDelete: "cascade" }),
  tipo: varchar("tipo", { length: 50 }).notNull().default("prazo"), // prazo | documento | assinatura | parado | inconsistencia | aviso
  mensagem: text("mensagem").notNull(),
  severidade: varchar("severidade", { length: 20 }).notNull().default("media"), // alta | media | baixa
  lido: boolean("lido").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("alertas_orgao_idx").on(t.orgaoId), index("alertas_lido_idx").on(t.lido)]);

/** Histórico completo e auditável das ações. */
export const historicoProcesso = pgTable("historico_processo", {
  id: uuid("id").defaultRandom().primaryKey(),
  processoId: uuid("processo_id").notNull().references(() => processos.id, { onDelete: "cascade" }),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  acao: varchar("acao", { length: 100 }).notNull(),
  descricao: text("descricao"),
  etapa: varchar("etapa", { length: 255 }),
  documento: varchar("documento", { length: 255 }),
  dados: jsonb("dados").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("historico_processo_idx").on(t.processoId), index("historico_usuario_idx").on(t.usuarioId)]);

/** Minutas de documentos administrativos (despacho, parecer, ofício...). */
export const minutas = pgTable("minutas", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgaoId: uuid("orgao_id").notNull().references(() => orgaos.id, { onDelete: "cascade" }),
  processoId: uuid("processo_id").references(() => processos.id, { onDelete: "set null" }),
  usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
  tipo: varchar("tipo", { length: 50 }).notNull().default("despacho"), // despacho | parecer | memorando | oficio | justificativa | relatorio
  titulo: varchar("titulo", { length: 255 }),
  conteudo: text("conteudo").notNull(),
  status: varchar("status", { length: 30 }).notNull().default("rascunho"), // rascunho | revisado | assinado
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("minutas_orgao_idx").on(t.orgaoId), index("minutas_processo_idx").on(t.processoId)]);

/** Base de conhecimento (normas, procedimentos, regras internas). */
export const baseConhecimento = pgTable("base_conhecimento", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgaoId: uuid("orgao_id").references(() => orgaos.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 255 }).notNull(),
  categoria: varchar("categoria", { length: 100 }).default("norma"), // norma | procedimento | modelo | regra_interna | dicionario
  conteudo: text("conteudo").notNull(),
  fonte: varchar("fonte", { length: 255 }),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("base_conhecimento_orgao_idx").on(t.orgaoId)]);

/** Julgados (acórdãos TCU/TCE) vinculados ao processo como parâmetro de apoio. */
export const julgadosProcesso = pgTable("julgados_processo", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgaoId: uuid("orgao_id").notNull().references(() => orgaos.id, { onDelete: "cascade" }),
  processoId: uuid("processo_id").notNull().references(() => processos.id, { onDelete: "cascade" }),
  tribunal: varchar("tribunal", { length: 30 }).notNull().default("tcu"), // tcu | tce_ro
  numero: varchar("numero", { length: 60 }),       // ex: 1888/2026
  relator: varchar("relator", { length: 255 }),
  orgaoJulgador: varchar("orgao_julgador", { length: 120 }),
  ementa: text("ementa"),
  link: text("link"),                               // link do julgado (base de parâmetro)
  assunto: varchar("assunto", { length: 255 }),
  usado: boolean("usado").notNull().default(false), // marcado como usado na justificativa
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("julgados_processo_idx").on(t.processoId)]);

/** Modelos de documentos oficiais (AGU etc.) com campos auto-preenchíveis. */
export const modelosDocumento = pgTable("modelos_documento", {
  id: uuid("id").defaultRandom().primaryKey(),
  orgaoId: uuid("orgao_id").references(() => orgaos.id, { onDelete: "cascade" }),
  nome: varchar("nome", { length: 255 }).notNull(),
  categoria: varchar("categoria", { length: 80 }).default("edital"), // edital | contrato | termo_referencia | ata | lista_verificacao | termo_aditivo
  origem: varchar("origem", { length: 120 }).default("agu"),         // agu | orgao | outro
  descricao: text("descricao"),
  // Template com placeholders: {{objeto}}, {{numeroProcesso}}, {{dotacao}}, {{modalidade}}, {{justificativa}}, {{julgados}}, {{data}}, {{orgao}}...
  conteudoTemplate: text("conteudo_template").notNull(),
  campos: jsonb("campos").$type<string[]>().default([]),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("modelos_documento_orgao_idx").on(t.orgaoId)]);

// Relations
export const orgaosRelations = relations(orgaos, ({ many, one }) => ({
  usuarios: many(usuarios),
  processos: many(processos),
  configuracao: one(configuracoes, { fields: [orgaos.id], references: [configuracoes.orgaoId] }),
  apiKeys: many(apiKeys),
}));

export const usuariosRelations = relations(usuarios, ({ one, many }) => ({
  orgao: one(orgaos, { fields: [usuarios.orgaoId], references: [orgaos.id] }),
  processos: many(processos),
  pesquisas: many(pesquisas),
}));

export const processosRelations = relations(processos, ({ one, many }) => ({
  orgao: one(orgaos, { fields: [processos.orgaoId], references: [orgaos.id] }),
  usuario: one(usuarios, { fields: [processos.usuarioId], references: [usuarios.id] }),
  pesquisas: many(pesquisas),
}));

export const pesquisasRelations = relations(pesquisas, ({ one, many }) => ({
  processo: one(processos, { fields: [pesquisas.processoId], references: [processos.id] }),
  usuario: one(usuarios, { fields: [pesquisas.usuarioId], references: [usuarios.id] }),
  resultados: many(resultadosPesquisa),
  sessoes: many(sessoesAgente),
  evidencias: many(evidencias),
  relatorios: many(relatorios),
}));

export const sessoesAgenteRelations = relations(sessoesAgente, ({ one, many }) => ({
  pesquisa: one(pesquisas, { fields: [sessoesAgente.pesquisaId], references: [pesquisas.id] }),
  resultados: many(resultadosPesquisa),
}));

export const resultadosPesquisaRelations = relations(resultadosPesquisa, ({ one }) => ({
  pesquisa: one(pesquisas, { fields: [resultadosPesquisa.pesquisaId], references: [pesquisas.id] }),
  sessaoAgente: one(sessoesAgente, { fields: [resultadosPesquisa.sessaoAgenteId], references: [sessoesAgente.id] }),
}));

export const evidenciasRelations = relations(evidencias, ({ one }) => ({
  pesquisa: one(pesquisas, { fields: [evidencias.pesquisaId], references: [pesquisas.id] }),
}));

export const relatoriosRelations = relations(relatorios, ({ one }) => ({
  pesquisa: one(pesquisas, { fields: [relatorios.pesquisaId], references: [pesquisas.id] }),
}));
