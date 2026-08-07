import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const termo = searchParams.get("termo") || "";
  if (!termo) return NextResponse.json({ error: "Informe 'termo'" }, { status: 400 });

  try {
    const res = await fetch(`https://pncp.gov.br/api/pncp/v1/consulta/arquivos?termo=${encodeURIComponent(termo)}&pagina=1&tamanhoPagina=10`, { headers: { Accept: "application/json" }, next: { revalidate: 3600 } });
    if (!res.ok) return NextResponse.json({ error: `PNCP ${res.status}` }, { status: res.status });
    const data = await res.json();
    const normalizado = Array.isArray(data) ? data.map((item: any) => ({
      orgao: item.orgaoNome || "Nao informado",
      descricao: item.objetoCompra || "Sem descricao",
      quantidade: item.quantidade || 1,
      data_contrato: item.dataPublicacaoPncp || item.dataAssinatura,
      valor_unitario: item.valorUnitarioEstimado || item.valorUnitario || 0,
      valor_total: item.valorTotalHomologado || item.valorTotal || 0,
      localizacao: item.ufNome || item.municipioNome || "Nao informado",
      similaridade: 0,
      documento_origem: item.sequencialDocumento || item.numeroControlePncp || "PNCP",
      dados_brutos: item,
    })) : [];
    return NextResponse.json({ sucesso: true, totalRegistros: normalizado.length, registros: normalizado });
  } catch (err: any) {
    return NextResponse.json({ error: "Erro ao consultar PNCP", message: err.message }, { status: 500 });
  }
}
