// ============================================================
// Estima.IA — Agentes IA via DeepSeek API
// ============================================================
// Chama os 4 agentes da Estima.IA via API DeepSeek (compatível OpenAI).
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
    {"nome": "string", "valor": "string", "tipo": "obrigatorio|desejavel", "confianca": 0-100, "fonte": "string"}
  ],
  "resumo": "string com até 200 caracteres",
  "alertas": ["lista de ambiguidades ou omissões"]
}`;

  const userMessage = `Extraia as características técnicas do seguinte objeto de contratação:

Descrição: ${descricao}

Especificações informadas:
${especificacoes.map((e) => `- ${e.item}: ${e.especificacao} (${e.obrigatorio ? "obrigatório" : "desejável"})`).join("\n")}`;

  const text = await callDeepSeek(systemPrompt, userMessage, 0.1);
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

Calcule o índice de similaridade técnica entre um objeto desejado e um resultado encontrado em licitações.

Critérios: similaridade técnica das especificações (60%), compatibilidade de uso/função (30%), correspondência de categoria (10%).

Escala: 90-100=altamente similar, 75-89=similar, 50-74=parcialmente similar, 0-49=baixa similaridade.

Responda APENAS com JSON válido:
{
  "similaridade": 0-100,
  "justificativa": "string",
  "pontos_convergentes": ["lista"],
  "pontos_divergentes": ["lista"],
  "recomendacao": "aceitar|avaliar|rejeitar"
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
  const systemPrompt = `Você é o Agente Justificador da Estima.IA, especialista em redação de justificativas de preços para contratações públicas brasileiras (Lei 14.133/2021).

Redija textos formais de justificativa de preço estimado. Use linguagem técnica e formal, cite as estatísticas com precisão, mencione o método de cálculo, justifique a robustez da amostragem. Escreva em português formal, sem abreviações. O texto deve ser autocontido.`;

  const userMessage = `Redija uma justificativa formal de preço estimado:

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

  const text = await callDeepSeek(systemPrompt, userMessage, 0.3);
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
  const systemPrompt = `Você é o Agente Validador da Estima.IA. Verifique se a pesquisa de preços atende às regras da Lei 14.133/2021.

Regras:
- Mínimo de ${dados.min_referencias} referências de preço válidas
- Coeficiente de variação deve ser menor que ${dados.cv_limite}%
- Cada referência deve ter pelo menos ${dados.similaridade_minima}% de similaridade

Responda APENAS com JSON válido:
{
  "valido": true|false,
  "alertas": ["lista de problemas encontrados"],
  "recomendacoes": ["lista de ações sugeridas"],
  "nivel_confiabilidade": "alto|medio|baixo"
}`;

  const userMessage = `Valide a pesquisa:
- Referências (n): ${dados.n}
- Coeficiente de variação: ${dados.cv.toFixed(1)}%
- Menor similaridade aceita: ${dados.menor_similaridade_aceita}%
- Limite CV: ${dados.cv_limite}%
- Mínimo referências: ${dados.min_referencias}
- Similaridade mínima: ${dados.similaridade_minima}%`;

  const text = await callDeepSeek(systemPrompt, userMessage, 0.1);
  return parseJsonResponse(text);
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
