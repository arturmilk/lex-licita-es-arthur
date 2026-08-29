/**
 * Serviço de IA do Estima.IA — usado para:
 *  1. Escrita assistida de documentos administrativos (minutas)
 *  2. Leitura e resumo de documentos (PDF/processos)
 *  3. Assistente contextual "Me ajuda"
 *
 * Provedor: DeepSeek (compatível com OpenAI SDK). Nunca exponha a chave.
 */

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = "https://api.deepseek.com";
const MODEL = "deepseek-chat";

interface ChatMsg {
  role: "system" | "user";
  content: string;
}

async function chat(messages: ChatMsg[], temperature = 0.3): Promise<string> {
  if (!API_KEY) throw new Error("DEEPSEEK_API_KEY não configurada.");
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: 2000 }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`IA falhou (${res.status}): ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

/**
 * 1. Escrita assistida: transforma um pedido em linguagem natural em texto
 * administrativo adequado (despacho, parecer, memorando, ofício, justificativa).
 */
export async function escreverDocumento(opts: {
  tipo: string;
  pedido: string;
  contexto?: { numeroProcesso?: string; objeto?: string; orgao?: string; servidor?: string; data?: string };
}): Promise<string> {
  const ctx = opts.contexto || {};
  const system = [
    "Você é um assistente de redação oficial para servidores públicos brasileiros.",
    "Escreva documentos administrativos conforme o Manual de Redação da Presidência da República.",
    "Use linguagem formal, impessoal, clara e objetiva.",
    "Estruture o documento no formato adequado ao tipo solicitado (DESPACHO, PARECER, MEMORANDO, OFÍCIO, JUSTIFICATIVA, RELATÓRIO).",
    "Inclua cabeçalho com processo, data e autor quando os dados forem fornecidos.",
    "NÃO invente números de processo, leis ou fatos que não foram informados.",
    "Retorne apenas o texto do documento, sem comentários.",
  ].join("\n");

  const user = [
    `Tipo de documento: ${opts.tipo}`,
    `Pedido do servidor: "${opts.pedido}"`,
    ctx.numeroProcesso ? `Número do processo: ${ctx.numeroProcesso}` : "",
    ctx.objeto ? `Objeto: ${ctx.objeto}` : "",
    ctx.orgao ? `Órgão: ${ctx.orgao}` : "",
    ctx.servidor ? `Servidor: ${ctx.servidor}` : "",
    ctx.data ? `Data: ${ctx.data}` : "",
  ].filter(Boolean).join("\n");

  return chat([{ role: "system", content: system }, { role: "user", content: user }]);
}

/**
 * 2. Leitura e resumo de documentos: recebe o texto extraído de um PDF/processo
 * e devolve: o que aconteceu, o que importa, o que falta, prazos e ação necessária.
 */
export async function resumirDocumento(texto: string): Promise<{
  aconteceu: string;
  importa: string;
  falta: string;
  prazos: string;
  acao: string;
  resumoCompleto: string;
}> {
  const system = [
    "Você é um analista de documentos administrativos de órgãos públicos.",
    "Leia o documento fornecido e produza um resumo estruturado em português.",
    "Responda APENAS com JSON válido com estas chaves:",
    '{"aconteceu": "o que aconteceu no documento", "importa": "o que é importante", "falta": "o que falta ou está pendente", "prazos": "prazos mencionados ou implicados", "acao": "qual ação precisa ser tomada", "resumoCompleto": "resumo em 2-3 parágrafos"}',
    "Se algo não existir no documento, use 'não identificado'.",
  ].join("\n");

  const user = `Documento:\n\n${texto.slice(0, 12000)}`;
  const resposta = await chat([{ role: "system", content: system }, { role: "user", content: user }], 0.2);

  try {
    const inicio = resposta.indexOf("{");
    const fim = resposta.lastIndexOf("}");
    const json = JSON.parse(resposta.slice(inicio, fim + 1));
    return {
      aconteceu: json.aconteceu || "não identificado",
      importa: json.importa || "não identificado",
      falta: json.falta || "não identificado",
      prazos: json.prazos || "não identificado",
      acao: json.acao || "não identificado",
      resumoCompleto: json.resumoCompleto || resposta,
    };
  } catch {
    return {
      aconteceu: "erro ao estruturar",
      importa: "erro ao estruturar",
      falta: "erro ao estruturar",
      prazos: "erro ao estruturar",
      acao: "erro ao estruturar",
      resumoCompleto: resposta,
    };
  }
}

/**
 * 3. Assistente contextual "Me ajuda": entende onde o servidor está
 * (página, processo, etapa atual) e responde com orientação prática.
 */
export async function meAjuda(opts: {
  pergunta: string;
  contextoPagina: string;
  dadosAdicionais?: string;
}): Promise<string> {
  const system = [
    "Você é o assistente contextual do Estima.IA, um sistema de gestão de processos para servidores públicos.",
    "O servidor pediu ajuda DENTRO do sistema, em uma tela específica.",
    "Responda de forma prática e direta: o que ele deve fazer AGORA, passo a passo.",
    "Se a pergunta envolver legislação, cite a fonte. Se envolver o sistema, explique onde clicar.",
    "Máximo 250 palavras.",
  ].join("\n");

  const user = [
    `Onde o servidor está: ${opts.contextoPagina}`,
    opts.dadosAdicionais ? `Contexto adicional: ${opts.dadosAdicionais}` : "",
    `Pergunta: "${opts.pergunta}"`,
  ].filter(Boolean).join("\n");

  return chat([{ role: "system", content: system }, { role: "user", content: user }], 0.3);
}
