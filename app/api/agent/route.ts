import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    name: "LEX Licitações Agent API",
    version: "2.0",
    description: "API para integração com agentes de IA para pesquisa de preços de licitações públicas",
    authentication: "Bearer token via header Authorization ou X-API-Key header",
    endpoints: [
      { method: "GET", path: "/api/agent/pesquisas", description: "Listar pesquisas" },
      { method: "POST", path: "/api/agent/pesquisas", description: "Criar pesquisa" },
      { method: "GET", path: "/api/agent/pesquisas/:id", description: "Obter detalhes de pesquisa" },
      { method: "POST", path: "/api/agent/pncp", description: "Buscar no PNCP" },
      { method: "POST", path: "/api/agent/calcular", description: "Calcular preço estimado" },
    ],
  });
}
