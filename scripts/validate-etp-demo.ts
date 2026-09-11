import { mkdir, writeFile } from "node:fs/promises";
import { enriquecerDFD } from "../lib/dfd-intelligence";
import { responder, estadoInicial, type EstadoChat, type MensagemChat } from "../lib/chat";
import { auditarCamposEtp, AGENTES_ETP } from "../lib/etp-orchestrator";

const OBJETO = "Aquisição de notebook para equipes de fiscalização ambiental itinerante, com tela de 15,6 polegadas, memória RAM de 16 GB, SSD de 512 GB, processador com 8 núcleos, sistema operacional proprietário e garantia on-site de 36 meses";

const respostas: Record<string,string> = {
  areaRequisitante: "Coordenação de Fiscalização Ambiental da Secretaria Municipal de Meio Ambiente; apoio técnico da Coordenadoria de Tecnologia da Informação.",
  descricaoSolucao: "Aquisição de notebooks corporativos novos, com fonte de alimentação e garantia on-site, destinados ao trabalho de campo e à elaboração de autos, relatórios e registros de fiscalização. A especificação final deverá manter requisitos mínimos suficientes e permitir competição.",
  parcelamento: "Quero que o LEX analise",
  correlatas: "Não sei — procurar no histórico",
  alinhamentoPlanejamento: "Prevista no PCA 2026, item PCA-AMB-042, eixo Modernização da Fiscalização Ambiental.",
  providencias: "Concluir o inventário dos equipamentos que serão substituídos, definir responsáveis pelo recebimento e preparar a configuração padronizada pela equipe de TI antes da distribuição.",
  impactosAmbientais: "Quero que o LEX sugira pontos para validar",
  viabilidade: "Quero que o LEX faça a análise conclusiva",
  responsaveis: "Maria Souza — Analista de Planejamento, responsável pela elaboração; José Pereira — Coordenador de Fiscalização, responsável pela validação da necessidade.",
  anexosEtp: "Usar documentos já vinculados: DFD, inventário dos equipamentos, memória do quantitativo e relatório da pesquisa de preços.",
};

