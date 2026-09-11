import { CAMPOS_ETP, GRUPOS_ETP, type GrupoEtp } from "@/lib/etp-model";

export type EtpContexto = {
  objeto: string;
  orgao?: string;
  ug?: string;
  dfd?: Record<string,string>;
  contratacao?: Record<string,string>;
  camposExistentes?: Record<string,string>;
};

export type EtpAgente = {
  grupo: GrupoEtp;
  papel: string;
  objetivo: string;
  regraDeSaida: string;
};

export const AGENTES_ETP: EtpAgente[] = [
  { grupo:"Informações Básicas", papel:"Agente de Contexto", objetivo:"Identificar unidade requisitante, responsáveis e metadados sem repetir informações já cadastradas.", regraDeSaida:"Perguntar apenas dados administrativos que não possam ser inferidos ou pesquisados com segurança." },
  { grupo:"Necessidade", papel:"Agente da Necessidade", objetivo:"Demonstrar problema, interesse público, evidências, impacto e resultado esperado sem confundir necessidade com objeto.", regraDeSaida:"Toda afirmação factual interna precisa vir do servidor, DFD ou evidência; lacunas ficam explícitas." },
  { grupo:"Solução", papel:"Agente de Soluções e Mercado", objetivo:"Pesquisar alternativas, classificação, quantitativos, preços, parcelamento e contratações relacionadas.", regraDeSaida:"Pesquisar primeiro; apresentar análise e evidências; submeter escolhas e ambiguidades para confirmação humana." },
  { grupo:"Planejamento", papel:"Agente de Planejamento", objetivo:"Verificar alinhamento, resultados, providências e sustentabilidade.", regraDeSaida:"Nunca afirmar PCA/PLS, disponibilidade, licença ou impacto ambiental sem confirmação/evidência." },
  { grupo:"Viabilidade", papel:"Agente de Viabilidade", objetivo:"Concluir somente a partir dos elementos do estudo e revelar condicionantes.", regraDeSaida:"Sem os elementos mínimos sustentados, a saída é viabilidade condicionada/não conclusiva, nunca aprovação automática." },
  { grupo:"Anexos", papel:"Agente de Evidências", objetivo:"Garantir trilha documental das memórias, pesquisas, relatórios e anexos que sustentam o ETP.", regraDeSaida:"Distinguir evidência existente, evidência a anexar e informação ainda não comprovada." },
];

