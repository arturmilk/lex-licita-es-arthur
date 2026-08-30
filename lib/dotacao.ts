/**
 * Sugestão de dotação orçamentária baseada no OBJETO da contratação.
 *
 * Classificação da despesa (padrão SIAFI/LOA):
 *   Programa de Trabalho: 2026.<FUNÇÃO>.<SUBFUNÇÃO>.<PROGRAMA>.<AÇÃO>.<NATUREZA>
 *   Natureza de despesa (item): 3.3.90.30 = material de consumo
 *                               3.3.90.39 = outros serviços de terceiros
 *                               3.3.90.14 = diárias
 *                               3.3.90.33 = passagens
 *                               4.4.90.52 = equipamentos/material permanente
 *                               3.3.90.40 = serviços de TI
 *
 * A sugestão é determinística (regras por palavras-chave do objeto) — rápida
 * e auditável; a dotação EXATA depende do PPA/LOA do órgão, então o servidor
 * valida com a unidade de orçamento antes de usar.
 */

interface SugestaoDotacao {
  classificacao: string;        // ex: 2026.04.122.2001.0001.3.3.90.30
  funcao: string;               // ex: 04 — Administração
  subfuncao: string;            // ex: 122 — Administração Geral
  natureza: string;             // ex: 3.3.90.30 — Material de consumo
  descricao: string;            // explicação curta
  compatibilidade: number;      // 0-100
  palavrasChave: string[];
}

interface RegraDotacao {
  keywords: string[];
  funcao: string;
  subfuncao: string;
  programa: string;
  acao: string;
  natureza: string;
  naturezaNome: string;
  descricao: string;
}