(async()=>{
  const enriquecimento = await enriquecerDFD({
    objeto: OBJETO, quantidade:"18", unidade:"unidade", localEntrega:"Porto Velho/RO",
    dadosContexto:{ requisitosTecnicos:"Tela 15,6 polegadas; RAM 16 GB; SSD 512 GB; processador 8 núcleos; sistema operacional proprietário; garantia on-site 36 meses" }
  });
  if (!enriquecimento.catalogo || !enriquecimento.estimativa) throw new Error("DFD demo sem CATMAT/estimativa suficientes");

  const pc: Record<string,string> = {
    necessidade:"As equipes de fiscalização ambiental possuem equipamentos insuficientes e parte do parque atual apresenta falhas recorrentes, o que reduz a disponibilidade de estações móveis para vistorias e elaboração de relatórios em campo.",
    resultado:"Disponibilizar estação móvel adequada para as equipes de fiscalização, reduzindo compartilhamento de equipamentos e atrasos na formalização dos registros de campo.",
    atendidos:"18 postos de trabalho das equipes de fiscalização ambiental itinerante.",
    quantidade:"18", unidade:"unidade",
    justificativaQuantitativo:"O quantitativo corresponde a 12 equipamentos destinados à substituição de notebooks com falhas recorrentes identificados no inventário e 6 equipamentos para postos de trabalho atualmente sem equipamento móvel dedicado. Memória: 12 + 6 = 18 unidades.",
    impactoNaoContratar:"Manutenção do compartilhamento de equipamentos, maior tempo entre a vistoria e o registro administrativo, indisponibilidade em caso de falha e redução da capacidade de trabalho simultâneo das equipes.",
    evidenciasNecessidade:"Inventário patrimonial, chamados de manutenção e relação de postos de trabalho da fiscalização.",
    alinhamentoPlanejamento:"[A CONFIRMAR] previsão no PCA",
    prioridade:"Alta, em razão do impacto operacional nas equipes de fiscalização.",
    prazo:"45 dias para entrega", localEntrega:"Porto Velho/RO",
    requisitosTecnicos:"Tela 15,6 polegadas; RAM 16 GB; SSD 512 GB; processador com 8 núcleos; sistema operacional proprietário; garantia on-site 36 meses.",
    catmatCodigo:String(enriquecimento.catalogo.codigo), catmatDescricao:enriquecimento.catalogo.descricao,
    estimativaPesquisadaUnitario:String(enriquecimento.estimativa.valorUnitario), estimativaPesquisadaTotal:String(enriquecimento.estimativa.valorTotal),
    fonteEstimativa:enriquecimento.estimativa.fontePrincipal,
  };
  const estado: EstadoChat = { ...estadoInicial(), etapa:"documentos", objeto:OBJETO, ug:"SEMMA-001", documentoAtual:"etp", documentos:{pc:{status:"ok"}}, documentosGerados:{ pc, contratacao:{ requisitosTecnicos:pc.requisitosTecnicos, resultado:pc.resultado } } };
  let atual = estado;
  const transcript: string[] = [];
  let r = await responder("Criar ETP Digital", atual, { orgao_nome:"Órgão Demonstração — Município Fictício/RO" });
  atual = r.estado; transcript.push(...r.mensagens.map(m=>m.conteudo));
  const perguntasIniciais = atual.docColeta?.ordem?.length || 0;
  const autoPreenchidos = Object.entries(atual.docColeta?.campos || {}).filter(([k,v])=>!k.startsWith("_") && String(v||"").trim()).length;

  let guard=0;
  while (atual.etapa === "coleta_doc" && guard++ < 30) {
    const campo = atual.docColeta?.campoAtual || atual.docColeta?.ordem?.[0];
    if (!campo) break;
    const resposta = respostas[campo] || `Informação de demonstração confirmada para ${campo}.`;
    r = await responder(resposta, atual, { orgao_nome:"Órgão Demonstração — Município Fictício/RO" });
    atual = r.estado; transcript.push(`SERVIDOR[${campo}]: ${resposta}`,...r.mensagens.map(m=>m.conteudo));
  }

  const mensagens = r.mensagens as MensagemChat[];
  const docMsg = [...mensagens].reverse().find(m=>m.tipo==="documento" && (m.completo || m.conteudo).includes("ESTUDO TÉCNICO")) || null;
  const documento = docMsg?.completo || docMsg?.conteudo || transcript.filter(x=>x.includes("ESTUDO TÉCNICO")).slice(-1)[0] || "";
  const headings = ["1. INFORMAÇÕES BÁSICAS","2. NECESSIDADE","3. SOLUÇÃO","4. PLANEJAMENTO","5. VIABILIDADE","6. ANEXOS"];
  const pos = headings.map(h=>documento.indexOf(h));
  const ordemOk = pos.every(x=>x>=0) && pos.every((x,i)=>i===0 || x>pos[i-1]);
  const camposAudit = atual.documentosGerados?.etp || atual.docColeta?.campos || {};
  const auditoria = auditarCamposEtp(camposAudit as Record<string,string>);
  const unresolved=(documento.match(/\[(?:A DEFINIR|A CONFIRMAR|A VERIFICAR|PENDENTE|A VALIDAR)[^\]]*\]/gi)||[]);

  const checks = {
    seisMiniagentes: AGENTES_ETP.length===6,
    termoPesquisa: enriquecimento.termoPesquisa.toLowerCase()==="notebook",
    catmatAltaOuMedia: !!enriquecimento.catalogo && enriquecimento.catalogo.confianca!=="baixa",
    estimativa3Refs: !!enriquecimento.estimativa && enriquecimento.estimativa.referencias>=3,
    valorTotalCoerente: enriquecimento.estimativa?.valorTotal === (enriquecimento.estimativa?.valorUnitario||0)*18,
    conversaReduziuPerguntas: perguntasIniciais < 18 && autoPreenchidos >= 6,
    documentoInteiro: documento.length >= 9000,
    seisBlocosNaOrdem: ordemOk,
    contemCatmat: documento.includes(String(enriquecimento.catalogo?.codigo)),
    contemEstimativa: /98[.\s]?820|98\.820|98820/.test(documento) || documento.includes(String(enriquecimento.estimativa?.valorTotal)),
    contemPcaConfirmado: documento.includes("PCA-AMB-042"),
    semRegimeAntigo: !/IN\s*40\/2020|Lei\s*(?:n[º°]?\s*)?8\.666/i.test(documento),
    temMercado: /levantamento de mercado/i.test(documento),
    temParcelamento: /parcelamento/i.test(documento),
    temViabilidade: /viabil/i.test(documento),
    auditoriaMinimos: auditoria.ok,
    encerraComAnexos: pos[5]>=0 && documento.length-pos[5]>300,
  };
  const falhas=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  const resumo={ data:new Date().toISOString(), pedido:OBJETO, termoPesquisa:enriquecimento.termoPesquisa, catmat:enriquecimento.catalogo, estimativa:enriquecimento.estimativa, perguntasIniciais, autoPreenchidos, tamanhoDocumento:documento.length, unresolved:unresolved.length, auditoria, checks, falhas };
  await mkdir("docs/validacao",{recursive:true});
  await writeFile("docs/validacao/etp-demo-validacao.json",JSON.stringify(resumo,null,2));
  await writeFile("docs/validacao/etp-demo-documento.md",documento);
  await writeFile("docs/validacao/etp-demo-transcricao.md",transcript.join("\n\n---\n\n"));
  console.log(JSON.stringify(resumo,null,2));
  if(falhas.length) process.exitCode=2;
})().catch(e=>{console.error(e);process.exit(1)});
