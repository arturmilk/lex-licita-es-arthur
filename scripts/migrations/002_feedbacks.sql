-- 002_feedbacks.sql
-- Cria tabela de feedbacks (adicionada ao schema mas ausente nas migrações anteriores).
-- Idempotente: pode rodar quantas vezes for preciso.

CREATE TABLE IF NOT EXISTS feedbacks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  orgao_id    uuid REFERENCES orgaos(id)   ON DELETE SET NULL,
  mensagem    text NOT NULL,
  pagina      varchar(255),
  lido        boolean NOT NULL DEFAULT false,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedbacks_orgao_idx ON feedbacks USING btree (orgao_id);

-- fonte enum: garante que os valores adicionados existam (IF NOT EXISTS = idempotente, PG 9.6+)
ALTER TYPE fonte ADD VALUE IF NOT EXISTS 'pncp_bd'        BEFORE 'painel_precos';
ALTER TYPE fonte ADD VALUE IF NOT EXISTS 'precos_abertos' BEFORE 'bps';
