-- 001_melhorias_reuniao.sql
-- Melhorias pós-reunião (2026-08-19): itens, pesquisa de mercado, CV 20%,
-- parâmetros do relatório, ME/EPP, decomposição de custos, premissas.
-- Idempotente: pode rodar quantas vezes for preciso.

-- ── pesquisas: novas colunas ────────────────────────────────────────────────
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS itens jsonb;
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS pesquisa_mercado jsonb;
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS cv_limite integer DEFAULT 20;
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS parametros_relatorio jsonb;
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS me_epp jsonb;
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS decomposicao_custos jsonb;
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS premissas jsonb;

-- ── resultados_pesquisa: vínculo com item + CNPJ/fonte ──────────────────────
ALTER TABLE resultados_pesquisa ADD COLUMN IF NOT EXISTS item_id varchar(64);
ALTER TABLE resultados_pesquisa ADD COLUMN IF NOT EXISTS cnpj varchar(18);
ALTER TABLE resultados_pesquisa ADD COLUMN IF NOT EXISTS fonte_dados varchar(120);

-- ── configuracoes: limite de CV passa a ser 20% (decisão da reunião) ────────
ALTER TABLE configuracoes ALTER COLUMN cv_alerta SET DEFAULT 20;
UPDATE configuracoes SET cv_alerta = 20 WHERE cv_alerta = 25;