const pendente = (v: unknown) => /^\s*\[(?:A CONFIRMAR|A DEFINIR|A VERIFICAR|LEVANTAMENTO PENDENTE|ESTIMATIVA PENDENTE|MEMÓRIA DE CÁLCULO A COMPLEMENTAR|A VALIDAR|VIABILIDADE A CONCLUIR)/i.test(String(v || ""));
const preenchido = (v: unknown) => !!String(v || "").trim() && !pendente(v);

export async function prepararEtp(contexto: EtpContexto) {
  const pc = contexto.dfd || {};
  const contratacao = contexto.contratacao || {};
  const campos: Record<string,string> = { ...(contexto.camposExistentes || {}) };
  const apoios: Record<string,string> = {};
  const fontes: string[] = [];

  if (!campos.necessidade && pc.necessidade) campos.necessidade = pc.necessidade;
  if (!campos.quantidade && pc.quantidade) campos.quantidade = pc.quantidade;
  if (!campos.justificativaQuantitativo && pc.justificativaQuantitativo) campos.justificativaQuantitativo = pc.justificativaQuantitativo;
  if (!campos.resultadosPretendidos && (pc.resultado || contratacao.resultado)) campos.resultadosPretendidos = pc.resultado || contratacao.resultado;
  if (!campos.requisitosContratacao && (contratacao.requisitosTecnicos || pc.requisitosTecnicos)) campos.requisitosContratacao = contratacao.requisitosTecnicos || pc.requisitosTecnicos;
  if (!campos.alinhamentoPlanejamento && pc.alinhamentoPlanejamento) campos.alinhamentoPlanejamento = pc.alinhamentoPlanejamento;
  if (!campos.estimativaValor && pc.estimativaPesquisadaTotal) {
    const unit = pc.estimativaPesquisadaUnitario ? `; preço unitário referencial ${pc.estimativaPesquisadaUnitario}` : "";
    const fonte = pc.fonteEstimativa ? `; fonte ${pc.fonteEstimativa}` : "";
    campos.estimativaValor = `Estimativa preliminar herdada da DFD: valor total ${pc.estimativaPesquisadaTotal}${unit}${fonte}. Manter memória e referências vinculadas.`;
  }

  const objeto = contexto.objeto;
  const tarefas: Promise<void>[] = [];
  if (objeto && !preenchido(campos.levantamentoMercado)) tarefas.push((async()=>{
    try { const { levantarMercadoEtp } = await import("@/lib/etp-intelligence"); campos.levantamentoMercado = await levantarMercadoEtp(objeto); fontes.push("PNCP/Compras.gov/contratações públicas"); } catch { campos.levantamentoMercado = "[LEVANTAMENTO PENDENTE] Consulta automática indisponível; complementar antes da conclusão."; }
  })());
  if (objeto && !preenchido(campos.estimativaValor)) tarefas.push((async()=>{
    try { const { estimarValorEtp } = await import("@/lib/etp-intelligence"); campos.estimativaValor = await estimarValorEtp({objeto,quantidade:pc.quantidade,unidade:pc.unidade,local:pc.localEntrega,contexto:{...contratacao,...pc}}); fontes.push("Compras.gov/Pesquisa de Preços"); } catch { campos.estimativaValor = "[ESTIMATIVA PENDENTE] Pesquisa automática indisponível; revisar no módulo Pesquisa de preço."; }
  })());
  if (objeto) tarefas.push((async()=>{
    try { const { buscarCorrelatasEtp } = await import("@/lib/etp-intelligence"); apoios.correlatas = await buscarCorrelatasEtp(objeto); } catch { apoios.correlatas = "[A VERIFICAR] Histórico interno indisponível."; }
  })());
  if (objeto) tarefas.push((async()=>{
    try { const { sugerirImpactosEtp } = await import("@/lib/etp-intelligence"); apoios.impactosAmbientais = await sugerirImpactosEtp(objeto); } catch { apoios.impactosAmbientais = "[A VALIDAR] Avaliar impactos ambientais e sustentabilidade aplicáveis."; }
  })());
  if (objeto) tarefas.push((async()=>{
    try { const { analisarParcelamentoEtp } = await import("@/lib/etp-intelligence"); apoios.parcelamento = await analisarParcelamentoEtp(objeto,{...contratacao,...pc,...campos}); } catch { apoios.parcelamento = "[A CONFIRMAR] Analisar divisibilidade, competição, integração e economia de escala."; }
  })());
  await Promise.allSettled(tarefas);

  const pendencias = CAMPOS_ETP.filter(c => !preenchido(campos[c.chave])).map(c => ({ chave:c.chave, grupo:c.grupo, titulo:c.titulo, obrigatorio:c.obrigatorio, pergunta:c.pergunta, explicacao:c.explicacao, fundamento:c.fundamento, opcoes:c.opcoes, apoio:apoios[c.chave] }));
  const preenchidos = CAMPOS_ETP.filter(c => preenchido(campos[c.chave])).map(c => c.chave);
  const porGrupo = GRUPOS_ETP.map(grupo => ({ grupo, total:CAMPOS_ETP.filter(c=>c.grupo===grupo).length, preenchidos:CAMPOS_ETP.filter(c=>c.grupo===grupo && preenchido(campos[c.chave])).length, pendentes:pendencias.filter(p=>p.grupo===grupo).length }));

  return { campos, apoios, fontes:Array.from(new Set(fontes)), pendencias, preenchidos, porGrupo, agentes:AGENTES_ETP };
}

export function auditarCamposEtp(campos: Record<string,string>) {
  const minimos = ["necessidade","quantidade","justificativaQuantitativo","estimativaValor","parcelamento","viabilidade"];
  const faltantes = minimos.filter(k=>!preenchido(campos[k]));
  const alertas:string[]=[];
  if (String(campos.alinhamentoPlanejamento||"").match(/previst[ao].*PCA/i) && !String(campos.alinhamentoPlanejamento||"").match(/confirm|item|n[uú]mero|pca/i)) alertas.push("PCA afirmado sem elemento de confirmação claro.");
  if (String(campos.estimativaValor||"").match(/valor total/i) && !String(campos.estimativaValor||"").match(/unit[aá]ri|refer[eê]ncia|mem[oó]ria|fonte/i)) alertas.push("Estimativa sem memória/fonte/preço unitário explícito.");
  return { ok:faltantes.length===0 && alertas.length===0, faltantes, alertas };
}


export type EtpGeracaoInput = {
  objeto: string;
  orgao?: string;
  ug?: string;
  campos: Record<string,string>;
  dadosAnteriores?: Record<string,unknown>;
};

const TITULOS_GRUPOS: Record<GrupoEtp,string> = {
  "Informações Básicas":"INFORMAÇÕES BÁSICAS",
  "Necessidade":"NECESSIDADE",
  "Solução":"SOLUÇÃO",
  "Planejamento":"PLANEJAMENTO",
  "Viabilidade":"VIABILIDADE",
  "Anexos":"ANEXOS",
};

function camposDoGrupo(grupo: GrupoEtp, campos: Record<string,string>) {
  return CAMPOS_ETP.filter(c=>c.grupo===grupo).map(c=>({
    chave:c.chave, titulo:c.titulo, fundamento:c.fundamento, obrigatorio:c.obrigatorio,
    valor:String(campos[c.chave]||"").trim() || "[A DEFINIR]",
    evidencias:c.evidencias||[],
  }));
}


function dadosSuporteAnteriores(input: EtpGeracaoInput) {
  const a = (input.dadosAnteriores || {}) as any;
  const pc = a.pc || {};
  // Só entram dados da DFD que acrescentam evidência ou classificação.
  // Campos já consolidados no ETP não são repetidos para evitar conflito com respostas mais recentes.
  return {
    catmatCodigo: pc.catmatCodigo,
    catmatDescricao: pc.catmatDescricao,
    catmatPdm: pc.catmatPdm,
    estimativaPesquisadaUnitario: pc.estimativaPesquisadaUnitario,
    estimativaPesquisadaTotal: pc.estimativaPesquisadaTotal,
    fonteEstimativa: pc.fonteEstimativa,
    evidenciasNecessidade: pc.evidenciasNecessidade,
    impactoNaoContratar: pc.impactoNaoContratar,
    atendidos: pc.atendidos,
    prazo: pc.prazo,
    localEntrega: pc.localEntrega,
    prioridade: pc.prioridade,
  };
}

function normalizarSubtitulosBloco(texto: string) {
  return String(texto || "")
    .split("\n")
    .map(l => /^##\s+/.test(l) ? l.replace(/^##\s+/, "### ") : l)
    .join("\n")
    .trim();
}

async function gerarBlocoEtp(grupo: GrupoEtp, input: EtpGeracaoInput) {
  const { chat } = await import("@/lib/ia");
  const agente = AGENTES_ETP.find(a=>a.grupo===grupo)!;
  const dadosGrupo = camposDoGrupo(grupo,input.campos);
  const contextoGlobal = grupo === "Viabilidade"
    ? JSON.stringify(input.campos,null,2).slice(0,18000)
    : JSON.stringify({ necessidade:input.campos.necessidade, quantidade:input.campos.quantidade, estimativaValor:input.campos.estimativaValor, alinhamentoPlanejamento:input.campos.alinhamentoPlanejamento, resultadosPretendidos:input.campos.resultadosPretendidos },null,2).slice(0,9000);

  const texto = await chat([
    { role:"system", content:`Você é o ${agente.papel}, um dos seis módulos especialistas do ETP Digital do LEX Licitações.
OBJETIVO: ${agente.objetivo}
REGRA DE SAÍDA: ${agente.regraDeSaida}

Redija SOMENTE o conteúdo do bloco "${grupo}" de um Estudo Técnico Preliminar conforme Lei 14.133/2021 e IN SEGES 58/2022. NÃO escreva o título principal nem numeração do bloco; o orquestrador fará isso.

Regras obrigatórias:
- use somente fatos e dados fornecidos no contexto;
- não invente PCA, estoque, histórico, urgência, orçamento, licença, impacto, fornecedor, preço ou evidência;
- marcadores [A DEFINIR]/[A CONFIRMAR]/[A VERIFICAR] são permitidos quando a lacuna é real;
- quando um campo não obrigatório não for aplicável ou estiver sem informação, explique objetivamente a ausência em vez de criar conteúdo fictício;
- preserve CATMAT/CATSER, valores, quantidades, datas e identificadores exatamente como recebidos;
- para estimativa, diferencie preço unitário, quantidade e valor total e cite a fonte informada;
- para levantamento de mercado, diferencie observação de mercado, alternativa e decisão do órgão;
- para viabilidade, conclua a partir de todo o estudo; se houver condicionantes, declare-as expressamente;
- para anexos, liste evidências existentes e documentos ainda pendentes sem fingir que foram anexados;
- escreva texto administrativo substancial, claro e auditável, sem introduções genéricas e sem repetir todo o ETP.` },
    { role:"user", content:`OBJETO: ${input.objeto}
ÓRGÃO: ${input.orgao||"não informado"}
UG: ${input.ug||"não informada"}

CAMPOS DESTE BLOCO:
${JSON.stringify(dadosGrupo,null,2)}

CONTEXTO GLOBAL NECESSÁRIO:
${contextoGlobal}

DADOS HERDADOS/ANTERIORES (use somente se pertinentes):
${JSON.stringify(dadosSuporteAnteriores(input),null,2).slice(0,10000)}` }
  ], grupo === "Viabilidade" ? 0.12 : 0.2, grupo === "Solução" ? 3400 : grupo === "Planejamento" ? 2600 : 2200);
  return normalizarSubtitulosBloco(texto);
}

export async function gerarEtpCompleto(input: EtpGeracaoInput) {
  const resultados: Partial<Record<GrupoEtp,string>> = {};
  const erros: string[] = [];
  // Concorrência 2: rápido sem estourar rate-limit do provedor.
  for (let i=0;i<GRUPOS_ETP.length;i+=2) {
    const lote=GRUPOS_ETP.slice(i,i+2);
    const loteRes=await Promise.allSettled(lote.map(g=>gerarBlocoEtp(g,input)));
    lote.forEach((g,idx)=>{
      const r=loteRes[idx];
      if(r.status==="fulfilled" && r.value.trim()) resultados[g]=r.value;
      else {
        erros.push(g);
        const campos=camposDoGrupo(g,input.campos);
        resultados[g]=campos.map(c=>`### ${c.titulo}\n${c.valor}\n\nBase: ${c.fundamento}.`).join("\n\n");
      }
    });
  }
  const blocos=GRUPOS_ETP.map((g,i)=>`## ${i+1}. ${TITULOS_GRUPOS[g]}\n\n${resultados[g]||"[A DEFINIR]"}`);
  const documento=[
    "# ESTUDO TÉCNICO PRELIMINAR (ETP)",
    "",
    `**Objeto:** ${input.objeto}`,
    input.orgao ? `**Órgão:** ${input.orgao}` : "",
    input.ug ? `**Unidade/UG:** ${input.ug}` : "",
    "**Referência normativa:** Lei nº 14.133/2021 e IN SEGES nº 58/2022.",
    "",
    ...blocos,
  ].filter(Boolean).join("\n\n");
  const validacao=validarDocumentoEtp(documento);
  return { documento, blocos:resultados, erros, validacao };
}

export function validarDocumentoEtp(documento: string) {
  const titulos=GRUPOS_ETP.map((g,i)=>`## ${i+1}. ${TITULOS_GRUPOS[g]}`);
  const pos=titulos.map(t=>documento.indexOf(t));
  const seisBlocos=pos.every(x=>x>=0) && pos.every((x,i)=>i===0||x>pos[i-1]);
  return {
    ok: seisBlocos && documento.length>=5000,
    seisBlocos,
    tamanho: documento.length,
    terminaComAnexos: pos[5]>=0 && documento.length-pos[5]>200,
    titulos,
  };
}
