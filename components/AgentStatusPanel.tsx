"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock, Database } from "lucide-react";

interface SessaoAgente {
  id: string;
  nomeAgente: string;
  fonte: string;
  status: "aguardando" | "executando" | "concluido" | "erro" | "cancelado";
  totalEncontrado: number | null;
  progresso: number | null;
  mensagem: string | null;
  erro: string | null;
}

interface StatusData {
  sessoes: SessaoAgente[];
  totalResultados: number;
  concluido: boolean;
}

const FONTE_CORES: Record<string, string> = {
  pncp: "bg-blue-100 text-blue-700",
  painel_precos: "bg-green-100 text-green-700",
  compras_gov: "bg-purple-100 text-purple-700",
  bps: "bg-rose-100 text-rose-700",
  sinapi: "bg-orange-100 text-orange-700",
  sicro: "bg-yellow-100 text-yellow-700",
  manual: "bg-neutral-100 text-neutral-700",
};

const FONTE_NOMES: Record<string, string> = {
  pncp: "PNCP",
  painel_precos: "Painel de Preços",
  compras_gov: "Compras.gov.br",
  bps: "BPS Saúde",
  sinapi: "SINAPI",
  sicro: "SICRO",
  manual: "Manual",
};

function StatusIcon({ status }: { status: SessaoAgente["status"] }) {
  switch (status) {
    case "concluido":
      return <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />;
    case "erro":
      return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
    case "executando":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />;
    case "aguardando":
      return <Clock className="w-4 h-4 text-neutral-400 flex-shrink-0" />;
    default:
      return <Clock className="w-4 h-4 text-neutral-400 flex-shrink-0" />;
  }
}

interface Props {
  pesquisaId: string;
  onConcluido?: (totalResultados: number) => void;
}

export default function AgentStatusPanel({ pesquisaId, onConcluido }: Props) {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!pesquisaId) return;

    const es = new EventSource(`/api/pesquisas/${pesquisaId}/status`);
    setConectado(true);

    es.onmessage = (event) => {
      const data: StatusData = JSON.parse(event.data);
      setStatus(data);
      if (data.concluido) {
        es.close();
        setConectado(false);
        onConcluido?.(data.totalResultados);
      }
    };

    es.onerror = () => {
      setConectado(false);
      es.close();
    };

    return () => {
      es.close();
    };
  }, [pesquisaId, onConcluido]);

  if (!status) {
    return (
      <div className="flex items-center gap-2 text-neutral-500 text-sm p-4">
        <Loader2 className="w-4 h-4 animate-spin" />
        Iniciando agentes de busca...
      </div>
    );
  }

  const totalEncontrado = status.sessoes.reduce((acc, s) => acc + (s.totalEncontrado || 0), 0);
  const concluidas = status.sessoes.filter((s) => s.status === "concluido" || s.status === "erro").length;
  const progresso = status.sessoes.length > 0 ? Math.round((concluidas / status.sessoes.length) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-neutral-600" />
            <span className="text-sm font-medium text-neutral-700">
              Consultando {status.sessoes.length} fonte(s)
            </span>
            {conectado && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                ao vivo
              </span>
            )}
          </div>
          <span className="text-sm font-semibold text-neutral-800">
            {totalEncontrado} resultado(s)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-neutral-200 rounded-full h-2 mb-1">
          <div
            className="bg-neutral-800 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="text-xs text-neutral-500 text-right">{progresso}% concluído</p>
      </div>

      {/* Per-agent status */}
      <div className="space-y-2">
        {status.sessoes.map((sessao) => (
          <div
            key={sessao.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              sessao.status === "concluido"
                ? "border-green-200 bg-green-50"
                : sessao.status === "erro"
                ? "border-red-200 bg-red-50"
                : sessao.status === "executando"
                ? "border-blue-200 bg-blue-50"
                : "border-neutral-200 bg-neutral-50"
            }`}
          >
            <StatusIcon status={sessao.status} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-neutral-800 truncate">
                  {sessao.nomeAgente}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${FONTE_CORES[sessao.fonte] || "bg-neutral-100 text-neutral-600"}`}>
                  {FONTE_NOMES[sessao.fonte] || sessao.fonte}
                </span>
              </div>
              {sessao.mensagem && (
                <p className="text-xs text-neutral-500 truncate mt-0.5">{sessao.mensagem}</p>
              )}
              {sessao.erro && (
                <p className="text-xs text-red-500 truncate mt-0.5">{sessao.erro}</p>
              )}
            </div>

            {sessao.status === "concluido" && sessao.totalEncontrado !== null && (
              <span className="text-sm font-semibold text-green-700 flex-shrink-0">
                {sessao.totalEncontrado}
              </span>
            )}

            {sessao.status === "executando" && sessao.progresso !== null && sessao.progresso > 0 && (
              <span className="text-xs text-blue-600 flex-shrink-0">{sessao.progresso}%</span>
            )}
          </div>
        ))}
      </div>

      {status.concluido && (
        <div className="text-center p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm font-medium text-green-700">
            Busca concluída — {status.totalResultados} resultado(s) encontrado(s) ao total
          </p>
        </div>
      )}
    </div>
  );
}