const REGRAS: RegraDotacao[] = [
  {
    keywords: ["papel", "toner", "cartucho", "caneta", "material de escritório", "material de consumo", "resma", "impressão", "suprimento"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "3.3.90.30", naturezaNome: "Material de consumo",
    descricao: "Materiais de consumo em geral (papel, toner, cartuchos) — administração",
  },
  {
    keywords: ["ar-condicionado", "manutenção predial", "manutenção de equipamento", "reparo", "conserto", "reforma", "manutenção", "instalação", "limpeza", "conservação", "jardinagem", "vigilância", "segurança patrimonial"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "3.3.90.39", naturezaNome: "Outros serviços de terceiros — PJ",
    descricao: "Serviços de manutenção, conservação e reparos (contratação de pessoa jurídica)",
  },
  {
    keywords: ["computador", "notebook", "servidor", "impressora", "monitor", "equipamento", "mobiliário", "mesa", "cadeira", "veículo", "máquina", "material permanente"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "4.4.90.52", naturezaNome: "Equipamentos e material permanente",
    descricao: "Aquisição de equipamentos e material permanente (bens duráveis)",
  },
  {
    keywords: ["software", "licença", "sistema", "plataforma", "nuvem", "cloud", "tecnologia da informação", "ti ", "datacenter", "firewall", "antivírus", "email", "hosting", "hospedagem"],
    funcao: "04", subfuncao: "126", programa: "2001", acao: "0001",
    natureza: "3.3.90.40", naturezaNome: "Serviços de tecnologia da informação",
    descricao: "Serviços de TI e comunicação (software, licenças, nuvem)",
  },
  {
    keywords: ["diária", "diarias", "hospedagem", "estadia"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "3.3.90.14", naturezaNome: "Diárias — civil",
    descricao: "Diárias para viagens a serviço (hospedagem e alimentação)",
  },
  {
    keywords: ["passagem", "aérea", "aerea", "avião", "aviao", "transporte de pessoa", "bilhete", "ticket"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "3.3.90.33", naturezaNome: "Passagens e despesas com locomoção",
    descricao: "Passagens aéreas/terrestres para deslocamento a serviço",
  },
  {
    keywords: ["remédio", "medicamento", "fármaco", "insumo de saúde", "material hospitalar", "luvas", "seringa", "equipamento médico", "saúde"],
    funcao: "10", subfuncao: "302", programa: "2001", acao: "0001",
    natureza: "3.3.90.30", naturezaNome: "Material de consumo — saúde",
    descricao: "Medicamentos e insumos de saúde (função Saúde, assistência hospitalar)",
  },
  {
    keywords: ["cesta básica", "gênero alimentício", "alimentação", "gêneros alimenticios", "alimento", "merenda"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "3.3.90.30", naturezaNome: "Material de consumo — gêneros alimentícios",
    descricao: "Gêneros alimentícios (alimentação, merenda, cestas)",
  },
  {
    keywords: ["uniforme", "fardamento", "epi", "equipamento de proteção", "vestuário", "calçado"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "3.3.90.30", naturezaNome: "Material de consumo — vestuário/EPI",
    descricao: "Uniformes, EPIs e vestuário de trabalho",
  },
  {
    keywords: ["energia", "eletricidade", "água", "telefone", "internet", "correio", "frete", "combustível", "combustivel", "gás"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "3.3.90.30", naturezaNome: "Material de consumo — utilidades",
    descricao: "Utilidades (água, energia, combustível) e serviços de comunicação",
  },
  {
    keywords: ["obra", "construção", "construcao", "pavimentação", "pavimentacao", "reforma de prédio", "engenharia", "infraestrutura"],
    funcao: "15", subfuncao: "451", programa: "2001", acao: "0001",
    natureza: "4.4.90.51", naturezaNome: "Obras e instalações",
    descricao: "Obras e instalações (construção, reforma, pavimentação)",
  },
  {
    keywords: ["treinamento", "capacitação", "capacitacao", "curso", "palestra", "oficina", "evento", "congresso", "seminário", "seminario"],
    funcao: "04", subfuncao: "128", programa: "2001", acao: "0001",
    natureza: "3.3.90.39", naturezaNome: "Outros serviços de terceiros — capacitação",
    descricao: "Capacitação, treinamentos, cursos e eventos",
  },
  {
    keywords: ["publicidade", "propaganda", "divulgação", "divulgacao", "imprensa", "mídia", "midia"],
    funcao: "04", subfuncao: "131", programa: "2001", acao: "0001",
    natureza: "3.3.90.39", naturezaNome: "Outros serviços de terceiros — publicidade",
    descricao: "Publicidade e divulgação institucional",
  },
  {
    keywords: ["terceirização", "terceirizacao", "mão de obra", "mao de obra", "posto de trabalho", "vigilante", "recepcionista", "auxiliar de serviços"],
    funcao: "04", subfuncao: "122", programa: "2001", acao: "0001",
    natureza: "3.3.90.39", naturezaNome: "Outros serviços de terceiros — mão de obra",
    descricao: "Terceirização de mão de obra (postos de trabalho)",
  },
  {
    keywords: ["material didático", "didatico", "livro", "publicação", "publicacao", "biblioteca"],
    funcao: "12", subfuncao: "361", programa: "2001", acao: "0001",
    natureza: "3.3.90.30", naturezaNome: "Material de consumo — didático",
    descricao: "Material didático, livros e publicações (função Educação)",
  },
];

/** Normaliza termo (minúsculas, sem acentos). */
function norm(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Sugere dotações orçamentárias com base no objeto descrito.
 * Retorna opções ordenadas por compatibilidade (0-100).
 */
export function sugerirDotacao(objeto: string): SugestaoDotacao[] {
  const termoNorm = norm(objeto);
  const palavras = termoNorm.split(/[^a-z0-9]+/).filter((w) => w.length > 2);

  const pontuadas: SugestaoDotacao[] = [];
  for (const regra of REGRAS) {
    const hits = regra.keywords.filter((k) => termoNorm.includes(norm(k)));
    const hitsPalavra = regra.keywords.filter((k) => {
      const kn = norm(k);
      // aceita palavra exata (ou contida se for composta)
      return palavras.includes(kn) || (kn.includes(" ") && termoNorm.includes(kn));
    });
    const uniao = new Set([...hits, ...hitsPalavra]);
    if (uniao.size === 0) continue;

    const compat = Math.min(95, 40 + uniao.size * 15 + (uniao.size >= 2 ? 10 : 0));
    pontuadas.push({
      classificacao: `2026.${regra.funcao}.${regra.subfuncao}.${regra.programa}.${regra.acao}.${regra.natureza}`,
      funcao: regra.funcao,
      subfuncao: regra.subfuncao,
      natureza: regra.natureza,
      descricao: regra.descricao,
      compatibilidade: compat,
      palavrasChave: Array.from(uniao),
    });
  }

  // Ordena por compatibilidade (maior primeiro) e deduplica
  const vistos = new Set<string>();
  return pontuadas
    .sort((a, b) => b.compatibilidade - a.compatibilidade)
    .filter((s) => {
      if (vistos.has(s.classificacao)) return false;
      vistos.add(s.classificacao);
      return true;
    })
    .slice(0, 4);
}
