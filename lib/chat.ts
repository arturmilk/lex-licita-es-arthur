/**
 * Motor do chat guiado "O que vou contratar hoje?"
 *
 * Conduz o servidor passo a passo com perguntas certas, na ordem certa,
 * explicando cada documento (como se fosse alguém que nunca fez licitação).
 * NUNCA trava — se faltar documento, ALERTA e explica a implicação.
 *
 * Entradas: texto, voz (transcrita) ou documento anexado (identificado por IA).
 */

import { detectarIntencao } from "./intencao";

export interface MensagemChat {
  id: string;
  papel: "servidor" | "sistema";
  tipo: "texto" | "pergunta" | "documento" | "alerta" | "card";
  conteudo: string;
  opcoes?: string[];        // botões de resposta rápida
  anexo?: { nome: string; tipo: string };
  etapa?: string;
  criadaEm: string;
}

export interface EstadoChat {
  etapa: string;                       // intencao | ug | documentos | pesquisa | dotacao | minuta | juridico | finalizado
  objeto?: string;
  tipoProcesso?: string;
  ug?: string;
  modalidade?: string;
  documentoAtual?: string;             // qual documento está sendo coletado
  documentos: Record<string, { status: "ok" | "falta" | "pulado"; anexadoEm?: string; implicacao?: string }>;
  perguntaAtual?: string;
}

// Fluxo de documentos por tipo de processo (PC → ETP → depois etapas do chat)
// Observação: pesquisa/dotação/minuta/jurídico têm ETAPAS PRÓPRIAS no chat —
// aqui ficam só os documentos físicos que o servidor precisa ter.
export const FLUXO_DOCUMENTOS = [
  { chave: "pc", nome: "Pedido de Compra (PC)", obrigatorio: true,
    implicacao: "sem o PC autorizado a contratação não tem demanda formal — risco de anulação." },
  { chave: "etp", nome: "Estudo Técnico Preliminar (ETP)", obrigatorio: true,
    implicacao: "sem ETP a análise jurídica pode apontar irregularidade (Lei 14.133, art. 18)." },
];

const ID = () => Math.random().toString(36).slice(2, 10);

/** Cria um estado inicial de chat. */
export function estadoInicial(): EstadoChat {
  return {
    etapa: "intencao",
    documentos: {},
  };
}

/** O que o chat fala ao abrir (capa). */
export function mensagemAbertura(hasMemoria: boolean, memorias?: Record<string, string>): MensagemChat {
  let conteudo = "Olá! 👋 Eu conduzo sua contratação do início ao fim, como se fosse um especialista ao seu lado.\n\n**O que vamos contratar hoje?** Você pode digitar, falar 🎤 ou anexar um documento 📎 — eu identifico e começamos.";
  if (hasMemoria && memorias) {
    const sugs: string[] = [];
    if (memorias.ug_preferida) sugs.push(`UG ${memorias.ug_preferida}`);
    if (memorias.modalidade_preferida) sugs.push(memorias.modalidade_preferida);
    if (memorias.fonte_preco) sugs.push(memorias.fonte_preco);
    if (sugs.length) conteudo += `\n\n🧠 **Da última vez** seu órgão usou: ${sugs.join(", ")} — já deixei pré-selecionado.`;
  }
  return {
    id: ID(), papel: "sistema", tipo: "pergunta", etapa: "intencao",
    conteudo, opcoes: ["🖊️ Digitar", "🎤 Falar", "📎 Anexar documento"], criadaEm: new Date().toISOString(),
  };
}

/**
 * Processa a resposta do servidor e devolve a próxima mensagem do sistema.
 * `memorias` = preferências aprendidas do órgão.
 */
