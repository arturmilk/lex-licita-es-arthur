import type { BuscaParams, ResultadoFonte, ResultadoBruto } from "./types";

// API de Consulta Pública do PNCP — via proxy no BRASIL (túnel reverso) ou direto.
// Documentação oficial (Manual PNCP API Consultas v1.0):
//   BASE_URL = https://pncp.gov.br/api/consulta  (SEM subdominio api.)
//   /v1/contratacoes/publicacao  (SINGULAR)  — codigoModalidadeContratacao obrigatório
//   /v1/contratacoes/proposta                 — dataFinal + modalidade obrigatórios
//   tamanhoPagina mínimo = 10
// O WAF do PNCP bloqueia IPs fora do Brasil; por isso o proxy roda num VPS BR
// (Oracle, IP brasileiro) e expõe o mesmo caminho /v1/... localmente via túnel.
// No VPS do Brasil (ex.: Hostinger) usa direto; na Europa usa o proxy via túnel.
const PROXY_BASE = (process.env.PNCP_PROXY_URL || "").replace(/\/$/, "");
const PROXY_TOKEN = process.env.PNCP_PROXY_TOKEN || "";
const DIRETO_BASE = "https://pncp.gov.br/api/consulta";
const MODALIDADE_DEFAULT = 8; // Pregão (maior volume de publicações com preços)

function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function calcSimilaridade(descricao: string, termos: string[]): number {
  const d = norm(descricao);
  if (!termos.length) return 0;
  const hits = termos.filter((t) => d.includes(t));
  return Math.round((hits.length / termos.length) * 100);
}

// data no formato AAAAMMDD exigido pelo PNCP
function dataFormatada(diasAtras: number): string {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function buscarPNCP(params: BuscaParams): Promise<ResultadoFonte> {
  const { termo, pagina = 1, tamanhoPagina = 10 } = params;
  const termos = norm(termo).split(/\s+/).filter((t) => t.length > 2);

  try {
    // endpoint documentado: /v1/contratacoes/publicacao (singular)
    const base = PROXY_BASE || DIRETO_BASE;
    const url = new URL(`${base}/v1/contratacoes/publicacao`);
    url.searchParams.set("dataInicial", params.dataInicial || dataFormatada(180));
    url.searchParams.set("dataFinal", params.dataFinal || dataFormatada(0));
    url.searchParams.set("codigoModalidadeContratacao", String(params.modalidade || MODALIDADE_DEFAULT));
    url.searchParams.set("pagina", String(pagina));
    url.searchParams.set("tamanhoPagina", String(Math.max(10, Math.min(tamanhoPagina || 10, 50))));

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };
    if (PROXY_TOKEN) headers["X-Api-Key"] = PROXY_TOKEN;

    const res = await fetch(url.toString(), { headers, next: { revalidate: 1800 } });
    if (!res.ok) {
      return { fonte: "pncp", items: [], total: 0, erro: `PNCP HTTP ${res.status}` };
    }

    const data = await res.json();
    const raw: any[] = Array.isArray(data) ? data : data?.data || data?.items || [];

    // a API não tem busca por termo — filtra aqui
    const filtrados = raw.filter((r: any) => {
      const texto = norm(r?.objetoCompra || r?.descricao || "");
      return termos.some((t) => texto.includes(t));
    });

    const items: ResultadoBruto[] = filtrados.map((r: any) => {
      const unidade = r?.unidadeOrgao || {};
      const orgao = r?.orgaoEntidade || {};
      const estimado = r?.valorTotalEstimado != null ? Number(r.valorTotalEstimado) : null;
      const homologado = r?.valorTotalHomologado != null ? Number(r.valorTotalHomologado) : null;
      const valor = homologado && homologado > 0 ? homologado : estimado;
      const id = r?.numeroControlePNCP || `${r?.sequencialCompra || ""}-${r?.anoCompra || ""}`;
      return {
        fonte: "pncp" as const,
        orgao: unidade?.nomeUnidade || orgao?.razaoSocial || "Não informado",
        descricao: r?.objetoCompra || r?.descricao || "Sem descrição",
        quantidade: null,
        dataContrato: r?.dataPublicacaoPncp || r?.dataAberturaProposta || null,
        valorUnitario: null,
        valorTotal: Number.isFinite(valor) ? valor : null,
        localizacao: unidade?.municipioNome ? `${unidade.municipioNome}/${unidade?.ufSigla || ""}` : unidade?.ufSigla || null,
        similaridade: calcSimilaridade(r?.objetoCompra || "", termos),
        documentoOrigem: id || null,
        linkEdital: id ? `https://pncp.gov.br/app/compra/${encodeURIComponent(id)}` : null,
        dadosBrutos: r as unknown as Record<string, unknown>,
      };
    });

    items.sort((a, b) => b.similaridade - a.similaridade);
    return { fonte: "pncp", items, total: items.length };
  } catch (err: any) {
    return { fonte: "pncp", items: [], total: 0, erro: String(err?.message || err) };
  }
}
