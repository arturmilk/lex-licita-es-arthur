import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ia";

export const maxDuration = 60;

function clean(v: unknown, max = 1200) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const objeto = clean(body?.objeto, 2500);
    const referencias = Array.isArray(body?.referencias) ? body.referencias.slice(0, 20) : [];

    if (!objeto || objeto.length < 4) {
      return NextResponse.json({ error: "Informe o objeto ou produto antes da análise inteligente." }, { status: 400 });
    }

    const system = `Você é o Agente Inteligente de Precificação do LEX, especialista em pesquisa de preços para contratações públicas brasileiras.

Sua missão vem ANTES do cálculo: entender semanticamente o produto/serviço, identificar o que realmente define comparabilidade, criar possibilidades úteis de busca e avaliar se as referências encontradas podem representar o mesmo objeto.

REGRAS CRÍTICAS:
1. NÃO invente especificações técnicas, marcas, modelos, quantidades, unidades, desempenho ou requisitos que o usuário não informou.
2. Diferencie claramente: características informadas, características que precisam ser confirmadas e possibilidades de busca.
3. Possibilidades de busca podem conter sinônimos, nomenclaturas de mercado, formas usadas em compras públicas e descrições equivalentes, mas não podem transformar o objeto em outro produto.
4. Ao avaliar referências, use somente descrição, quantidade, unidade, órgão, localização, data e similaridade fornecidos.
5. Classifique cada referência como: compativel, revisar ou incompativel.
6. Use compativel apenas quando houver base suficiente para considerar o resultado comparável. Use revisar quando faltar informação relevante.
7. Nunca gere ou estime preço. O cálculo será feito pelo sistema, fora da IA.
8. Se o objeto estiver genérico demais, deixe isso explícito em alertas e perguntasFaltantes.
9. Responda somente JSON válido.

Formato:
{
  "entendimento": "resumo simples do que o objeto é",
  "caracteristicasInformadas": ["..."],
  "pontosQueDefinemComparabilidade": ["..."],
  "possibilidadesBusca": [{"termo":"...","tipo":"sinonimo|mercado|compras_publicas|equivalente","justificativa":"..."}],
  "perguntasFaltantes": ["..."],
  "alertas": ["..."],
  "referencias": [{"id":"...","classificacao":"compativel|revisar|incompativel","confianca":0,"motivo":"..."}],
  "recomendacao": "próxima ação curta"
}`;

    const user = `OBJETO INFORMADO:
${objeto}

CONTEXTO:
Quantidade: ${body?.quantidade ?? "—"}
Unidade: ${clean(body?.unidadeMedida, 120) || "—"}
Local de entrega: ${clean(body?.localEntrega, 300) || "—"}

REFERÊNCIAS ENCONTRADAS:
${JSON.stringify(referencias).slice(0, 14000)}`;

    const out = await chat([
      { role: "system", content: system },
      { role: "user", content: user },
    ], 0.1);

    const ini = out.indexOf("{");
    const fim = out.lastIndexOf("}");
    if (ini < 0 || fim < ini) throw new Error("Resposta da IA sem JSON válido");
    const raw = JSON.parse(out.slice(ini, fim + 1));

    const idsValidos = new Set(referencias.map((r: any) => String(r?.id || "")).filter(Boolean));
    const classes = new Set(["compativel", "revisar", "incompativel"]);

    return NextResponse.json({
      entendimento: clean(raw?.entendimento, 1800) || "Objeto interpretado com base na descrição informada.",
      caracteristicasInformadas: Array.isArray(raw?.caracteristicasInformadas) ? raw.caracteristicasInformadas.map((x: any) => clean(x, 500)).filter(Boolean).slice(0, 12) : [],
      pontosQueDefinemComparabilidade: Array.isArray(raw?.pontosQueDefinemComparabilidade) ? raw.pontosQueDefinemComparabilidade.map((x: any) => clean(x, 500)).filter(Boolean).slice(0, 12) : [],
      possibilidadesBusca: Array.isArray(raw?.possibilidadesBusca) ? raw.possibilidadesBusca.map((x: any) => ({
        termo: clean(x?.termo, 500) || "",
        tipo: ["sinonimo", "mercado", "compras_publicas", "equivalente"].includes(x?.tipo) ? x.tipo : "equivalente",
        justificativa: clean(x?.justificativa, 800) || "Possibilidade de busca relacionada ao objeto.",
      })).filter((x: any) => x.termo).slice(0, 10) : [],
      perguntasFaltantes: Array.isArray(raw?.perguntasFaltantes) ? raw.perguntasFaltantes.map((x: any) => clean(x, 500)).filter(Boolean).slice(0, 8) : [],
      alertas: Array.isArray(raw?.alertas) ? raw.alertas.map((x: any) => clean(x, 600)).filter(Boolean).slice(0, 8) : [],
      referencias: Array.isArray(raw?.referencias) ? raw.referencias.map((x: any) => ({
        id: String(x?.id || ""),
        classificacao: classes.has(x?.classificacao) ? x.classificacao : "revisar",
        confianca: Math.max(0, Math.min(100, Number(x?.confianca) || 0)),
        motivo: clean(x?.motivo, 900) || "Revisão recomendada.",
      })).filter((x: any) => idsValidos.has(x.id)).slice(0, 20) : [],
      recomendacao: clean(raw?.recomendacao, 1200) || "Revise as equivalências antes de calcular o preço estimado.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Não consegui interpretar o objeto para a precificação agora.", detalhe: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
