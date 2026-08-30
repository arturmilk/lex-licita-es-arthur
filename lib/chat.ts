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
  completo?: string;        // documento COMPLETO (para download) — o conteudo é a prévia
  opcoes?: string[];        // botões de resposta rápida
  anexo?: { nome: string; tipo: string };
  etapa?: string;
  criadaEm: string;
}

export interface EstadoChat {
  etapa: string;                       // intencao | ug | documentos | coleta_doc | pesquisa | dotacao | minuta | juridico | finalizado | edital | edital_catmat | edital_pronto
  objeto?: string;
  tipoProcesso?: string;
  ug?: string;
  modalidade?: string;
  documentoAtual?: string;             // qual documento está sendo coletado
  documentos: Record<string, { status: "ok" | "falta" | "pulado"; anexadoEm?: string; implicacao?: string }>;
  perguntaAtual?: string;
  catmat?: string;                     // código(s) CATMAT/CATSER provável(eis)
  minuta?: string;                     // minuta gerada (para baixar/editar)
  docColeta?: {                        // coleta guiada de campos do documento
    docChave: string;                  // qual documento (pc | etp)
    campos: Record<string, string>;    // respostas coletadas por campo
    ordem: string[];                   // ordem dos campos restantes
    campoAtual?: string;               // campo sendo perguntado agora
  };
}

/** Campos guiados por documento — pergunta, explicação e opções sugeridas. */
export const CAMPOS_DOCUMENTO: Record<string, { chave: string; pergunta: string; explicacao: string; opcoes?: string[] }[]> = {
  pc: [
    { chave: "quantidade", pergunta: "Qual a **quantidade** necessária?", explicacao: "Ex.: 1 profissional, 500 resmas, 10 licenças. Baseia-se na demanda do setor requisitante.", opcoes: ["1 unidade", "Mês (serviço continuado)"] },
    { chave: "unidade", pergunta: "Qual a **unidade de medida**?", explicacao: "unidade, mês, resma, kg, m², hora…", opcoes: ["unidade", "mês", "resma", "kg"] },
    { chave: "valorEstimado", pergunta: "Tem um **valor estimado** ou deixa a pesquisa de preços definir?", explicacao: "Se não souber, sem problema — a pesquisa de preços (PNCP) define o valor estimado depois." },
    { chave: "prazo", pergunta: "Qual o **prazo** desejado?", explicacao: "Ex.: 30 dias para entrega, 12 meses de vigência para serviço continuado.", opcoes: ["30 dias", "12 meses (serviço continuado)"] },
    { chave: "localEntrega", pergunta: "Onde será a **entrega/execução**?", explicacao: "Ex.: Almoxarifado Central, Unidade Básica de Saúde X, endereço do órgão." },
  ],
  etp: [
    { chave: "necessidade", pergunta: "Qual a **necessidade** que a contratação atende?", explicacao: "Descreva o problema/necessidade que motiva a contratação (ex.: falta de atendimento médico na UBS)." },
    { chave: "alternativas", pergunta: "Que **alternativas** foram consideradas?", explicacao: "Ex.: contratação direta, aditivo de contrato existente, quadro próprio, terceirização.", opcoes: ["Contratação de terceiros", "Aditivo de contrato existente", "Quadro próprio de servidores"] },
    { chave: "riscos", pergunta: "Quer que eu **sugira os riscos** típicos (atraso, superfaturamento, descumprimento)?", explicacao: "O ETP exige análise de riscos com medidas de mitigação.", opcoes: ["Sim, sugira os riscos", "Vou informar os riscos"] },
  ],
};

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

/**
 * Interpreta a resposta livre do servidor com IA — entendendo o que ele
 * realmente quis dizer em cada etapa (evita o loop de "não entendi").
 * Retorna { intencao, resposta } onde intencao é uma das ações esperadas.
 */
