-- 003_pesquisa_precos_gov.sql
-- Adiciona valor 'pesquisa_precos_gov' ao enum fonte (Pesquisa de Preços Gov / dadosabertos).
ALTER TYPE fonte ADD VALUE IF NOT EXISTS 'pesquisa_precos_gov' BEFORE 'bps';
