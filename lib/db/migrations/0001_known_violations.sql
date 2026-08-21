ALTER TYPE "public"."fonte" ADD VALUE IF NOT EXISTS 'pncp_bd' BEFORE 'painel_precos';--> statement-breakpoint
ALTER TYPE "public"."fonte" ADD VALUE IF NOT EXISTS 'precos_abertos' BEFORE 'bps';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid,
	"orgao_id" uuid,
	"mensagem" text NOT NULL,
	"pagina" varchar(255),
	"lido" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "configuracoes" ALTER COLUMN "cv_alerta" SET DEFAULT 20;--> statement-breakpoint
ALTER TABLE "pesquisas" ADD COLUMN "itens" jsonb;--> statement-breakpoint
ALTER TABLE "pesquisas" ADD COLUMN "pesquisa_mercado" jsonb;--> statement-breakpoint
ALTER TABLE "pesquisas" ADD COLUMN "cv_limite" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "pesquisas" ADD COLUMN "parametros_relatorio" jsonb;--> statement-breakpoint
ALTER TABLE "pesquisas" ADD COLUMN "me_epp" jsonb;--> statement-breakpoint
ALTER TABLE "pesquisas" ADD COLUMN "decomposicao_custos" jsonb;--> statement-breakpoint
ALTER TABLE "pesquisas" ADD COLUMN "premissas" jsonb;--> statement-breakpoint
ALTER TABLE "resultados_pesquisa" ADD COLUMN "item_id" varchar(64);--> statement-breakpoint
ALTER TABLE "resultados_pesquisa" ADD COLUMN "cnpj" varchar(18);--> statement-breakpoint
ALTER TABLE "resultados_pesquisa" ADD COLUMN "fonte_dados" varchar(120);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_orgao_id_orgaos_id_fk" FOREIGN KEY ("orgao_id") REFERENCES "public"."orgaos"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feedbacks_orgao_idx" ON "feedbacks" USING btree ("orgao_id");