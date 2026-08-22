-- Logs do sistema (monitoramento persistente — painel admin)
CREATE TABLE IF NOT EXISTS logs_sistema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  evento varchar(100) NOT NULL,
  dados jsonb
);
CREATE INDEX IF NOT EXISTS logs_sistema_ts_idx ON logs_sistema (ts);
CREATE INDEX IF NOT EXISTS logs_sistema_evento_idx ON logs_sistema (evento);
