import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// Busca os itens de um edital específico no PNCP para extrair preço unitário estimado.
// Endpoint PNCP: GET /api/pncp/v1/orgaos/{cnpj14}/compras/{ano}/{sequencial}/itens
// Documentação: https://pncp.gov.br/api/pncp/swagger-ui/index.html

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cnpj = searchParams.get("cnpj")?.replace(/\D/g, ""); // apenas dígitos
  const ano  = searchParams.get("ano");
  const seq  = searchParams.get("seq")?.replace(/^0+/, ""); // remove zeros à esquerda

  if (!cnpj || !ano || !seq) {
    return NextResponse.json({ error: "Parâmetros cnpj, ano e seq são obrigatórios" }, { status: 400 });
  }

  try {
    const url = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=1&tamanhoPagina=20`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ itens: [], erro: `PNCP itens HTTP ${res.status}` });
    }

    const data = await res.json();

    // A API retorna array direto ou objeto { data: [...] }
    const raw: any[] = Array.isArray(data) ? data : (data?.data || data?.items || []);

    const itens = raw.map((item: any) => ({
      numeroItem:            item.numeroItem,
      descricao:             item.descricao || item.descricaoItem || "",
      quantidade:            item.quantidade ?? null,
      unidadeMedida:         item.unidadeMedida || item.unidade || "",
      valorUnitarioEstimado: item.valorUnitarioEstimado ?? item.valorUnitario ?? null,
      valorTotalEstimado:    item.valorTotalEstimado ?? null,
      situacao:              item.situacaoCompraItem?.nome || "",
    }));

    return NextResponse.json({ itens, total: itens.length });
  } catch (err: any) {
    return NextResponse.json({ itens: [], erro: err?.message || "Erro de rede" });
  }
}
