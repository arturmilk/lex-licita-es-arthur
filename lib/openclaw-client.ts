// ============================================================
// LEX Licitações — Agentes IA via DeepSeek API
// ============================================================
// Chama os 4 agentes da LEX Licitações via API DeepSeek (compatível OpenAI).
// Os prompts de sistema seguem as instruções dos arquivos em openclaw-skills/.
//
// Requisito: DEEPSEEK_API_KEY no .env.local

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const DEEPSEEK_MODEL = "deepseek-chat"; // use "deepseek-reasoner" para R1 (mais lento)

async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  temperature = 0.1,
  model = DEEPSEEK_MODEL
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY não configurado no ambiente");

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseJsonResponse(text: string) {
  try {
    const match = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (match) return JSON.parse(match[1]);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end !== -1) return JSON.parse(text.slice(start, end + 1));
    return JSON.parse(text);
  } catch {
    return { raw: text, error: "Não foi possível parsear JSON" };
  }
}

// ============================================================
// AGENTE EXTRATOR
// Interpreta descrições de objetos → JSON de características técnicas
// ============================================================
export async function extrairCaracteristicas(
  descricao: string,
  especificacoes: { item: string; especificacao: string; obrigatorio: boolean }[]
) {
  const systemPrompt = `Você é o Agente Extrator da LEX Licitações, especialista em análise técnica de objetos de contratação pública brasileira.

Sua função é ler descrições de objetos de compra/contratação e extrair:
1. Características técnicas estruturadas
2. Palavras-chave de busca otimizadas para encontrar contratos similares nas bases de preços do governo (PNCP, Compras.gov.br, CATMAT, CATSER)

Regras para características:
- Categoria: informatica, obras, servicos, veiculos, mobiliario, materiais, saude
- Subcategoria específica (ex.: servidores, storage, licencas-software, suporte-ti, data-center)
- Nome em snake_case (ex: tipo_servico, capacidade_storage, nivel_sla)
- Tipo "obrigatorio" ou "desejavel"
- Confiança: 90-100 explícita; 70-89 implícita; 50-69 provável; <50 incerta
- Alertas: omissões relevantes para precificação

Regras para palavras_chave_busca:
- Liste de 3 a 8 termos curtos e específicos que representam EXATAMENTE o objeto
- Foque nos substantivos técnicos principais, sem verbos ou preposições
- Para TI: inclua termos como "datacenter", "storage", "servidor", "suporte tecnico ti", "help desk", etc.
- Para materiais: inclua o nome técnico do item no catálogo (CATMAT/CATSER)
- Evite termos genéricos como "aquisição", "contratação", "fornecimento"
- Coloque os termos mais importantes PRIMEIRO

Responda APENAS com JSON válido, sem markdown:
{
  "categoria": "string",
  "subcategoria": "string",
  "palavras_chave_busca": ["termo1", "termo2", "..."],
  "caracteristicas": [
    {"nome": "string", "valor": "string", "tipo": "obrigatorio|desejavel", "confianca": 0-100, "fonte": "string"}
  ],
  "resumo": "string com até 200 caracteres",
  "alertas": ["lista de omissões relevantes para pesquisa de preços"]
}`;

  const especStr = especificacoes.length
    ? especificacoes.map(e => `- ${e.item}: ${e.especificacao} (${e.obrigatorio ? "obrigatório" : "desejável"})`).join("\n")
    : "(nenhuma especificação informada — infira as características a partir da descrição)";

  const userMessage = `Extraia as características técnicas e palavras-chave de busca do seguinte objeto de contratação pública:

Descrição: ${descricao}

Especificações informadas:
${especStr}`;

  const text = await callDeepSeek(systemPrompt, userMessage, 0.15);
  return parseJsonResponse(text);
}

