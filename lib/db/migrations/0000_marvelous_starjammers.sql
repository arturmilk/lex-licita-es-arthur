CREATE TYPE "public"."esfera" AS ENUM('federal', 'estadual', 'municipal', 'distrital');--> statement-breakpoint
CREATE TYPE "public"."fonte" AS ENUM('pncp', 'pncp_bd', 'painel_precos', 'compras_gov', 'precos_abertos', 'bps', 'sinapi', 'sicro', 'manual');--> statement-breakpoint
CREATE TYPE "public"."metodo_calculo" AS ENUM('media_aritmetica', 'mediana', 'media_ponderada', 'menor_preco');--> statement-breakpoint
CREATE TYPE "public"."perfil" AS ENUM('pesquisador', 'administrador', 'gestor');--> statement-breakpoint
CREATE TYPE "public"."status_agente" AS ENUM('aguardando', 'executando', 'concluido', 'erro', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."status_avaliacao" AS ENUM('pendente', 'aceito', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."status_pesquisa" AS ENUM('em_andamento', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."status_processo" AS ENUM('rascunho', 'pesquisando', 'estimado', 'concluido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."tipo_evidencia" AS ENUM('pdf', 'xlsx', 'imagem', 'link', 'print', 'outro');--> statement-breakpoint
CREATE TYPE "public"."tipo_relatorio" AS ENUM('pdf', 'xlsx');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"chave" varchar(255) NOT NULL,
	"orgao_id" uuid,
	"ativo" boolean DEFAULT true NOT NULL,
	"ultimo_uso" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_chave_unique" UNIQUE("chave")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "configuracoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orgao_id" uuid NOT NULL,
	"similaridade_minima" integer DEFAULT 75 NOT NULL,
	"cv_alerta" integer DEFAULT 25 NOT NULL,
	"periodo_padrao" varchar(10) DEFAULT '12_meses' NOT NULL,
	"metodo_padrao" "metodo_calculo" DEFAULT 'media_aritmetica' NOT NULL,
	"fontes_ativas" jsonb DEFAULT '["pncp","painel_precos"]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "configuracoes_orgao_id_unique" UNIQUE("orgao_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidencias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pesquisa_id" uuid NOT NULL,
	"nome" varchar(500) NOT NULL,
	"tipo" "tipo_evidencia" NOT NULL,
	"url" text NOT NULL,
	"origem" varchar(100) DEFAULT 'upload',
	"tamanho_bytes" integer,
	"mime_type" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orgaos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cnpj" varchar(18),
	"nome" varchar(255) NOT NULL,
	"esfera" "esfera" DEFAULT 'federal' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orgaos_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pesquisas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"processo_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"objeto" text NOT NULL,
	"especificacoes" jsonb,
	"quantidade" integer DEFAULT 1 NOT NULL,
	"unidade_medida" varchar(50) DEFAULT 'unidade',
	"local_entrega" varchar(255),
	"forma_parcelamento" varchar(20) DEFAULT 'item',
	"caracteristicas_ia" jsonb,
	"periodo_pesquisa" varchar(10) DEFAULT '12_meses',
	"regiao_pesquisa" varchar(50) DEFAULT 'brasil',
	"metodo_calculo" "metodo_calculo" DEFAULT 'media_aritmetica',
	"qtd_min_referencias" integer DEFAULT 3,
	"preco_unitario_estimado" numeric(15, 2),
	"preco_total_estimado" numeric(15, 2),
	"estatisticas" jsonb,
	"justificativa" text,
	"fontes_ativas" jsonb DEFAULT '["pncp","painel_precos"]'::jsonb,
	"status" "status_pesquisa" DEFAULT 'em_andamento' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "processos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" varchar(100) NOT NULL,
	"objeto" text NOT NULL,
	"orgao_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"unidade" varchar(255),
	"status" "status_processo" DEFAULT 'rascunho' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relatorios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pesquisa_id" uuid NOT NULL,
	"tipo" "tipo_relatorio" NOT NULL,
	"nome_arquivo" varchar(500) NOT NULL,
	"url" text NOT NULL,
	"tamanho_bytes" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resultados_pesquisa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pesquisa_id" uuid NOT NULL,
	"sessao_agente_id" uuid,
	"fonte" "fonte" DEFAULT 'pncp' NOT NULL,
	"orgao" varchar(500) NOT NULL,
	"descricao" text NOT NULL,
	"quantidade" integer,
	"data_contrato" varchar(20),
	"valor_unitario" numeric(15, 2),
	"valor_total" numeric(15, 2),
	"localizacao" varchar(100),
	"similaridade" integer DEFAULT 0,
	"documento_origem" varchar(500),
	"link_edital" text,
	"avaliacao" "status_avaliacao" DEFAULT 'pendente' NOT NULL,
	"justificativa_rejeicao" text,
	"dados_brutos" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessoes_agente" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pesquisa_id" uuid NOT NULL,
	"nome_agente" varchar(255) NOT NULL,
	"fonte" "fonte" NOT NULL,
	"status" "status_agente" DEFAULT 'aguardando' NOT NULL,
	"total_encontrado" integer DEFAULT 0,
	"progresso" integer DEFAULT 0,
	"mensagem" varchar(500),
	"erro" text,
	"iniciado_em" timestamp,
	"concluido_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"senha_hash" varchar(255) NOT NULL,
	"perfil" "perfil" DEFAULT 'pesquisador' NOT NULL,
	"orgao_id" uuid,
	"cargo" varchar(255),
	"matricula" varchar(100),
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_orgao_id_orgaos_id_fk" FOREIGN KEY ("orgao_id") REFERENCES "public"."orgaos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "configuracoes" ADD CONSTRAINT "configuracoes_orgao_id_orgaos_id_fk" FOREIGN KEY ("orgao_id") REFERENCES "public"."orgaos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "evidencias" ADD CONSTRAINT "evidencias_pesquisa_id_pesquisas_id_fk" FOREIGN KEY ("pesquisa_id") REFERENCES "public"."pesquisas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pesquisas" ADD CONSTRAINT "pesquisas_processo_id_processos_id_fk" FOREIGN KEY ("processo_id") REFERENCES "public"."processos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pesquisas" ADD CONSTRAINT "pesquisas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "processos" ADD CONSTRAINT "processos_orgao_id_orgaos_id_fk" FOREIGN KEY ("orgao_id") REFERENCES "public"."orgaos"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "processos" ADD CONSTRAINT "processos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "relatorios" ADD CONSTRAINT "relatorios_pesquisa_id_pesquisas_id_fk" FOREIGN KEY ("pesquisa_id") REFERENCES "public"."pesquisas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resultados_pesquisa" ADD CONSTRAINT "resultados_pesquisa_pesquisa_id_pesquisas_id_fk" FOREIGN KEY ("pesquisa_id") REFERENCES "public"."pesquisas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resultados_pesquisa" ADD CONSTRAINT "resultados_pesquisa_sessao_agente_id_sessoes_agente_id_fk" FOREIGN KEY ("sessao_agente_id") REFERENCES "public"."sessoes_agente"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessoes_agente" ADD CONSTRAINT "sessoes_agente_pesquisa_id_pesquisas_id_fk" FOREIGN KEY ("pesquisa_id") REFERENCES "public"."pesquisas"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_orgao_id_orgaos_id_fk" FOREIGN KEY ("orgao_id") REFERENCES "public"."orgaos"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "evidencias_pesquisa_idx" ON "evidencias" USING btree ("pesquisa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pesquisas_processo_idx" ON "pesquisas" USING btree ("processo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pesquisas_usuario_idx" ON "pesquisas" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processos_orgao_idx" ON "processos" USING btree ("orgao_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "processos_usuario_idx" ON "processos" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relatorios_pesquisa_idx" ON "relatorios" USING btree ("pesquisa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resultados_pesquisa_idx" ON "resultados_pesquisa" USING btree ("pesquisa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resultados_fonte_idx" ON "resultados_pesquisa" USING btree ("fonte");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessoes_pesquisa_idx" ON "sessoes_agente" USING btree ("pesquisa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usuarios_email_idx" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "usuarios_orgao_idx" ON "usuarios" USING btree ("orgao_id");