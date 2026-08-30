/**
 * Busca de julgados (acórdãos) em tribunais de contas — TCU e TCE-RO.
 *
 * Endpoints validados (2026-08):
 *  - TCU:   GET https://pesquisa.apps.tcu.gov.br/rest/publico/base/acordao-completo/documentosResumidos
 *           ?termo=...&pagina=0&tamanhoPagina=N  (headers Referer/Origin obrigatórios;
 *           rate limit ~1 req/5s — firewall de aplicação)
 *  - TCE-RO (Papyrus): GET https://papyrus.tce.ro.gov.br/api/espelho/buscar
 *           ?textoLivre=...&pagina=1&tamanhoPagina=N  (result em source{...})
 */

export interface JulgadoEncontrado {
  tribunal: "tcu" | "tce_ro";
  numero: string;          // ex: "1888/2026" | "28195"
  relator: string;
  orgaoJulgador: string;
  ementa: string;
  link: string;
  assunto: string;
  data?: string;
  processo?: string;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function limparEmenta(frag: string): string {
  return (frag || "").replace(/<[^>]*>/g, "").replace(/\.\.\./g, "").trim();
}

function linkTCU(numAcordao: string, anoAcordao: string): string {
  // Link direto para o acórdão na pesquisa textual do TCU
  return `https://pesquisa.apps.tcu.gov.br/#/resultado/acordao-completo/${encodeURIComponent(`NUMACORDAO:${numAcordao} ANOACORDAO:${anoAcordao}`)}`;
}

/** Busca acórdãos no TCU (texto livre). Retorna vazio + erro se bloqueado. */
export async function buscarTCU(termo: string, limite = 6): Promise<JulgadoEncontrado[]> {
  try {
    const url = `https://pesquisa.apps.tcu.gov.br/rest/publico/base/acordao-completo/documentosResumidos?termo=${encodeURIComponent(termo)}&pagina=0&tamanhoPagina=${limite}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
        Referer: "https://pesquisa.apps.tcu.gov.br/",
        Origin: "https://pesquisa.apps.tcu.gov.br",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const docs = data?.documentos || [];
    return docs
      .filter((d: any) => d?.NUMACORDAO)
      .slice(0, limite)
      .map((d: any) => ({
        tribunal: "tcu" as const,
        numero: `${d.NUMACORDAO}/${d.ANOACORDAO}`,
        relator: d.RELATOR || "—",
        orgaoJulgador: d.ORGAOJULGADOR || (d.TITULO || "").includes("PLENÁRIO") ? "Plenário" : "—",
        ementa: [limparEmenta(d.FRAGMENTO1), limparEmenta(d.FRAGMENTO2)].filter(Boolean).join(" ").slice(0, 600),
        link: linkTCU(d.NUMACORDAO, d.ANOACORDAO),
        assunto: "TCU",
      }));
  } catch {
    return [];
  }
}

/** Busca acórdãos no TCE-RO (Papyrus). */
export async function buscarTCE_RO(termo: string, limite = 6): Promise<JulgadoEncontrado[]> {
  try {
    const url = `https://papyrus.tce.ro.gov.br/api/espelho/buscar?textoLivre=${encodeURIComponent(termo)}&pagina=1&tamanhoPagina=${limite}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": UA,
        Referer: "https://papyrus.tce.ro.gov.br/",
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const result = data?.result || [];
    return result
      .map((r: any) => r?.source || {})
      .filter((s: any) => s?.idDecisao)
      .slice(0, limite)
      .map((s: any) => ({
        tribunal: "tce_ro" as const,
        numero: String(s.numero || s.idDecisao),
        relator: s.relator || "—",
        orgaoJulgador: s.orgaoJulgador || "Pleno",
        ementa: String(s.ementa || "").slice(0, 600),
        link: `https://papyrus.tce.ro.gov.br/acordao/${s.idDecisao}`,
        assunto: String(s.assunto || ""),
        data: s.data || "",
        processo: String(s.processo || ""),
      }));
  } catch {
    return [];
  }
}

/** Busca julgados em todos os tribunais disponíveis (TCU + TCE-RO em paralelo). */
export async function buscarJulgadosMulti(termo: string, limite = 6): Promise<JulgadoEncontrado[]> {
  const [tcu, tce] = await Promise.all([buscarTCU(termo, limite), buscarTCE_RO(termo, limite)]);
  // TCE-RO primeiro (local — mais relevante para o servidor de RO), depois TCU
  return [...tce, ...tcu];
}