// ============================================================
// AGENTE SIMILARIDADE
// Compara objeto desejado × resultado de licitação → índice 0-100
// ============================================================
export async function calcularSimilaridade(
  objeto: string,
  especificacoes: any[],
  candidato: { descricao: string; orgao: string; localizacao: string }
) {
  const systemPrompt = `Você é o Agente Similaridade da LEX Licitações, especialista em comparação semântica e técnica de objetos de contratação pública brasileira.

Compare o objeto desejado (com especificações técnicas) com um resultado obtido do Portal Nacional de Contratações Públicas (PNCP) e calcule um índice de similaridade de 0 a 100.

Regras de comparação:
1. Categoria: se as categorias forem diferentes, similaridade máxima é 30.
2. Subcategoria: se as subcategorias forem diferentes, similaridade máxima é 50.
3. Especificações obrigatórias: cada spec obrigatória do objeto que o candidato não atende reduz a similaridade em 10-20 pontos.
4. Especificações desejáveis: cada spec desejável ausente reduz em 3-5 pontos.
5. Quantidade: diferença de escala muito grande (>10x) pode reduzir em até 10 pontos.
6. Localização: diferença de região pode reduzir em até 5 pontos (menos relevante para bens, mais para serviços).
7. Semântica: termos equivalentes ("notebook" vs "computador portátil") não devem penalizar.

Escala: 95-100 quase idêntico; 85-94 muito similar; 75-84 similar; 60-74 pouco similar (análise manual); 0-59 não similar.
Recomendação: aceitar (>=75), analisar (60-74), rejeitar (<60).

Responda APENAS com JSON válido, sem markdown, sem texto extra:
{
  "similaridade": 0-100,
  "motivo": "string explicando o raciocínio da pontuação",
  "recomendacao": "aceitar|rejeitar|analisar",
  "detalhes": {
    "categoria_match": true|false,
    "specs_compativeis": ["lista de specs que batem"],
    "specs_divergentes": ["lista de specs que divergem"],
    "specs_faltantes": ["lista de specs do objeto não encontradas no candidato"],
    "alertas": ["lista de alertas"]
  }
}`;

  const userMessage = `OBJETO DESEJADO: ${objeto}
Especificações: ${JSON.stringify(especificacoes)}

CANDIDATO ENCONTRADO:
Descrição: ${candidato.descricao}
Órgão: ${candidato.orgao}
Localização: ${candidato.localizacao}`;

  const text = await callDeepSeek(systemPrompt, userMessage, 0.1);
  return parseJsonResponse(text);
}

// ============================================================
// AGENTE JUSTIFICADOR
// Redige texto formal de justificativa de preço estimado (máx. 3 parágrafos)
// ============================================================
export async function gerarJustificativa(
  estatisticas: {
    n: number;
    media: number;
    mediana: number;
    minimo: number;
    maximo: number;
    desvioPadrao: number;
    coeficienteVariacao: number;
  },
  metodo: string,
  quantidade: number,
  referenciasAceitas: number
) {
  const systemPrompt = `Você é o Agente Justificador da LEX Licitações, redator técnico-jurídico especializado em contratações públicas brasileiras (Lei 14.133/2021, Decreto 10.024/2019).

Sua função é transformar números — estatísticas, médias, medianas, desvios — em um texto justificativo formal (memória de cálculo narrativa) que fundamente o preço estimado perante órgãos de controle.

Formato: texto corrido, em português formal e institucional, com NO MÁXIMO 3 parágrafos. Não use JSON. Não use markdown. Retorne apenas texto puro.

Estrutura obrigatória:
- Parágrafo 1 (Metodologia): método de cálculo utilizado, quantidade de referências aceitas, fonte (Portal Nacional de Contratações Públicas — PNCP), período e abrangência geográfica da pesquisa.
- Parágrafo 2 (Análise dos dados): média, mediana, mínimo, máximo, desvio padrão e coeficiente de variação (CV); interprete o CV (abaixo de 15% = alta homogeneidade; 15-25% = homogeneidade aceitável; acima de 25% = dispersão significativa); mencione outliers e como foram tratados.
- Parágrafo 3 (Conclusão): preço unitário estimado e valor total; reafirme que o preço está dentro dos parâmetros de mercado; mencione que a metodologia é transparente e auditável.

Regras de redação:
1. Nunca invente dados — use APENAS os números fornecidos.
2. Nunca omita o CV, mesmo que alto.
3. Use termos da Lei 14.133/2021: "pesquisa de preços", "estimativa de custo", "referências de mercado".
4. Evite superlativos: "adequado", não "excelente". "Coerente", não "perfeito".
5. Se poucas referências (<5), mencione a limitação com cautela ("com base nas X referências disponíveis").
6. Se CV alto (>25%), justifique a dispersão ("dispersão observada justifica-se pela variabilidade do mercado").
7. Não cite marcas. Não use siglas sem explicar (PNCP por extenso na primeira menção).`;

  const userMessage = `Redija a justificativa formal do preço estimado:

Método: ${metodo}
Quantidade a contratar: ${quantidade} unidades
Referências aceitas: ${referenciasAceitas}

Estatísticas:
- N amostral: ${estatisticas.n} referências
- Média: R$ ${estatisticas.media.toFixed(2)}
- Mediana: R$ ${estatisticas.mediana.toFixed(2)}
- Mínimo: R$ ${estatisticas.minimo.toFixed(2)}
- Máximo: R$ ${estatisticas.maximo.toFixed(2)}
- Desvio padrão: R$ ${estatisticas.desvioPadrao.toFixed(2)}
- Coeficiente de variação: ${estatisticas.coeficienteVariacao.toFixed(1)}%`;

  const text = await callDeepSeek(systemPrompt, userMessage, 0.25);
  return { justificativa: text };
}

