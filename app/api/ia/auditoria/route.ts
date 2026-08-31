import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

/**
 * POST /api/ia/auditoria — AGENTE AUDITOR
 * Explica as diferenças entre os preços das referências (região, quantidade,
 * época, porte do órgão) com base nos DADOS REAIS enviados. Regra de ouro:
 * hipóteses com evidência, nunca afirmação inventada (em licitação pública,
 * explicação inventada = problema sério). O cálculo NUMÉRICO nunca vem da IA.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { objeto, quantidade, unidadeMedida, localEntrega, referencias } = body;

    if (!Array.isArray(referencias) || referencias.length < 2) {
      return NextResponse.json({ analise: "São necessárias pelo menos 2 referências com valor para a análise." }, { status: 422 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ analise: "IA não configurada neste servidor." }, { status: 501 });
    }

    // Prepara os dados das referências (só o que é factual)
    const linhas = referencias.map((r, i) =>
      `Ref ${i + 1}: órgão=${r.orgao || "—"} | valor=${r.valor} | qtd=${r.quantidade ?? "—"} | data=${r.data || "—"} | local=${r.localizacao || "—"} | similaridade=${r.similaridade ?? "—"}% | ${(r.descricao || "").slice(0, 60)}`
    ).join("\n");

    const system = `Você é o Agente Auditor de um sistema de pesquisa de preços para licitações públicas (Lei 14.133/2021 e IN 126/2023-TJRO).

Sua função: analisar as referências de preço abaixo e EXPLICAR as diferenças entre elas, baseando-se SOMENTE nos dados fornecidos (região/localização, quantidade, data, similaridade com o objeto).

REGRAS OBRIGATÓRIAS:
1. NUNCA invente motivos: toda explicação deve apontar a evidência nos dados ("este preço é maior e o edital é de 2024, mais recente", "órgão de outra região"). Se não houver evidência, diga "não há dados suficientes para explicar esta diferença".
2. Use hipóteses com linguagem de hipótese ("pode refletir", "possivelmente"), nunca afirmação categórica sem base.
3. Estrutura da resposta:
   - VISÃO GERAL: 1-2 frases sobre a dispersão dos preços (ampla/estreita, CV se der para estimar).
   - DIFERENÇAS: bullet points apontando as diferenças observadas com a evidência de cada uma.
   - PONTO DE ATENÇÃO: se algum preço destoa muito (inexequível ou sobrepreço), aponte conforme IN 126 (art. 3º IV e VII).
   - RECOMENDAÇÃO: qual metodologia (média/mediana/menor preço) parece mais adequada e por quê, considerando a IN 126 art. 11.
4. Responda em português claro, sem emojis, máximo 350 palavras.`;

    const user = `Objeto: ${objeto || "—"}\nQuantidade: ${quantidade ?? "—"} ${unidadeMedida || ""}\nLocal de entrega: ${localEntrega || "—"}\n\nReferências:\n${linhas}`;

    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return NextResponse.json({ analise: `Erro ao consultar a IA (${res.status}).` }, { status: 502 });
    }
    const data = await res.json();
    const analise = data.choices?.[0]?.message?.content || "";
    return NextResponse.json({ analise });
  } catch (e: any) {
    return NextResponse.json({ analise: `Erro: ${String(e?.message || e).slice(0, 120)}` }, { status: 500 });
  }
}
