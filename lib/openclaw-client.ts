// ============================================================
// Estima.IA — Agentes IA via Anthropic Claude API
// ============================================================
// Chama os 4 agentes da Estima.IA diretamente via API da Anthropic.
// Os prompts de sistema vêm dos arquivos SKILL.md/AGENT.md em openclaw-skills/.
//
// Requisitos:
// - ANTHROPIC_API_KEY no .env.local
// - npm install @anthropic-ai/sdk

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = "claude-sonnet-4-6";

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
  const systemPrompt = `Você é o Agente Extrator da Estima.IA, especialista em análise técnica de objetos de contratação pública brasileira.

Sua função é ler descrições de objetos de compra/contratação e extrair características técnicas estruturadas em JSON.

Regras:
- Categoria: use categorias como informatica, obras, servicos, veiculos, mobiliario, materiais
- Nome das características em snake_case (ex: processador, memoria_ram, tamanho_tela)
- Tipo "obrigatorio": mencionado com "deverá", "deve", "mínimo", "obrigatório" ou essencial para funcionamento
- Tipo "desejavel": mencionado com "desejável", "preferencialmente" ou é um diferencial
- Confiança 90-100: informação explícita; 70-89: implícita mas clara; 50-69: ambígua; 0-49: incerta
- Sempre inclua "fonte" com o trecho do texto original

Responda APENAS com JSON válido, sem markdown, sem texto extra:
{
  "categoria": "string",
  "subcategoria": "string",
  "caracteristicas": [
    {
      "nome": "string",
      "valor": "string",
      "tipo": "obrigatorio|desejavel",
      "confianca": 0-100,
      "fonte": "string"
    }
  ],
  "resumo": "string com até 200 caracteres",
  "alertas": ["lista de ambiguidades ou omissões"]
}`;

  const userMessage = `Extraia as características técnicas do seguinte objeto de contratação:

Descrição: ${descricao}

Especificações informadas:
${especificacoes.map((e) => `- ${e.item}: ${e.especificacao} (${e.obrigatorio ? "obrigatório" : "desejável"})`).join("\n")}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
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
  const systemPrompt = `Você é o Agente de Similaridade da Estima.IA, especialista em comparação técnica de objetos de contratação pública.

Sua função é calcular o índice de similaridade técnica entre um objeto desejado e um resultado encontrado em licitações.

Critérios de avaliação:
- Similaridade técnica das especificações (peso 60%)
- Compatibilidade de uso/função (peso 30%)
- Correspondência de categoria (peso 10%)

Escala:
- 90-100: altamente similar, pode ser usado como referência direta
- 75-89: similar, com pequenas diferenças
- 50-74: parcialmente similar, use com cautela
- 0-49: baixa similaridade, não recomendado como referência

Responda APENAS com JSON válido:
{
  "similaridade": 0-100,
  "justificativa": "string explicando o índice",
  "pontos_convergentes": ["lista"],
  "pontos_divergentes": ["lista"],
  "recomendacao": "aceitar|avaliar|rejeitar"
}`;

  const userMessage = `Compare os objetos abaixo:

OBJETO DESEJADO: ${objeto}
Especificações: ${JSON.stringify(especificacoes)}

CANDIDATO ENCONTRADO:
Descrição: ${candidato.descricao}
Órgão: ${candidato.orgao}
Localização: ${candidato.localizacao}`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  return parseJsonResponse(text);
}

// ============================================================
// AGENTE JUSTIFICADOR
// Redige texto formal de justificativa de preço estimado
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
  const systemPrompt = `Você é o Agente Justificador da Estima.IA, especialista em redação de justificativas de preços para contratações públicas brasileiras.

Sua função é redigir textos formais de justificativa de preço estimado, em conformidade com a Lei 14.133/2021.

Diretrizes:
- Use linguagem técnica e formal
- Cite as estatísticas apresentadas com precisão
- Mencione o método de cálculo utilizado
- Justifique a robustez da amostragem
- Redija em português formal, sem abreviações
- O texto deve ser autocontido e não referenciar arquivos externos`;

  const userMessage = `Redija uma justificativa formal de preço estimado com base nos dados abaixo:

Método de estimativa: ${metodo}
Quantidade a contratar: ${quantidade} unidades
Referências de preço aceitas: ${referenciasAceitas}

Estatísticas das referências:
- N amostral: ${estatisticas.n} referências
- Média: R$ ${estatisticas.media.toFixed(2)}
- Mediana: R$ ${estatisticas.mediana.toFixed(2)}
- Mínimo: R$ ${estatisticas.minimo.toFixed(2)}
- Máximo: R$ ${estatisticas.maximo.toFixed(2)}
- Desvio padrão: R$ ${estatisticas.desvioPadrao.toFixed(2)}
- Coeficiente de variação: ${estatisticas.coeficienteVariacao.toFixed(1)}%`;

  const msg = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  return { justificativa: text };
}

// ============================================================
// AGENTE VALIDADOR
// Verifica regras de negócio e emite alertas
// ============================================================
export async function validarPesquisa(dados: {
  n: number;
  cv: number;
  min_referencias: number;
  cv_limite: number;
  similaridade_minima: number;
  menor_similaridade_aceita: number;
}) {
  const systemPrompt = `Você é o Agente Validador da Estima.IA, especialista em validação de pesquisas de preços para contratações públicas.

Sua função é verificar se uma pesquisa de preços atende às regras da Lei 14.133/2021 e das normas do PNCP.

Regras de validação:
- Mínimo de referências: pelo menos ${dados.min_referencias} preços válidos
- Coeficiente de variação: deve ser menor que ${dados.cv_limite}% (alta variação indica amostra heterogênea)
- Similaridade mínima: cada referência deve ter pelo menos ${dados.similaridade_minima}% de similaridade

Responda APENAS com JSON válido:
{
  "valido": true|false,
  "alertas": ["lista de problemas encontrados"],
  "recomendacoes": ["lista de ações sugeridas"],
  "nivel_confiabilidade": "alto|medio|baixo"
}`;

  const userMessage = `Valide a pesquisa de preços com os seguintes dados:

- Número de referências (n): ${dados.n}
- Coeficiente de variação (CV): ${dados.cv.toFixed(1)}%
- Menor similaridade aceita: ${dados.menor_similaridade_aceita}%
- Limite de CV configurado: ${dados.cv_limite}%
- Mínimo de referências configurado: ${dados.min_referencias}
- Similaridade mínima configurada: ${dados.similaridade_minima}%`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.1,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  return parseJsonResponse(text);
}

// ============================================================
// HEALTH CHECK
// ============================================================
export async function healthCheck(): Promise<boolean> {
  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 10,
      messages: [{ role: "user", content: "ok" }],
    });
    return msg.content.length > 0;
  } catch {
    return false;
  }
}