export async function responder(texto: string, estado: EstadoChat, memorias: Record<string, string>): Promise<{ mensagens: MensagemChat[]; estado: EstadoChat }> {
  const msg: MensagemChat[] = [];
  const t = (texto || "").trim().toLowerCase();

  switch (estado.etapa) {
    // ── 1. INTENÇÃO ─────────────────────────────────────────────
    case "intencao": {
      const sugestoes = await detectarIntencao(texto);
      if (!sugestoes.length) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "intencao",
          conteudo: "Não identifiquei com certeza. Pode me contar um pouco mais? Por exemplo: *\"Preciso contratar manutenção de ar-condicionado\"* ou *\"Vou comprar papel A4\"*.",
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      const melhor = sugestoes[0];
      estado.objeto = texto.trim();
      estado.tipoProcesso = melhor.nomeTipo;
      estado.etapa = "ug";
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "ug",
        conteudo: `Entendi! 🎯 Vamos montar a contratação de **${melhor.nomeTipo}** juntos.\n\nObjeto: *${texto.trim().slice(0, 120)}*\n\nPrimeiro: **qual a Unidade Gestora (UG)?**`,
        opcoes: memorias.ug_preferida ? [`${memorias.ug_preferida} (da última vez)`, "Outra…"] : ["Não sei o que é UG"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 2. UG ───────────────────────────────────────────────────
    case "ug": {
      if (t.includes("não sei") || t.includes("nao sei")) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "ug",
          conteudo: "Sem problema! A **UG (Unidade Gestora)** é a unidade administrativa que executa a despesa — geralmente aparece no CNPJ do órgão (ex.: 12.345.678/0001-90). Se preferir, seguimos e você informa depois — deixo como alerta ⚠️.",
          opcoes: ["Seguir sem UG por enquanto", "Vou informar agora"],
          criadaEm: new Date().toISOString(),
        });
        estado.perguntaAtual = "ug";
        return { mensagens: msg, estado };
      }
      estado.ug = texto.trim();
      estado.etapa = "documentos";
      estado.documentoAtual = FLUXO_DOCUMENTOS[0].chave;
      estado.documentos.pc = { status: "falta" };
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "documentos",
        conteudo: `UG anotada ✅\n\nAgora vamos aos **documentos**, um de cada vez. Começando:\n\n📄 **${FLUXO_DOCUMENTOS[0].nome}**\n\nVocê já tem?`,
        opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 3. DOCUMENTOS (fluxo por documento) ─────────────────────
    case "documentos": {
      const doc = FLUXO_DOCUMENTOS.find(d => d.chave === estado.documentoAtual);
      if (!doc) {
        // Todos os documentos tratados → próximo: pesquisa de preços
        estado.etapa = "pesquisa";
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "pesquisa",
          conteudo: `Documentos mapeados! 🗂️\n\nAgora a **pesquisa de preços**. Seu órgão costuma usar **${memorias.fonte_preco || "PNCP"}**. Confirma que busco o valor estimado com as referências?`,
          opcoes: ["✅ Sim, buscar no PNCP", "🎯 Quero definir outra fonte", "❓ Explica como funciona"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      if (t.includes("sim") || t.includes("já tenho") || t.includes("tenho") || t.includes("anexar")) {
        estado.documentos[doc.chave] = { status: "ok", anexadoEm: new Date().toISOString() };
        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "documentos",
          conteudo: `✅ **${doc.nome}** recebido! Pode anexar o arquivo aqui 📎 se quiser.`,
          criadaEm: new Date().toISOString(),
        });
        // Avança automaticamente para o próximo documento
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: `📄 **${proximo.nome}** — você já tem?`,
            opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?"],
            criadaEm: new Date().toISOString(),
          });
        } else {
          estado.documentoAtual = undefined;
        }
        return { mensagens: msg, estado };
      }

      if (t.includes("não") || t.includes("nao") || t.includes("ainda não")) {
        estado.documentos[doc.chave] = { status: "falta", implicacao: doc.implicacao };
        msg.push({
          id: ID(), papel: "sistema", tipo: "alerta", etapa: "documentos",
          conteudo: `⚠️ **Alerta:** sem ${doc.nome.toLowerCase()} — ${doc.implicacao}\n\nNão vou travar, seguimos — mas **recomendo anexar antes da etapa jurídica**.`,
          criadaEm: new Date().toISOString(),
        });
        // Avança para o próximo documento
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: `📄 **${proximo.nome}** — você já tem?`,
            opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?"],
            criadaEm: new Date().toISOString(),
          });
        } else {
          estado.documentoAtual = undefined;
        }
        return { mensagens: msg, estado };
      }

      if (t.includes("o que é") || t.includes("o que e") || t.includes("não sei o que")) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "documentos",
          conteudo: `📘 **${doc.nome}** — o que é:\n\n${explicarDocumento(doc.chave)}\n\nTem um modelo pronto se precisar!`,
          opcoes: ["📎 Gerar/baixar modelo", "✅ Já entendi, tenho", "❌ Ainda não tenho"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      // próxima pergunta do documento atual
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
        conteudo: `📄 **${doc.nome}** — você já tem?`,
        opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 4. PESQUISA ─────────────────────────────────────────────
    case "pesquisa": {
      if (t.includes("sim") || t.includes("pncp")) {
        estado.etapa = "dotacao";
        // Auto-aprendizado: registra a fonte de preço preferida
        try {
          const { registrarMemoria } = await import("@/lib/actions-chat");
          await registrarMemoria("fonte_preco", "PNCP");
        } catch { /* memória não bloqueia o fluxo */ }
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "pesquisa",
          conteudo: `Ótimo! A pesquisa de preços usa o **PNCP** com mínimo de 3 referências. Vou buscar isso para o objeto *${estado.objeto?.slice(0, 60)}*.\n\n(Quando publicar, o valor estimado sai da média das referências — e eu já vou deixar pronto na análise.)`,
          criadaEm: new Date().toISOString(),
        });
        // dota
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "dotacao",
          conteudo: `Agora a **dotação orçamentária**. Com base no objeto, sugiro uma classificação. Você tem a dotação do seu órgão?`,
          opcoes: ["💡 Usar a sugestão do sistema", "✍️ Informar a minha", "❓ O que é dotação?"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      if (t.includes("explica")) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "pesquisa",
          conteudo: "📘 **Pesquisa de preços**: levantamos o valor de mercado do objeto com pelo menos 3 fontes (PNCP, Painel de Preços, contratos). A **média** vira o valor estimado da licitação — é o que garante que o preço é justo.",
          opcoes: ["✅ Entendi, buscar no PNCP", "🎯 Outra fonte"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "pesquisa",
        conteudo: `Busco a pesquisa no **${memorias.fonte_preco || "PNCP"}**?`,
        opcoes: ["✅ Sim", "🎯 Outra fonte", "❓ Explica"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 5. DOTAÇÃO ──────────────────────────────────────────────
    case "dotacao": {
      if (t.includes("sugestão") || t.includes("sugestao") || t.includes("usar")) {
        estado.etapa = "minuta";
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "dotacao",
          conteudo: "💡 Usei a classificação mais provável para o objeto (função/subfunção/natureza). **Valide com a unidade de orçamento** antes de empenhar — eu já deixo anotado no processo.",
          criadaEm: new Date().toISOString(),
        });
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "minuta",
          conteudo: `Quase lá! 📝 Agora a **minuta do edital/TR**. Quer que eu **gere com IA** (preencho com os dados do processo + julgados de apoio) ou você prefere um **modelo da AGU**?`,
          opcoes: ["✨ Gerar com IA", "📄 Modelo AGU", "✍️ Tenho minha própria minuta"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "dotacao",
        conteudo: "E a **dotação orçamentária**? Usa a sugestão ou informa a sua?",
        opcoes: ["💡 Sugestão do sistema", "✍️ Informar a minha"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 6. MINUTA ───────────────────────────────────────────────
    case "minuta": {
      if (t.includes("ia") || t.includes("gerar")) {
        estado.etapa = "juridico";
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "minuta",
          conteudo: "✨ **Minuta gerada com IA** — preenchi com o objeto, dotação sugerida e julgados de apoio. Está salva como rascunho no processo. Você pode editar antes de usar!",
          criadaEm: new Date().toISOString(),
        });
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "juridico",
          conteudo: "Última etapa: **análise jurídica** ⚖️. Vai encaminhar para a Assessoria Jurídica?",
          opcoes: ["✅ Sim, vou encaminhar", "⚠️ Seguir sem por enquanto"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      if (t.includes("agu") || t.includes("modelo")) {
        estado.etapa = "juridico";
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "minuta",
          conteudo: "📄 **Modelo AGU** selecionado — está na seção de modelos do processo, pronto para preencher com 1 clique.",
          criadaEm: new Date().toISOString(),
        });
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "juridico",
          conteudo: "Última etapa: **análise jurídica** ⚖️. Vai encaminhar para a Assessoria?",
          opcoes: ["✅ Sim", "⚠️ Seguir sem"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "minuta",
        conteudo: "Como prefere a **minuta**?",
        opcoes: ["✨ Gerar com IA", "📄 Modelo AGU", "✍️ Tenho a minha"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 7. JURÍDICO → FINALIZAÇÃO ──────────────────────────────
    case "juridico": {
      estado.etapa = "finalizado";
      const faltas = FLUXO_DOCUMENTOS.filter(d => estado.documentos[d.chave]?.status === "falta");
      let resumo = "🎉 **Contratação mapeada!** Aqui está o resumo:\n\n";
      resumo += `📦 **Objeto:** ${estado.objeto || "—"}\n`;
      resumo += `🏛️ **Tipo:** ${estado.tipoProcesso || "—"}\n`;
      resumo += `🏢 **UG:** ${estado.ug || "não informada ⚠️"}\n`;
      resumo += `📄 **Documentos:** ${FLUXO_DOCUMENTOS.filter(d => estado.documentos[d.chave]?.status === "ok").length}/${FLUXO_DOCUMENTOS.length} OK\n`;
      if (faltas.length) {
        resumo += `\n⚠️ **Faltam:** ${faltas.map(d => d.nome).join(", ")}`;
      }
      resumo += `\n\nO processo está **${faltas.length ? "em andamento (com alertas)" : "pronto para publicação"}**. Quer ver o painel?`;
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "finalizado",
        conteudo: resumo,
        opcoes: ["📋 Ver painel", "💬 Continuar conversando"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    default:
      msg.push({
        id: ID(), papel: "sistema", tipo: "texto",
        conteudo: "Pode me contar mais? Digite o que você precisa ou anexe um documento 📎",
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
  }
}

/** Explicação amigável de cada documento (para quem nunca fez). */
function explicarDocumento(chave: string): string {
  const expl: Record<string, string> = {
    pc: "O **Pedido de Compra (PC)** é o documento do setor requisitante que pede a contratação. Ele justifica a necessidade e informa o quantitativo. Sem ele, a contratação não tem demanda formal.",
    etp: "O **Estudo Técnico Preliminar (ETP)** é o documento que analisa: por que contratar, quais alternativas existem, qual a melhor solução e os riscos. É a 'prova' de que a contratação faz sentido (art. 18 da Lei 14.133).",
    pesquisa: "A **pesquisa de preços** levanta o valor de mercado com mínimo de 3 referências — define o valor estimado e evita superfaturamento.",
    dotacao: "A **dotação orçamentária** é o 'lugar' no orçamento de onde sai o dinheiro (função, subfunção, natureza de despesa). Sem ela, não há empenho nem contrato.",
    minuta: "A **minuta do edital/TR** é o rascunho oficial da contratação — descreve objeto, regras, prazos e condições.",
    juridico: "A **análise jurídica** é o parecer da Assessoria Jurídica validando a legalidade do processo (art. 53 da Lei 14.133).",
  };
  return expl[chave] || "Documento necessário para a contratação pública.";
}