// ============================================================
// AGENTE VALIDADOR
// Verifica regras de negócio — 100% determinístico, sem LLM
// (conforme spec: "Minhas decisões são 100% determinísticas e reproduzíveis")
// ============================================================
export async function validarPesquisa(dados: {
  n: number;
  cv: number;
  min_referencias: number;
  cv_limite: number;
  similaridade_minima: number;
  menor_similaridade_aceita: number;
}) {
  const { n, cv, min_referencias, cv_limite, similaridade_minima, menor_similaridade_aceita } = dados;

  const regras = {
    min_referencias: { atende: n >= min_referencias, valor: n, minimo: min_referencias },
    cv_limite: { atende: cv <= cv_limite, valor: cv, limite: cv_limite },
    similaridade_minima: { atende: menor_similaridade_aceita >= similaridade_minima, valor: menor_similaridade_aceita, minimo: similaridade_minima },
  };

  const alertas: { tipo: "erro" | "aviso" | "info"; campo: string; mensagem: string; sugestao: string }[] = [];

  if (!regras.min_referencias.atende) {
    alertas.push({
      tipo: "erro", campo: "min_referencias",
      mensagem: `Quantidade insuficiente de referências aceitas para cálculo estatístico robusto (${n} de ${min_referencias}).`,
      sugestao: "Amplie o período de pesquisa ou relaxe filtros de região para obter mais referências.",
    });
  }
  if (!regras.cv_limite.atende) {
    alertas.push({
      tipo: "erro", campo: "cv_limite",
      mensagem: `Coeficiente de variação acima do limite aceitável, indicando alta dispersão nos preços (${cv.toFixed(1)}% > ${cv_limite}%).`,
      sugestao: "Considere usar a mediana em vez da média aritmética, ou revise referências com maior dispersão.",
    });
  }
  if (!regras.similaridade_minima.atende) {
    alertas.push({
      tipo: "aviso", campo: "similaridade_minima",
      mensagem: `Uma ou mais referências aceitas apresentam similaridade abaixo do mínimo recomendado (${menor_similaridade_aceita}% < ${similaridade_minima}%).`,
      sugestao: "Revise as referências com similaridade baixa e considere rejeitá-las.",
    });
  }

  const atendidas = [regras.min_referencias.atende, regras.cv_limite.atende, regras.similaridade_minima.atende].filter(Boolean).length;

  return {
    valido: atendidas === 3,
    score_confianca: Math.round((atendidas / 3) * 100),
    alertas,
    regras,
  };
}

// ============================================================
// HEALTH CHECK
// ============================================================
export async function healthCheck(): Promise<boolean> {
  try {
    const text = await callDeepSeek("Você é um assistente.", "ok", 0.1);
    return text.length > 0;
  } catch {
    return false;
  }
}
