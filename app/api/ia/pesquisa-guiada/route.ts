import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/ia";

type Forma = "item" | "lote" | "global" | null;
type Periodo = "90_dias" | "6_meses" | "12_meses" | "24_meses" | null;
type Regiao = "brasil" | "centro_oeste" | "sudeste" | "sul" | "nordeste" | "norte" | null;
type Metodo = "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco" | null;

function cleanString(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, 2000) : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const pedido = cleanString(body?.pedido);
    if (!pedido || pedido.length < 8) {
      return NextResponse.json({ error: "Descreva a necessidade com um pouco mais de detalhe." }, { status: 400 });
    }

    const contexto = body?.contexto && typeof body.contexto === "object" ? body.contexto : {};
    const system = `Você é o LEX Pesquisa de Preços, um agente especialista em pesquisa de preços para contratações públicas brasileiras.

Sua tarefa é interpretar uma solicitação escrita em linguagem natural e transformar SOMENTE os dados realmente informados ou inequivocamente dedutíveis em dados estruturados para o formulário de pesquisa de preços.

REGRAS CRÍTICAS:
- Não invente quantidade, unidade, local, número do processo, CNPJ, fornecedor, preço, prazo, método estatístico ou especificação técnica.
- Quando um dado não estiver claro, use null e faça uma pergunta em perguntasFaltantes.
- Você pode normalizar unidades (ex.: unidades -> unidade, meses -> mês) e inferir região geográfica brasileira apenas quando uma UF/cidade inequívoca estiver informada.
- Se houver vários itens, separe-os. Se o usuário descrever lotes explicitamente, use formaParcelamento=lote. Se disser preço global/empreitada global, use global. Caso contrário, deixe null quando não houver base.
- Especificações devem conter somente características mencionadas pelo usuário; não crie marcas/modelos/requisitos.
- Cotações só entram quando houver fornecedor/fonte/valor explicitamente informados.
- Parâmetros de pesquisa só entram quando o usuário os indicar. Não substitua os padrões do sistema por preferência inventada.
- perguntasFaltantes deve priorizar o que muda comparabilidade e preço: objeto, especificação, quantidade, unidade, local/abrangência, parcelamento e contexto relevante.
- proximaAcao deve ser curta e prática.

Responda APENAS JSON válido:
{
  "objeto": "string|null",
  "formaParcelamento": "item|lote|global|null",
  "localEntrega": "string|null",
  "itens": [{"descricao":"string","especificacao":"string","quantidade":number|null,"unidadeMedida":"string|null","itemEdital":"string|null","obrigatorio":true}],
  "processo": {"numero":"string|null","unidade":"string|null"},
  "parametros": {"periodo":"90_dias|6_meses|12_meses|24_meses|null","regiao":"brasil|centro_oeste|sudeste|sul|nordeste|norte|null","qtdMin":number|null,"metodo":"media_aritmetica|mediana|media_ponderada|menor_preco|null","cvLimite":number|null},
  "cotacoes": [{"fornecedor":"string","cnpj":"string","fonte":"string","valor":number|null,"data":"YYYY-MM-DD|null","observacao":"string|null"}],
  "resumo":"string",
  "perguntasFaltantes":["string"],
  "alertas":["string"],
  "proximaAcao":"string"
}`;

    const user = `SOLICITAÇÃO DO SERVIDOR:\n${pedido}\n\nDADOS JÁ PREENCHIDOS (não sobrescreva com chute):\n${JSON.stringify(contexto).slice(0, 8000)}`;
    const out = await chat([{ role: "system", content: system }, { role: "user", content: user }], 0.1);
    const inicio = out.indexOf("{");
    const fim = out.lastIndexOf("}");
    if (inicio < 0 || fim < inicio) throw new Error("Resposta da IA sem JSON");
    const raw = JSON.parse(out.slice(inicio, fim + 1));

    const formas: Forma[] = ["item", "lote", "global", null];
    const periodos: Periodo[] = ["90_dias", "6_meses", "12_meses", "24_meses", null];
    const regioes: Regiao[] = ["brasil", "centro_oeste", "sudeste", "sul", "nordeste", "norte", null];
    const metodos: Metodo[] = ["media_aritmetica", "mediana", "media_ponderada", "menor_preco", null];

    const forma = formas.includes(raw.formaParcelamento) ? raw.formaParcelamento : null;
    const periodo = periodos.includes(raw?.parametros?.periodo) ? raw.parametros.periodo : null;
    const regiao = regioes.includes(raw?.parametros?.regiao) ? raw.parametros.regiao : null;
    const metodo = metodos.includes(raw?.parametros?.metodo) ? raw.parametros.metodo : null;

    const itens = Array.isArray(raw.itens) ? raw.itens.slice(0, 50).map((i: any) => ({
      descricao: cleanString(i?.descricao) || "",
      especificacao: cleanString(i?.especificacao) || "",
      quantidade: Number.isFinite(Number(i?.quantidade)) && Number(i.quantidade) > 0 ? Number(i.quantidade) : null,
      unidadeMedida: cleanString(i?.unidadeMedida),
      itemEdital: cleanString(i?.itemEdital),
      obrigatorio: i?.obrigatorio !== false,
    })).filter((i: any) => i.descricao || i.especificacao) : [];

    const cotacoes = Array.isArray(raw.cotacoes) ? raw.cotacoes.slice(0, 30).map((c: any) => ({
      fornecedor: cleanString(c?.fornecedor) || "",
      cnpj: cleanString(c?.cnpj) || "",
      fonte: cleanString(c?.fonte) || "",
      valor: Number.isFinite(Number(c?.valor)) && Number(c.valor) > 0 ? Number(c.valor) : null,
      data: /^\d{4}-\d{2}-\d{2}$/.test(String(c?.data || "")) ? String(c.data) : null,
      observacao: cleanString(c?.observacao),
    })).filter((c: any) => c.fornecedor || c.fonte || c.valor) : [];

    return NextResponse.json({
      objeto: cleanString(raw.objeto),
      formaParcelamento: forma,
      localEntrega: cleanString(raw.localEntrega),
      itens,
      processo: { numero: cleanString(raw?.processo?.numero), unidade: cleanString(raw?.processo?.unidade) },
      parametros: {
        periodo, regiao,
        qtdMin: Number.isInteger(Number(raw?.parametros?.qtdMin)) && Number(raw.parametros.qtdMin) > 0 ? Math.min(50, Number(raw.parametros.qtdMin)) : null,
        metodo,
        cvLimite: Number.isFinite(Number(raw?.parametros?.cvLimite)) && Number(raw.parametros.cvLimite) > 0 ? Math.min(100, Number(raw.parametros.cvLimite)) : null,
      },
      cotacoes,
      resumo: cleanString(raw.resumo) || "Entendi a solicitação e organizei os dados que estavam claros.",
      perguntasFaltantes: Array.isArray(raw.perguntasFaltantes) ? raw.perguntasFaltantes.map(cleanString).filter(Boolean).slice(0, 8) : [],
      alertas: Array.isArray(raw.alertas) ? raw.alertas.map(cleanString).filter(Boolean).slice(0, 8) : [],
      proximaAcao: cleanString(raw.proximaAcao) || "Confira os dados identificados e complete o que estiver faltando.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Não consegui interpretar a solicitação agora.", detalhe: String(err?.message || err).slice(0, 300) }, { status: 500 });
  }
}