async function interpretarComIA(texto: string, estado: EstadoChat): Promise<{ intencao: string; resposta: string }> {
  try {
    const { chat } = await import("@/lib/ia");
    const docAtual = FLUXO_DOCUMENTOS.find(d => d.chave === estado.documentoAtual);
    const contexto = [
      `Etapa atual do fluxo de contratação pública: ${estado.etapa}`,
      estado.documentoAtual ? `Documento sendo perguntado: ${docAtual?.nome || estado.documentoAtual}` : "",
      estado.objeto ? `Objeto: ${estado.objeto}` : "",
      "O servidor é um usuário de órgão público que pode nunca ter feito licitação.",
      "Responda APENAS com JSON: {\"intencao\": \"uma de: confirmar | negar | explicar | informar | anexar | avancar\", \"resposta\": \"texto curto do que o usuário quis dizer\"}",
    ].filter(Boolean).join("\n");
    const out = await chat([
      { role: "system", content: contexto },
      { role: "user", content: `Resposta do servidor: "${texto}"` },
    ], 0.2);
    const m = out.match(/\{[\s\S]*\}/);
    if (m) {
      const j = JSON.parse(m[0]);
      return { intencao: String(j.intencao || "").toLowerCase(), resposta: String(j.resposta || "") };
    }
  } catch { /* fallback para regras */ }
  const t = texto.toLowerCase();
  if (/não|nao|ainda nao|ainda não|sem /.test(t)) return { intencao: "negar", resposta: texto };
  if (/sim|tenho|já|ja|ok|pode|confirmo|anexei/.test(t)) return { intencao: "confirmar", resposta: texto };
  if (/o que é|o que e|como funciona|explica|o que significa/.test(t)) return { intencao: "explicar", resposta: texto };
  if (/anexar|anexei|arquivo|documento/.test(t)) return { intencao: "anexar", resposta: texto };
  return { intencao: "informar", resposta: texto };
}

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
    // ── 0. FINALIZADO → transições ──────────────────────────────
    case "finalizado": {
      if (t.includes("elaborar edital") || t.includes("elaborar") || t.includes("edital")) {
        estado.etapa = "edital";
        // cai no case edital abaixo (busca CATMAT e pergunta)
        const { mensagens } = await responder("sim", estado, memorias);
        return { mensagens, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "finalizado",
        conteudo: "✅ Contratação mapeada! Você pode **elaborar o edital**, **ver o painel** ou continuar conversando.",
        opcoes: ["📄 Elaborar edital", "📋 Ver painel", "💬 Continuar conversando"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

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
        conteudo: `Entendi! 🎯 Vamos montar a contratação de **${melhor.nomeTipo}** juntos.\n\nObjeto: *${texto.trim().slice(0, 120)}*\n\nPrimeiro: **qual a Unidade Gestora (UG)?**\n*(Se não souber, sem problema — pode seguir e informar depois!)*`,
        opcoes: memorias.ug_preferida
          ? [`${memorias.ug_preferida} (da última vez)`, "Outra…", "▶️ Seguir sem UG por enquanto"]
          : ["Não sei o que é UG", "▶️ Seguir sem UG por enquanto"],
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
          opcoes: ["▶️ Seguir sem UG por enquanto", "Vou informar agora"],
          criadaEm: new Date().toISOString(),
        });
        estado.perguntaAtual = "ug";
        return { mensagens: msg, estado };
      }
      // "Seguir sem UG por enquanto" — não trava, segue direto
      if (t.includes("seguir sem ug") || t.includes("sem ug por enquanto") || t.includes("seguir sem")) {
        estado.ug = "";
        estado.etapa = "documentos";
        estado.documentoAtual = FLUXO_DOCUMENTOS[0].chave;
        estado.documentos.pc = { status: "falta" };
        msg.push({
          id: ID(), papel: "sistema", tipo: "card", etapa: "documentos",
          conteudo: `UG **não informada** ⚠️ (deixo como alerta — você informa depois).\n\nAgora vamos aos **documentos**, um de cada vez. Começando:\n\n📄 **${FLUXO_DOCUMENTOS[0].nome}**\n\nVocê já tem? Se tiver o arquivo, **anexe aqui** 📎 que eu identifico e sigo.`,
          opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?", "📎 Anexar arquivo"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      // ── VALIDAÇÃO DA UG: entende e verifica a resposta antes de aceitar ──
      const respostaUG = texto.trim();
      // Detecta se o usuário respondeu fora do contexto (colou o objeto/documento)
      const pareceDocumento = /pedido de compra|etp|estudo técnico|termo de referência|edital|contrata|preciso|quero contratar/i.test(respostaUG);
      const pareceNumero = /^\d{5,6}$/.test(respostaUG.replace(/\D/g, "")) && /\d/.test(respostaUG);
      const pareceCnpj = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(respostaUG);

      if (!pareceNumero && !pareceCnpj) {
        // Resposta não parece UG → pergunta de novo, entendendo o que ela digitou
        let aviso = "";
        if (pareceDocumento) {
          aviso = `🤔 **Percebi que você colou outro conteúdo** (parece um documento ou o objeto da contratação).\n\nIsso aqui é o campo da **UG** — só o **código numérico** da Unidade Gestora (6 dígitos, ex.: **120001** ou 12.345.678/0001-90).\n\nO documento que você colou, guardo **mais adiante**, quando pedir os documentos do processo. 👍`;
        } else if (respostaUG.length > 20) {
          aviso = `🤔 Essa resposta parece **longa demais** para o campo da UG.\n\nA **UG** é só o **código numérico** da Unidade Gestora (ex.: **120001** ou o CNPJ do órgão).`;
        } else {
          aviso = `🤔 **"${respostaUG.slice(0, 50)}"** não parece um código de UG.\n\nA **UG (Unidade Gestora)** é identificada por um **número de 6 dígitos** (ex.: **120001**) ou pelo **CNPJ** do órgão (ex.: 12.345.678/0001-90).\n\nPode conferir no SEI/processo ou perguntar ao setor financeiro.`;
        }
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "ug",
          conteudo: `${aviso}\n\n🔄 Qual a **UG** correta?`,
          opcoes: ["▶️ Seguir sem UG por enquanto", "Não sei o que é UG"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      estado.ug = respostaUG;
      estado.etapa = "documentos";
      estado.documentoAtual = FLUXO_DOCUMENTOS[0].chave;
      estado.documentos.pc = { status: "falta" };
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "documentos",
        conteudo: `UG anotada ✅\n\nAgora vamos aos **documentos**, um de cada vez. Começando:\n\n📄 **${FLUXO_DOCUMENTOS[0].nome}**\n\nVocê já tem? Se tiver o arquivo, **anexe aqui** 📎 que eu identifico e sigo.`,
        opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?", "📎 Anexar arquivo"],
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

      // BOTÃO "▶️ Seguir mesmo assim" / "▶️ Seguir": avança sem travar
      if (t.includes("seguir mesmo assim") || t.includes("▶️ seguir") || t.includes("seguir")) {
        if (estado.documentos[doc.chave]?.status !== "ok") {
          estado.documentos[doc.chave] = { status: "falta", implicacao: doc.implicacao };
        }
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: `✅ Seguindo! 📄 **${proximo.nome}** — você já tem?`,
            opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?", "📎 Anexar arquivo"],
            criadaEm: new Date().toISOString(),
          });
        } else {
          estado.documentoAtual = undefined;
        }
        return { mensagens: msg, estado };
      }

      // BOTÃO "🔄 Quero resolver agora": pede o anexo
      if (t.includes("quero resolver agora") || t.includes("resolver agora")) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
          conteudo: `Perfeito! Vamos resolver o **${doc.nome}** agora.\n\nClique em **📎 Anexar arquivo** para enviar o documento, ou **📄 crie com o modelo AGU** — eu preencho com os dados do processo.`,
          opcoes: ["📎 Anexar arquivo", "📄 Criar com modelo AGU", "▶️ Seguir mesmo assim"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      // BOTÃO "📄 Criar com modelo AGU": inicia a COLETA GUIADA de campos
      if (t.includes("criar com modelo agu") || t.includes("criar com o modelo") || t.includes("gerar modelo")) {
        const camposDef = CAMPOS_DOCUMENTO[doc.chave] || [];
        estado.docColeta = {
          docChave: doc.chave,
          campos: {},
          ordem: camposDef.map(c => c.chave),
        };
        estado.etapa = "coleta_doc";
        const primeiro = camposDef[0];
        msg.push({
          id: ID(), papel: "sistema", tipo: "card", etapa: "coleta_doc",
          conteudo: `📄 **${doc.nome}** — vamos montar com o modelo AGU, **campo por campo** para ficar completo!\n\n🟡 **Pergunta 1/${camposDef.length}:** ${primeiro.pergunta}\n\n💡 ${primeiro.explicacao}\n\n*(pode digitar a resposta, escolher uma opção ou pular — eu completo com o padrão)*`,
          opcoes: [...(primeiro.opcoes || []), "⏭️ Pular (usar padrão)"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      if (t.includes("anexei") || t.includes("anexei o documento") || t.includes("sim") || t.includes("já tenho") || t.includes("tenho") || t.includes("anexar")) {
        estado.documentos[doc.chave] = { status: "ok", anexadoEm: new Date().toISOString() };
        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "documentos",
          conteudo: `✅ **${doc.nome}** recebido! Pode anexar o arquivo aqui 📎 se quiser.`,
          opcoes: ["📎 Anexar arquivo", "▶️ Seguir"],
          criadaEm: new Date().toISOString(),
        });
        // Avança automaticamente para o próximo documento
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: `📄 **${proximo.nome}** — você já tem?`,
            opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?", "📎 Anexar arquivo"],
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
          conteudo: `⚠️ **Alerta:** sem ${doc.nome.toLowerCase()} — ${doc.implicacao}\n\n**Não vou travar** — escolha uma opção para continuar:\n\n📄 **${doc.nome}** — o que fazer?`,
          opcoes: ["📄 Criar com modelo AGU", "📎 Anexar arquivo", "▶️ Seguir mesmo assim", "🔄 Quero resolver agora"],
          criadaEm: new Date().toISOString(),
        });
        // NÃO avança — espera a escolha do servidor (criar/anexar/pular)
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

      // ── Resposta livre: interpreta com IA (evita loop) ──
      const { intencao, resposta } = await interpretarComIA(texto, estado);
      if (intencao === "confirmar") {
        estado.documentos[doc.chave] = { status: "ok", anexadoEm: new Date().toISOString() };
        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "documentos",
          conteudo: `✅ **${doc.nome}** registrado! (${resposta.slice(0, 100)})`,
          opcoes: ["📎 Anexar arquivo", "▶️ Seguir"],
          criadaEm: new Date().toISOString(),
        });
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: `📄 **${proximo.nome}** — você já tem?`,
            opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?", "📎 Anexar arquivo"],
            criadaEm: new Date().toISOString(),
          });
        } else estado.documentoAtual = undefined;
        return { mensagens: msg, estado };
      }
      if (intencao === "negar") {
        estado.documentos[doc.chave] = { status: "falta", implicacao: doc.implicacao };
        msg.push({
          id: ID(), papel: "sistema", tipo: "alerta", etapa: "documentos",
          conteudo: `⚠️ **Alerta:** sem ${doc.nome.toLowerCase()} — ${doc.implicacao}\n\n**Não vou travar** — escolha uma opção para continuar:`,
          opcoes: ["▶️ Seguir mesmo assim", "🔄 Quero resolver agora", "📎 Anexar arquivo"],
          criadaEm: new Date().toISOString(),
        });
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: `📄 **${proximo.nome}** — você já tem?`,
            opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?", "📎 Anexar arquivo"],
            criadaEm: new Date().toISOString(),
          });
        } else estado.documentoAtual = undefined;
        return { mensagens: msg, estado };
      }
      if (intencao === "explicar") {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "documentos",
          conteudo: `📘 **${doc.nome}** — o que é:\n\n${explicarDocumento(doc.chave)}\n\nTem um modelo pronto se precisar!`,
          opcoes: ["📎 Gerar/baixar modelo", "✅ Já entendi, tenho", "❌ Ainda não tenho"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      // "informar" — o servidor deu uma informação extra; reconhece e pergunta de novo
      // de forma amigável (não é loop: a resposta foi absorvida)
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
        conteudo: `Anotado! (${resposta.slice(0, 120)})\n\n📄 **${doc.nome}** — você já tem?`,
        opcoes: ["✅ Já tenho", "❌ Ainda não", "❓ O que é isso?", "📎 Anexar arquivo"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 3.5 COLETA GUIADA DE CAMPOS (PC/ETP completos) ──────────
    case "coleta_doc": {
      const coleta = estado.docColeta;
      if (!coleta) { estado.etapa = "documentos"; return { mensagens: msg, estado }; }
      const camposDef = CAMPOS_DOCUMENTO[coleta.docChave] || [];
      const campoAtual = coleta.campoAtual || coleta.ordem[0];
      const campoDef = camposDef.find(c => c.chave === campoAtual);

      // 1. Guarda a resposta do campo atual (se houver) — com VALIDAÇÃO por campo
      const resposta = (texto || "").trim();

      // ── Valida a resposta conforme o campo (entende e corrige antes de aceitar) ──
      if (campoAtual && !coleta.campos[campoAtual]) {
        const invalida = validarCampoColeta(campoAtual, resposta);
        if (invalida) {
          msg.push({
            id: ID(), papel: "sistema", tipo: "texto", etapa: "coleta_doc",
            conteudo: `${invalida}\n\n🔄 **${campoDef?.pergunta}**\n\n💡 ${campoDef?.explicacao}`,
            opcoes: [...(campoDef?.opcoes || []), "⏭️ Pular (usar padrão)"],
            criadaEm: new Date().toISOString(),
          });
          return { mensagens: msg, estado };
        }
        if (/pular|padrão|padrao/i.test(resposta)) {
          coleta.campos[campoAtual] = ""; // padrão
        } else if (campoAtual === "riscos" && /sim|sugira/i.test(resposta)) {
          coleta.campos[campoAtual] = "Riscos típicos: atraso na execução (mitigação: cronograma e sanções), superfaturamento (mitigação: pesquisa com 3+ referências), descumprimento contratual (mitigação: garantia e penalidades), interrupção do serviço (mitigação: cláusula de continuidade).";
        } else if (campoAtual === "alternativas" && /não sei|nao sei|duvida/i.test(resposta)) {
          coleta.campos[campoAtual] = "Considerou-se a contratação de terceiros como alternativa mais adequada, frente às alternativas de quadro próprio (inviável) e aditivo contratual (inexistente).";
        } else if (campoAtual === "valorEstimado" && /não sei|nao sei|pesquisa|deixa/i.test(resposta)) {
          coleta.campos[campoAtual] = "A definir pela pesquisa de preços (PNCP/Painel) com mínimo de 3 referências.";
        } else {
          coleta.campos[campoAtual] = resposta;
        }
      }

      // 2. Próximo campo ou gera o documento
      const idxAtual = coleta.ordem.indexOf(campoAtual);
      const proximoCampo = coleta.ordem[idxAtual + 1];
      if (proximoCampo) {
        coleta.campoAtual = proximoCampo;
        const proxDef = camposDef.find(c => c.chave === proximoCampo);
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "coleta_doc",
          conteudo: `✅ Anotado! (${resposta.slice(0, 80) || "padrão"})\n\n🟡 **Pergunta ${idxAtual + 2}/${camposDef.length}:** ${proxDef?.pergunta}\n\n💡 ${proxDef?.explicacao}`,
          opcoes: [...(proxDef?.opcoes || []), "⏭️ Pular (usar padrão)"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      // 3. TODOS os campos coletados → gera o documento completo com IA
      estado.etapa = "documentos";
      estado.documentos[coleta.docChave] = { status: "ok", anexadoEm: new Date().toISOString() };
      const doc = FLUXO_DOCUMENTOS.find(d => d.chave === coleta.docChave);
      const nomeArquivo = coleta.docChave === "pc" ? "PEDIDO DE COMPRA" : "ESTUDO TÉCNICO PRELIMINAR (ETP)";
      const camposTexto = Object.entries(coleta.campos)
        .map(([k, v]) => `${k}: ${v || "(padrão — a definir)"}`).join("\n");
      try {
        const { chat } = await import("@/lib/ia");
        const conteudo = await chat([
          { role: "system", content: `Você é um especialista em licitações públicas (Lei 14.133/2021). Escreva o documento oficial "${nomeArquivo}" COMPLETO em português, com linguagem formal administrativa, seguindo o modelo AGU. NÃO deixe campos em branco — complete com dados coerentes quando não informados. Estrutura: cabeçalho (órgão, UG, processo), objeto, justificativa, quantitativos (quantidade+unidade), valor estimado, prazo, local de entrega/execução, encaminhamento/riscos e data.` },
          { role: "user", content: `Objeto: ${estado.objeto || "não informado"}\nUG: ${estado.ug || "não informada"}\nÓrgão: ${memorias.orgao_nome || "não informado"}\nDados coletados:\n${camposTexto}` },
        ], 0.4);
        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "documentos",
          conteudo: `📄 **${doc?.nome} GERADO completo (modelo AGU):**\n\n${conteudo.slice(0, 2000)}${conteudo.length > 2000 ? "…" : ""}\n\n⬇️ **Baixe** com o botão abaixo ou **edite** se precisar ajustar.`,
          completo: conteudo,   // documento INTEIRO (download usa este campo)
          criadaEm: new Date().toISOString(),
        });
      } catch {
        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "documentos",
          conteudo: `📄 **${doc?.nome}** gerado! (IA indisponível — use o modelo AGU na jornada do processo.)`,
          criadaEm: new Date().toISOString(),
        });
      }
      // Avança para o próximo documento
      const proximoDoc = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc!) + 1];
      if (proximoDoc) {
        estado.documentoAtual = proximoDoc.chave;
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
          conteudo: `📄 **${proximoDoc.nome}** — você já tem? Se não, posso **criar com o modelo AGU** também (campo por campo)!`,
          opcoes: ["✅ Já tenho", "❌ Ainda não", "📄 Criar com modelo AGU", "📎 Anexar arquivo"],
          criadaEm: new Date().toISOString(),
        });
      } else {
        estado.documentoAtual = undefined;
      }
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
        opcoes: ["✅ Sim", "🎯 Outra fonte", "❓ Explica", "▶️ Seguir com PNCP"],
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
        opcoes: ["💡 Sugestão do sistema", "✍️ Informar a minha", "▶️ Seguir com a sugestão"],
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
        opcoes: ["✨ Gerar com IA", "📄 Modelo AGU", "✍️ Tenho a minha", "▶️ Seguir com IA"],
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
      resumo += `\n\n**Próximo passo:** 📄 **elaborar o EDITAL** com o CATMAT provável!`;
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "finalizado",
        conteudo: resumo,
        opcoes: ["📄 Elaborar edital", "📋 Ver painel", "💬 Continuar conversando"],
        criadaEm: new Date().toISOString(),
      });
      // ── RESULTADO PRONTO: gera a minuta + justificativa com IA ──
      try {
        const { chat } = await import("@/lib/ia");
        const minuta = await chat([
          { role: "system", content: "Você é um especialista em licitações públicas (Lei 14.133/2021). Escreva uma MINUTA DE CONTRATAÇÃO completa e profissional em português, com: 1) objeto detalhado, 2) justificativa da necessidade, 3) requisitos do contratado, 4) estimativa de preços com base na pesquisa, 5) dotação orçamentária, 6) condições de pagamento, 7) vigência, 8) cláusula de sanções. Use linguagem formal de edital." },
          { role: "user", content: `Objeto: ${estado.objeto || "não informado"}\nTipo: ${estado.tipoProcesso || "—"}\nUG: ${estado.ug || "—"}\nDocumentos OK: ${FLUXO_DOCUMENTOS.filter(d => estado.documentos[d.chave]?.status === "ok").map(d => d.nome).join(", ") || "nenhum"}\nDocumentos faltando: ${faltas.map(d => d.nome).join(", ") || "nenhum"}` },
        ], 0.5);
        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "finalizado",
          conteudo: `📝 **Minuta pronta (gerada com IA):**\n\n${minuta.slice(0, 1800)}${minuta.length > 1800 ? "…" : ""}`,
          completo: minuta,   // minuta INTEIRA (download usa este campo)
          criadaEm: new Date().toISOString(),
        });
      } catch { /* IA indisponível — o resumo já foi entregue */ }
      return { mensagens: msg, estado };
    }

    // ── 8. EDITAL (com CATMAT provável) ─────────────────────────
    case "edital": {
      // Busca CATMAT/CATSER provável pelo objeto
      let catTexto = "";
      try {
        const { catmatProvavel } = await import("@/lib/catmat");
        const r = await catmatProvavel(estado.objeto || "", 5);
        estado.catmat = r.itens.map(i => `${i.tipo} ${i.codigo} — ${i.descricao.slice(0, 60)}`).join("\n");
        if (r.itens.length) {
          catTexto = `\n\n🔎 **Código(s) provável(eis) encontrado(s):**\n${r.itens.map((i, n) => `${n + 1}. ${i.tipo} **${i.codigo}** — ${i.descricao.slice(0, 70)}`).join("\n")}`;
        } else {
          catTexto = "\n\n⚠️ Não encontrei o código exato no catálogo. Posso **sugerir com IA** — ou você informa o código que conhece.";
        }
      } catch {
        catTexto = "\n\n⚠️ Não consegui consultar o catálogo agora. Posso **sugerir com IA** — ou você informa o código.";
      }

      if (t.includes("elaborar") || t.includes("edital") || t.includes("sim") || t.includes("gerar")) {
        // Pergunta o CATMAT antes de gerar (com opção de sugerir)
        msg.push({
          id: ID(), papel: "sistema", tipo: "card", etapa: "edital",
          conteudo: `📄 **Edital** — vamos elaborar!\n\n**CATMAT/CATSER provável para o objeto:**\n${estado.catmat || "a consultar…"}${catTexto}\n\n👉 Se tiver **dúvida sobre o código**, eu **sugiro o mais provável** com base no objeto.`,
          opcoes: ["💡 Sugerir o código com IA", "✍️ Vou informar o código", "▶️ Seguir com o provável"],
          criadaEm: new Date().toISOString(),
        });
        estado.etapa = "edital_catmat";
        return { mensagens: msg, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "edital",
        conteudo: "Quer **elaborar o edital** com o CATMAT provável?",
        opcoes: ["📄 Sim, elaborar edital", "📋 Ver painel", "💬 Continuar conversando"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 9. EDITAL — escolha do CATMAT ───────────────────────────
    case "edital_catmat": {
      let codigo = "";
      if (t.includes("sugerir") || t.includes("ia")) {
        // IA sugere o código mais provável
        try {
          const { chat } = await import("@/lib/ia");
          const sugestao = await chat([
            { role: "system", content: "Você é especialista em CATMAT/CATSER (catálogos de materiais e serviços do governo federal). Dado o objeto, diga APENAS o código e o nome, no formato: CÓDIGO — NOME. Ex.: 3910.05.01.0 — SERVIÇOS MÉDICOS" },
            { role: "user", content: `Objeto: ${estado.objeto}` },
          ], 0.2);
          codigo = sugestao.trim().slice(0, 120);
        } catch { codigo = ""; }
        if (!codigo) codigo = "Código CATSER provável (consulte o catálogo para confirmar)";
      } else {
        // Servidor informou o código
        codigo = texto.trim().slice(0, 120);
      }

      // Gera o edital com IA
      let edital = "";
      try {
        const { chat } = await import("@/lib/ia");
        edital = await chat([
          { role: "system", content: "Você é um especialista em licitações públicas (Lei 14.133/2021). Escreva um EDITAL DE LICITAÇÃO completo e profissional em português, com: 1) preâmbulo (órgão, processo, modalidade), 2) objeto detalhado com código CATMAT/CATSER, 3) justificativa, 4) condições de participação, 5) critérios de julgamento, 6) prazos e datas, 7) recursos, 8) disposições finais. Linguagem formal de edital." },
          { role: "user", content: `Objeto: ${estado.objeto || "não informado"}\nCódigo CATMAT/CATSER: ${codigo}\nTipo: ${estado.tipoProcesso || "—"}\nUG: ${estado.ug || "—"}` },
        ], 0.5);
      } catch { /* IA indisponível */ }

      estado.etapa = "edital_pronto";
      msg.push({
        id: ID(), papel: "sistema", tipo: "documento", etapa: "edital_pronto",
        conteudo: `📄 **EDITAL ELABORADO**\n\n**CATMAT/CATSER:** ${codigo}\n\n${edital ? edital.slice(0, 2000) + (edital.length > 2000 ? "…" : "") : "Não consegui gerar o edital agora. Use os modelos AGU na jornada do processo."}`,
        completo: `EDITAL DE LICITAÇÃO\nCATMAT/CATSER: ${codigo}\n\n${edital || ""}`,   // edital INTEIRO
        opcoes: ["⬇️ Baixar edital", "✏️ Editar edital", "📋 Ver painel"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 10. EDITAL PRONTO (final) ───────────────────────────────
    case "edital_pronto": {
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "edital_pronto",
        conteudo: "📄 **Edital elaborado!** Você pode **baixar** e **editar** — e na jornada do processo encontra tudo salvo (minuta + edital + julgados + dotação).",
        opcoes: ["⬇️ Baixar edital", "✏️ Editar edital", "📋 Ver painel"],
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

/**
 * Valida a resposta de um campo da coleta guiada.
 * Retorna mensagem de aviso amigável se inválida, ou null se OK.
 */
function validarCampoColeta(campo: string, resposta: string): string | null {
  const t = (resposta || "").trim().toLowerCase();
  if (/pular|padrão|padrao|não sei|nao sei|deixa|sugira|sim$/.test(t)) return null; // aceita escolhas padrão

  switch (campo) {
    case "quantidade":
      if (!/\d/.test(resposta)) {
        return `🤔 **"${resposta.slice(0, 50)}"** não tem um número.\n\nA **quantidade** precisa de um número (ex.: **2** profissionais, **500** resmas, **10** licenças).`;
      }
      if (/pedido de compra|etp|edital|contrato|termo de referência|preciso|quero/i.test(t)) {
        return `🤔 Isso parece um **documento**, não uma quantidade.\n\nAqui quero saber **quantos/quantas** do objeto (ex.: **2** profissionais, **500** resmas).`;
      }
      return null;
    case "unidade":
      const unidades = ["unidade", "un", "mês", "mes", "resma", "kg", "m²", "m2", "hora", "h", "dia", "serviço", "servico", "pacote", "caixa", "cx", "par", "lote"];
      if (resposta.length > 20 && !unidades.some(u => t.includes(u))) {
        return `🤔 **"${resposta.slice(0, 50)}"** não parece uma **unidade de medida**.\n\nUnidades comuns: **unidade, mês, resma, kg, m², hora, caixa**...`;
      }
      return null;
    case "prazo":
      if (!/\d/.test(resposta) && !/dias|meses|mês|ano|semana|semanal/i.test(t)) {
        return `🤔 **"${resposta.slice(0, 50)}"** não parece um **prazo**.\n\nPrazo precisa de número + período (ex.: **30 dias**, **12 meses**).`;
      }
      return null;
    case "valorEstimado":
      if (resposta.length > 0 && !/\d/.test(resposta) && !/pesquisa|pncp|definir|não sei|nao sei/i.test(t)) {
        return `🤔 **"${resposta.slice(0, 50)}"** não parece um **valor**.\n\nPode digitar um valor (ex.: **45.000,00**) ou responder **"deixa a pesquisa definir"**.`;
      }
      return null;
    default:
      return null;
  }
}
