import { camposEtpConversa, guiaEtpParaIA } from "@/lib/etp-model";
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

export interface PerguntaDescoberta {
  chave: string;
  pergunta: string;
  motivo: string;
  opcoes?: string[];
}

export interface DNAObjeto {
  familia: string;
  resumo?: string;
  perguntas: PerguntaDescoberta[];
  indice: number;
  respostas: Record<string, string>;
  lacunas: string[];
}

export interface EstadoChat {
  etapa: string;                       // intencao | descoberta | ug | documentos | coleta_doc | pesquisa | dotacao | minuta | juridico | finalizado | edital | edital_catmat | edital_pronto
  objeto?: string;
  tipoProcesso?: string;
  ug?: string;
  modalidade?: string;
  descoberta?: DNAObjeto;              // DNA do objeto + respostas da investigação inicial
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
  documentosGerados?: Record<string, Record<string, string>>;  // AGENTE REDATOR: campos coletados por documento (encadeia PC→ETP→TR)
  modoSolicitado?: string;
  modoIndice?: number;
  modoRespostas?: Record<string, string>;
}

/** Campos guiados por documento — pergunta, explicação e opções sugeridas. */
export const CAMPOS_DOCUMENTO: Record<string, { chave: string; pergunta: string; explicacao: string; opcoes?: string[]; grupo?: string; fundamento?: string }[]> = {
  pc: [
    { chave: "necessidade", pergunta: "Qual é a **necessidade concreta** que o setor precisa resolver?", explicacao: "Descreva a situação atual e o problema real. Se isso já apareceu na conversa, o LEX reaproveita e não pergunta de novo." },
    { chave: "resultado", pergunta: "Qual **resultado o órgão espera obter** com essa compra ou contratação?", explicacao: "Explique o que deve melhorar depois da contratação: continuidade do serviço, capacidade de atendimento, segurança, produtividade, disponibilidade etc." },
    { chave: "atendidos", pergunta: "Quem ou quais unidades serão **beneficiados ou atendidos**?", explicacao: "Isso ajuda a demonstrar dimensão, alcance e pertinência da demanda." },
    { chave: "quantidade", pergunta: "Qual a **quantidade** necessária?", explicacao: "Ex.: 1 profissional, 500 resmas, 10 licenças. Baseia-se na demanda do setor requisitante.", opcoes: ["1 unidade", "Mês (serviço continuado)"] },
    { chave: "unidade", pergunta: "Qual a **unidade de medida**?", explicacao: "unidade, mês, resma, kg, m², hora…", opcoes: ["unidade", "mês", "resma", "kg"] },
    { chave: "justificativaQuantitativo", pergunta: "Como o setor chegou a essa **quantidade**?", explicacao: "Informe a base do dimensionamento: consumo histórico, número de usuários/unidades, estoque atual, expansão prevista, demanda reprimida, contrato anterior ou outro critério." },
    { chave: "impactoNaoContratar", pergunta: "O que acontece se o órgão **não fizer essa contratação**?", explicacao: "Descreva consequências concretas: interrupção, perda de capacidade, risco operacional, atraso, desperdício, descumprimento de meta ou prejuízo ao atendimento." },
    { chave: "evidenciasNecessidade", pergunta: "Que **evidências internas** sustentam essa necessidade?", explicacao: "Pode ser consumo anterior, estoque insuficiente, inventário, chamados, relatórios, laudos, demanda das unidades, contrato próximo do fim ou outro registro.", opcoes: ["Consumo ou histórico", "Estoque ou inventário", "Relatório ou laudo", "Demandas das unidades", "Contrato próximo do fim", "Ainda não tenho evidência"] },
    { chave: "alinhamentoPlanejamento", pergunta: "Essa demanda está prevista no **PCA ou em outro planejamento do órgão**?", explicacao: "Se estiver, informe o instrumento/item. Se não estiver ou não souber, o documento registra a necessidade de confirmar ou incluir no planejamento, sem inventar.", opcoes: ["Sim, está no PCA", "Sim, em outro planejamento", "Não está prevista", "Não sei — precisa verificar"] },
    { chave: "prioridade", pergunta: "Qual é a **prioridade** dessa demanda e por quê?", explicacao: "A prioridade deve decorrer do impacto e do planejamento, não apenas de uma classificação genérica.", opcoes: ["Alta", "Média", "Baixa", "Preciso avaliar"] },
    { chave: "valorEstimado", pergunta: "Quer que o LEX faça agora a **estimativa preliminar em fontes oficiais**?", explicacao: "O LEX consulta Pesquisa de Preços do Compras.gov e PNCP, identifica referências comparáveis e registra a memória da estimativa. Se você já tiver um valor, ele será mantido para comparação.", opcoes: ["Pesquisar automaticamente nas fontes oficiais", "Já tenho um valor preliminar"] },
    { chave: "prazo", pergunta: "Qual o **prazo** desejado?", explicacao: "Ex.: 30 dias para entrega, 12 meses de vigência para serviço continuado.", opcoes: ["30 dias", "12 meses (serviço continuado)"] },
    { chave: "localEntrega", pergunta: "Onde será a **entrega ou execução**?", explicacao: "Ex.: Almoxarifado Central, Unidade Básica de Saúde X, endereço do órgão." },
  ],
  etp: camposEtpConversa(),
  tr: [
    { chave: "escopo", pergunta: "Vamos fechar o **escopo exato** do serviço ou fornecimento. O que precisa estar incluído?", explicacao: "O TR precisa deixar claro o que a contratada deverá entregar ou executar." },
    { chave: "requisitosTecnicos", pergunta: "Quais **requisitos técnicos mínimos** precisam ser atendidos?", explicacao: "Aqui entram desempenho, qualidade, normas, qualificações e especificações indispensáveis." },
    { chave: "modeloExecucao", pergunta: "Como você espera que a **execução** aconteça na prática?", explicacao: "Ex.: por demanda, cronograma, visitas periódicas, entrega única ou fornecimento parcelado." },
    { chave: "medicao", pergunta: "Como o órgão vai **medir e aceitar** o que foi entregue?", explicacao: "Definir medição e aceite evita dúvida durante a fiscalização e o pagamento." },
    { chave: "responsabilidades", pergunta: "Há alguma **responsabilidade da contratada ou do órgão** que precisa ficar expressa?", explicacao: "Ex.: materiais, equipamentos, deslocamento, descarte, acesso ao local e apoio técnico." },
  ],
};

// Fluxo de documentos por tipo de processo (PC → ETP → depois etapas do chat)
// Observação: pesquisa/dotação/minuta/jurídico têm ETAPAS PRÓPRIAS no chat —
// aqui ficam só os documentos físicos que o servidor precisa ter.
export const FLUXO_DOCUMENTOS = [
  { chave: "pc", nome: "DFD / Requisição de Compra", obrigatorio: true,
    implicacao: "sem a formalização da demanda, o processo começa sem registrar claramente a necessidade do setor requisitante." },
  { chave: "etp", nome: "Estudo Técnico Preliminar (ETP)", obrigatorio: true,
    implicacao: "sem ETP, fica prejudicada a demonstração do problema, das alternativas e da solução escolhida." },
  { chave: "tr", nome: "Termo de Referência (TR)", obrigatorio: true,
    implicacao: "sem TR, o objeto, os requisitos, a execução, a medição e as responsabilidades podem ficar insuficientemente definidos." },
];

const ID = () => Math.random().toString(36).slice(2, 10);


type PerguntaModo = { chave: string; pergunta: string; motivo: string; opcoes?: string[] };
type GuiaModo = { titulo: string; abertura: string; perguntas: PerguntaModo[]; proximos: string[] };

const GUIAS_MODO: Record<string, GuiaModo> = {
  necessidade: { titulo: "Descobrir a necessidade", abertura: "Vamos começar pelo problema real, antes de decidir a solução.", perguntas: [
    { chave: "ponto", pergunta: "Em que situação você está agora?", motivo: "Isso define o ponto certo de partida.", opcoes: ["Tenho um problema, mas não sei a solução", "Já tenho uma ideia do que contratar", "Tenho uma demanda ou documento"] },
    { chave: "problema", pergunta: "Qual problema ou necessidade o setor precisa resolver?", motivo: "A contratação deve nascer da necessidade real." },
    { chave: "resultado", pergunta: "Que resultado você espera alcançar?", motivo: "O resultado esperado orienta a solução e o objeto." },
    { chave: "atendidos", pergunta: "Quem ou qual unidade será atendida?", motivo: "Público e local de uso mudam quantidade e requisitos." },
    { chave: "urgencia", pergunta: "Existe prazo ou urgência?", motivo: "Urgência real precisa ser registrada e justificada.", opcoes: ["É urgente", "Tem prazo definido", "Sem urgência especial", "Ainda não sei"] },
    { chave: "documentos", pergunta: "Você já tem pedido, memorando, DFD, requisição, foto ou planilha sobre isso?", motivo: "O LEX pode reaproveitar o que já existe.", opcoes: ["Sim, tenho documento", "Tenho algumas informações", "Não tenho nada ainda"] }
  ], proximos: ["Ir para Planejar a contratação", "Ir para Definir o objeto", "Voltar aos procedimentos"] },
  planejamento: { titulo: "Planejar a contratação", abertura: "Vamos organizar a necessidade, as alternativas e a fase preparatória.", perguntas: [
    { chave: "ponto", pergunta: "O que você já tem pronto?", motivo: "Assim não refazemos trabalho.", opcoes: ["Só tenho a necessidade", "Já tenho DFD/Requisição", "Já comecei o ETP", "Quero revisar o planejamento"] },
    { chave: "contratacao", pergunta: "Qual contratação ou processo vamos planejar?", motivo: "Precisamos identificar o contexto correto." },
    { chave: "resultado", pergunta: "Qual resultado a Administração precisa obter?", motivo: "Isso orienta alternativas, requisitos e justificativas." },
    { chave: "quantidade", pergunta: "Você já sabe quantidade, capacidade ou volume necessário?", motivo: "O quantitativo precisa ser justificável.", opcoes: ["Sim", "Tenho uma estimativa", "Ainda preciso calcular"] },
    { chave: "alternativas", pergunta: "Já foram consideradas alternativas?", motivo: "O ETP precisa demonstrar por que a solução faz sentido.", opcoes: ["Sim", "Tenho algumas opções", "Ainda não"] },
    { chave: "historico", pergunta: "Existe contratação anterior semelhante?", motivo: "O histórico pode antecipar trabalho sem copiar decisões antigas.", opcoes: ["Sim", "Não", "Não sei — quero que o LEX procure"] },
    { chave: "riscos", pergunta: "Os principais riscos já foram identificados?", motivo: "Riscos devem ser tratados antes da execução.", opcoes: ["Sim", "Tenho alguns", "Ainda não"] }
  ], proximos: ["Ir para Definir o objeto", "Ir para Pesquisa de preços", "Voltar aos procedimentos"] },
  objeto: { titulo: "Definir o objeto", abertura: "Vamos transformar a necessidade em algo que o mercado consiga entender e entregar.", perguntas: [
    { chave: "natureza", pergunta: "Que tipo de contratação parece ser?", motivo: "A natureza muda especificação, medição e execução.", opcoes: ["Compra de material/bem", "Serviço", "Obra ou engenharia", "Locação", "Ainda não sei"] },
    { chave: "descricao", pergunta: "Como você descreveria o que precisa ser contratado?", motivo: "Partimos da sua descrição e refinamos sem inventar requisito." },
    { chave: "quantidade", pergunta: "Qual quantidade, capacidade ou volume precisa ser atendido?", motivo: "Sem dimensionamento a pesquisa de preço fica frágil." },
    { chave: "unidade", pergunta: "Qual unidade de medida faz sentido?", motivo: "Ela precisa permitir comparar preço e medir entrega.", opcoes: ["Unidade", "Mês", "Hora", "Kg", "m²", "Outra"] },
    { chave: "escopo", pergunta: "O que deve estar incluído e o que deve ficar fora do escopo?", motivo: "Limites claros evitam propostas incomparáveis." },
    { chave: "requisitos", pergunta: "Existe requisito técnico ou de qualidade indispensável?", motivo: "Só entra requisito ligado diretamente à necessidade." },
    { chave: "execucao", pergunta: "Como a entrega ou execução deve acontecer?", motivo: "Isso interfere em preço, fiscalização e obrigações.", opcoes: ["Entrega única", "Entrega parcelada", "Serviço contínuo", "Por demanda", "Ainda não definido"] },
    { chave: "medicao", pergunta: "Como o órgão vai conferir e aceitar a entrega?", motivo: "Medição e aceite precisam estar claros antes da contratação." }
  ], proximos: ["Ir para Pesquisa de preços", "Ir para Planejar a contratação", "Voltar aos procedimentos"] },
  pesquisa: { titulo: "Pesquisa de preços", abertura: "Vamos preparar uma pesquisa comparável, rastreável e defensável.", perguntas: [
    { chave: "objeto", pergunta: "Qual objeto será pesquisado?", motivo: "A descrição precisa permitir referências comparáveis." },
    { chave: "quantidade", pergunta: "Qual quantidade e unidade de medida serão pesquisadas?", motivo: "Preço sem quantidade e unidade pode enganar." },
    { chave: "local", pergunta: "Qual local ou região de referência?", motivo: "Frete e mercado regional podem alterar o preço." },
    { chave: "periodo", pergunta: "Qual período de referência dos preços?", motivo: "Preço antigo demais pode não representar o mercado atual.", opcoes: ["Últimos 6 meses", "Últimos 12 meses", "Regra do órgão", "Ainda não definido"] },
    { chave: "fontes", pergunta: "Quais fontes quer usar ou já tem?", motivo: "Combinar fontes fortalece a pesquisa.", opcoes: ["PNCP", "Contratações similares", "Cotações de fornecedores", "Notas/contratos", "Quero que o LEX sugira"] },
    { chave: "evidencias", pergunta: "Você já tem cotações, prints, atas, notas ou contratos?", motivo: "As evidências precisam ficar vinculadas às referências.", opcoes: ["Sim", "Tenho algumas", "Ainda não"] },
    { chave: "outliers", pergunta: "Como quer tratar valores muito fora do padrão?", motivo: "Outliers precisam de critério e justificativa.", opcoes: ["LEX identifica e sugere", "Vou revisar manualmente", "Seguir regra do órgão"] }
  ], proximos: ["Abrir pesquisa de preços", "Ir para Definir o objeto", "Voltar aos procedimentos"] },
  preparacao: { titulo: "Preparar a licitação", abertura: "Vamos conferir as peças e decisões antes da publicação.", perguntas: [
    { chave: "processo", pergunta: "Qual processo ou contratação você está preparando?", motivo: "Precisamos revisar o conjunto certo de peças." },
    { chave: "tr", pergunta: "O Termo de Referência ou projeto equivalente está pronto?", motivo: "O edital depende de um objeto técnico consistente.", opcoes: ["Sim", "Em revisão", "Ainda não"] },
    { chave: "orcamento", pergunta: "A adequação orçamentária já foi confirmada?", motivo: "A contratação precisa ser compatível com o orçamento.", opcoes: ["Sim", "Em validação", "Ainda não"] },
    { chave: "estrategia", pergunta: "Modalidade, julgamento e modo de disputa já foram definidos?", motivo: "Essas escolhas devem ser coerentes com o objeto.", opcoes: ["Sim", "Parcialmente", "Ainda não — quero ajuda"] },
    { chave: "minutas", pergunta: "Edital, minuta contratual e anexos já existem?", motivo: "O LEX pode apontar o que falta.", opcoes: ["Sim", "Tenho parte", "Ainda não"] },
    { chave: "juridico", pergunta: "A análise jurídica já aconteceu?", motivo: "Apontamentos precisam ser tratados antes da publicação quando aplicável.", opcoes: ["Sim, sem apontamentos", "Sim, com apontamentos", "Ainda não"] },
    { chave: "publicacao", pergunta: "Em que ponto da publicação você está?", motivo: "Isso define os próximos controles.", opcoes: ["Ainda preparando", "Pronto para publicar", "Já publicado"] }
  ], proximos: ["Ir para Selecionar o fornecedor", "Voltar aos procedimentos"] },
  selecao: { titulo: "Selecionar o fornecedor", abertura: "Vamos acompanhar sessão, julgamento, habilitação e recursos.", perguntas: [
    { chave: "processo", pergunta: "Qual certame ou processo vamos acompanhar?", motivo: "Isso identifica as regras e a sessão corretas." },
    { chave: "momento", pergunta: "Em que momento da seleção você está?", motivo: "Cada fase exige controles diferentes.", opcoes: ["Sessão vai começar", "Propostas/lances", "Julgamento", "Habilitação", "Recursos", "Adjudicação/homologação"] },
    { chave: "plataforma", pergunta: "Em qual plataforma ou portal a sessão acontece?", motivo: "Isso define onde acompanhar chat, convocações e prazos." },
    { chave: "pendencia", pergunta: "Existe convocação, diligência ou prazo pendente?", motivo: "Pendências de sessão podem ter prazo curto.", opcoes: ["Sim", "Não", "Não sei — preciso conferir"] },
    { chave: "habilitacao", pergunta: "A habilitação já foi conferida?", motivo: "Conferência antecipada reduz risco de retrabalho.", opcoes: ["Sim", "Parcialmente", "Ainda não"] },
    { chave: "recursos", pergunta: "Há recurso ou contrarrazão em andamento?", motivo: "Prazos e fundamentos precisam ser acompanhados.", opcoes: ["Não", "Intenção de recurso", "Recurso", "Contrarrazão"] }
  ], proximos: ["Ir para Contrato e execução", "Voltar aos procedimentos"] },
  contrato: { titulo: "Contrato e execução", abertura: "Vamos cuidar da formalização, fiscalização, execução e encerramento.", perguntas: [
    { chave: "processo", pergunta: "Qual contrato, ata ou processo vamos acompanhar?", motivo: "Precisamos identificar o instrumento correto." },
    { chave: "fase", pergunta: "Em que fase você está?", motivo: "Formalização, execução e encerramento têm controles diferentes.", opcoes: ["Formalizando", "Início da execução", "Execução em andamento", "Alteração/prorrogação", "Encerramento"] },
    { chave: "instrumento", pergunta: "Qual instrumento será ou foi usado?", motivo: "Contrato, ata e instrumento substitutivo têm rotinas próprias.", opcoes: ["Contrato", "Ata de Registro de Preços", "Nota de empenho/instrumento substitutivo", "Ainda não definido"] },
    { chave: "fiscais", pergunta: "Gestor e fiscais já foram designados?", motivo: "A execução precisa de responsabilidades formais.", opcoes: ["Sim", "Parcialmente", "Ainda não"] },
    { chave: "ocorrencias", pergunta: "Existe atraso, descumprimento, alteração ou prorrogação?", motivo: "Eventos da execução precisam ser registrados e tratados.", opcoes: ["Não", "Atraso/descumprimento", "Alteração", "Prorrogação", "Outra ocorrência"] },
    { chave: "pagamento", pergunta: "Como está a medição, aceite e pagamento?", motivo: "Entrega, liquidação e pagamento precisam estar coerentes.", opcoes: ["Tudo regular", "Aguardando medição/aceite", "Aguardando pagamento", "Há divergência"] },
    { chave: "encerramento", pergunta: "Há providência de encerramento pendente?", motivo: "Os registros finais fecham a trilha do processo.", opcoes: ["Não", "Recebimento definitivo", "Pendência documental", "Quero revisar o encerramento"] }
  ], proximos: ["Voltar aos procedimentos"] }
};

function dnaFallback(objeto: string): Omit<DNAObjeto, "indice" | "respostas" | "lacunas"> {
  const piscina = /piscina|piscinas/i.test(objeto);
  if (piscina) {
    return {
      familia: "Serviço → manutenção/limpeza de piscina",
      resumo: "Manutenção, limpeza e/ou tratamento de piscina",
      perguntas: [
        { chave: "necessidade", pergunta: "Essa piscina já existe e você precisa de manutenção periódica ou é um serviço pontual?", motivo: "Isso muda o dimensionamento, a vigência e a forma de execução.", opcoes: ["Manutenção periódica", "Serviço pontual"] },
        { chave: "quantidade", pergunta: "Quantas piscinas precisam ser atendidas?", motivo: "A quantidade é a primeira base para dimensionar equipe, visitas e consumo de insumos." },
        { chave: "dimensoes", pergunta: "Você sabe as dimensões ou o volume aproximado de cada piscina?", motivo: "Volume e dimensões influenciam produtos químicos, tempo de trabalho e capacidade de equipamentos.", opcoes: ["Sei as dimensões", "Tenho planta/foto/documento", "Não sei ainda"] },
        { chave: "escopo", pergunta: "O serviço inclui só limpeza ou também tratamento químico da água?", motivo: "Limpeza física e tratamento químico têm insumos, rotinas e responsabilidades diferentes.", opcoes: ["Só limpeza", "Limpeza + tratamento químico"] },
        { chave: "materiais", pergunta: "Quem deve fornecer cloro, algicida, regulador de pH e demais produtos: o órgão ou a contratada?", motivo: "Isso altera o preço, a fiscalização e as obrigações contratuais.", opcoes: ["A contratada fornece", "O órgão fornece", "Ainda não definido"] },
        { chave: "equipamentos", pergunta: "Bomba, filtro ou sistema de circulação também precisam entrar na manutenção?", motivo: "Se esses equipamentos fizerem parte do escopo, precisamos prever rotina e qualificação técnica.", opcoes: ["Sim", "Não", "Ainda não sei"] },
        { chave: "frequencia", pergunta: "Qual frequência você imagina para o atendimento?", motivo: "A frequência define carga de trabalho, equipe e forma de medição.", opcoes: ["Diária", "Semanal", "Quinzenal", "Por demanda"] },
        { chave: "publicoUso", pergunta: "Quem utiliza essa piscina: crianças, atletas, pacientes, servidores ou público geral?", motivo: "O perfil de uso pode exigir cuidados operacionais e sanitários diferentes." },
        { chave: "requisitosTecnicos", pergunta: "Existe alguma exigência sanitária, responsabilidade técnica, laudo ou regra específica do local que já conhecemos?", motivo: "Requisitos técnicos precisam ser identificados antes de escrever o TR, não inventados depois." },
      ],
    };
  }
  return {
    familia: "Contratação pública",
    resumo: objeto.slice(0, 160),
    perguntas: [
      { chave: "necessidade", pergunta: "Qual problema você precisa resolver com essa contratação?", motivo: "Primeiro precisamos separar a necessidade real da solução que veio à cabeça." },
      { chave: "quantidade", pergunta: "Qual quantidade, capacidade ou volume você precisa atender?", motivo: "O dimensionamento evita contratar de menos ou de mais." },
      { chave: "unidade", pergunta: "Como essa necessidade é medida na prática?", motivo: "A unidade de medida precisa fazer sentido para pesquisa de preço, execução e pagamento." },
      { chave: "escopo", pergunta: "O que precisa estar incluído e o que deve ficar fora do escopo?", motivo: "Limites claros reduzem aditivos, dúvidas e propostas incomparáveis." },
      { chave: "frequencia", pergunta: "É uma entrega única, serviço contínuo, periódico ou por demanda?", motivo: "A forma de execução muda o planejamento, preço e fiscalização." },
      { chave: "prazo", pergunta: "Por quanto tempo ou em qual prazo essa necessidade precisa ser atendida?", motivo: "Prazo e vigência influenciam quantitativos, solução e custo." },
      { chave: "localEntrega", pergunta: "Onde a entrega ou execução vai acontecer?", motivo: "Local e logística podem alterar preço, requisitos e capacidade de atendimento." },
      { chave: "responsabilidades", pergunta: "Quem deve fornecer materiais, equipamentos, acesso, deslocamento ou apoio necessário?", motivo: "Separar responsabilidades evita custo oculto e conflito na execução." },
      { chave: "requisitosTecnicos", pergunta: "Há algum requisito técnico, normativo ou de qualidade que seja indispensável?", motivo: "Requisito essencial deve nascer da necessidade e ser justificado." },
    ],
  };
}

async function montarDNAObjeto(objeto: string, tipoProcesso: string, memorias: Record<string, string>): Promise<DNAObjeto> {
  const fallback = dnaFallback(objeto);
  try {
    const { chat } = await import("@/lib/ia");
    const historico = memorias.historico_semelhante || "Nenhum processo semelhante identificado no histórico do órgão.";
    const system = `Você é o LEX Licitações, um arquiteto de contratações públicas brasileiras. Sua função NÃO é correr para preencher ETP/TR. Primeiro descubra exatamente o que o órgão precisa contratar.

Crie o DNA inicial do objeto com 6 a 10 perguntas realmente úteis e específicas para esta contratação. Pergunte uma definição por vez. As perguntas devem descobrir, quando aplicável: problema/necessidade, quantidade, dimensões/capacidade, escopo, frequência, prazo, materiais/insumos, equipamentos envolvidos, responsabilidades, perfil de uso, requisitos técnicos/sanitários, medição e riscos de execução.

REGRAS:
- Não pergunte UG, modalidade, preço ou documentos nesta etapa.
- Não invente requisito técnico nem dado faltante; transforme a dúvida em pergunta.
- Explique em uma frase por que cada pergunta importa.
- Use chaves curtas e estáveis. Quando couber, prefira: necessidade, quantidade, unidade, dimensoes, escopo, frequencia, prazo, localEntrega, materiais, equipamentos, responsabilidades, publicoUso, requisitosTecnicos, medicao, riscos.
- Considere o histórico do órgão apenas como referência; nunca assuma que a contratação atual é igual.
- Responda APENAS JSON válido no formato: {"familia":"...","resumo":"...","perguntas":[{"chave":"...","pergunta":"...","motivo":"...","opcoes":["..."]}]}.`;
    const user = `Objeto informado: ${objeto}\nTipo inicialmente identificado: ${tipoProcesso}\nHistórico semelhante do órgão: ${historico}`;
    const out = await chat([{ role: "system", content: system }, { role: "user", content: user }], 0.25);
    const m = out.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("dna_sem_json");
    const j = JSON.parse(m[0]);
    const perguntas = Array.isArray(j.perguntas) ? j.perguntas
      .filter((q: any) => q && q.chave && q.pergunta && q.motivo)
      .slice(0, 10)
      .map((q: any) => ({
        chave: String(q.chave).slice(0, 50),
        pergunta: String(q.pergunta).slice(0, 500),
        motivo: String(q.motivo).slice(0, 500),
        opcoes: Array.isArray(q.opcoes) ? q.opcoes.map((o: any) => String(o).slice(0, 120)).slice(0, 5) : undefined,
      })) : [];
    if (perguntas.length < 4) throw new Error("dna_insuficiente");
    return {
      familia: String(j.familia || fallback.familia).slice(0, 160),
      resumo: String(j.resumo || fallback.resumo || objeto).slice(0, 300),
      perguntas,
      indice: 0,
      respostas: {},
      lacunas: [],
    };
  } catch {
    return { ...fallback, indice: 0, respostas: {}, lacunas: [] };
  }
}

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
export function mensagemAbertura(hasMemoria: boolean, memorias?: Record<string, string>, modo?: string): MensagemChat {
  const guia = modo ? GUIAS_MODO[modo] : undefined;
  if (guia) {
    const primeira = guia.perguntas[0];
    return {
      id: ID(), papel: "sistema", tipo: "card", etapa: "modo_guiado",
      conteudo: `**${guia.titulo}**\n\n${guia.abertura}\n\n**${primeira.pergunta}**\n\n_Por que estou perguntando: ${primeira.motivo}_`,
      opcoes: primeira.opcoes, criadaEm: new Date().toISOString(),
    };
  }
  let conteudo = "Olá! Eu sou o **LEX Licitações**. Antes de pensar em ETP, TR ou pesquisa de preço, eu vou entender exatamente o que você precisa contratar.\n\n**O que você precisa comprar ou contratar hoje?** Conte do seu jeito.";
  if (hasMemoria && memorias?.ug_preferida) conteudo += `\n\nÚltima UG usada: ${memorias.ug_preferida}.`;
  return { id: ID(), papel: "sistema", tipo: "pergunta", etapa: "intencao", conteudo, criadaEm: new Date().toISOString() };
}

/**
 * Processa a resposta do servidor e devolve a próxima mensagem do sistema.
 * `memorias` = preferências aprendidas do órgão.
 */
export async function responder(texto: string, estado: EstadoChat, memorias: Record<string, string>): Promise<{ mensagens: MensagemChat[]; estado: EstadoChat }> {
  const msg: MensagemChat[] = [];
  const t = (texto || "").trim().toLowerCase();

  switch (estado.etapa) {
    case "modo_guiado": {
      const guia = GUIAS_MODO[estado.modoSolicitado || ""];
      if (!guia) { estado.etapa = "intencao"; return responder(texto, estado, memorias); }
      const i = Math.max(0, Number(estado.modoIndice || 0));
      const atual = guia.perguntas[i];
      estado.modoRespostas = { ...(estado.modoRespostas || {}), [atual.chave]: (texto || "").trim() || "[NÃO INFORMADO]" };
      const prox = i + 1;
      if (prox < guia.perguntas.length) {
        estado.modoIndice = prox;
        const q = guia.perguntas[prox];
        msg.push({ id: ID(), papel: "sistema", tipo: "pergunta", etapa: "modo_guiado", conteudo: `**${q.pergunta}**\n\n_Por que preciso disso: ${q.motivo}_`, opcoes: q.opcoes, criadaEm: new Date().toISOString() });
        return { mensagens: msg, estado };
      }
      estado.etapa = "modo_concluido";
      const resumo = guia.perguntas.map(q => `- **${q.pergunta.replace(/\?$/, "")}:** ${estado.modoRespostas?.[q.chave] || "[NÃO INFORMADO]"}`).join("\n");
      msg.push({ id: ID(), papel: "sistema", tipo: "card", etapa: "modo_concluido", conteudo: `Fechei esta etapa de **${guia.titulo}**.\n\n${resumo}\n\nEscolha o próximo passo:`, opcoes: guia.proximos, criadaEm: new Date().toISOString() });
      return { mensagens: msg, estado };
    }

    case "modo_concluido": {
      const norm = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const e = norm(texto || "");
      const destinos: [string,string][] = [["planejar a contratacao","planejamento"],["definir o objeto","objeto"],["pesquisa de precos","pesquisa"],["preparar a licitacao","preparacao"],["selecionar o fornecedor","selecao"],["contrato e execucao","contrato"],["descobrir a necessidade","necessidade"]];
      const destino = destinos.find(([r]) => e.includes(r))?.[1];
      if (destino) {
        const guia = GUIAS_MODO[destino];
        estado.modoSolicitado = destino; estado.modoIndice = 0; estado.modoRespostas = {}; estado.etapa = "modo_guiado";
        const q = guia.perguntas[0];
        msg.push({ id: ID(), papel: "sistema", tipo: "card", etapa: "modo_guiado", conteudo: `**${guia.titulo}**\n\n${guia.abertura}\n\n**${q.pergunta}**\n\n_Por que estou perguntando: ${q.motivo}_`, opcoes: q.opcoes, criadaEm: new Date().toISOString() });
        return { mensagens: msg, estado };
      }
      const guia = GUIAS_MODO[estado.modoSolicitado || ""];
      msg.push({ id: ID(), papel: "sistema", tipo: "card", etapa: "modo_concluido", conteudo: "Escolha um dos próximos passos abaixo para continuar.", opcoes: guia?.proximos || ["Voltar aos procedimentos"], criadaEm: new Date().toISOString() });
      return { mensagens: msg, estado };
    }

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
        conteudo: " Contratação mapeada! Você pode **elaborar o edital**, **ver o painel** ou continuar conversando.",
        opcoes: [" Elaborar edital", " Ver painel", " Continuar conversando"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 1. INTENÇÃO ─────────────────────────────────────────────
    case "intencao": {
      const sugestoes = await detectarIntencao(texto);
      const melhor = sugestoes[0] || { nomeTipo: "Contratação pública" } as any;
      estado.objeto = texto.trim();
      estado.tipoProcesso = melhor.nomeTipo;
      estado.descoberta = await montarDNAObjeto(estado.objeto, estado.tipoProcesso, memorias);
      estado.etapa = "descoberta";

      const primeira = estado.descoberta.perguntas[0];
      const histQtd = Number(memorias.historico_qtd || 0);
      const notaHistorico = histQtd > 0
        ? `\n\n**Memória do órgão:** encontrei ${histQtd} processo(s) com objeto parecido. Vou usar como referência, sem copiar automaticamente decisões antigas.`
        : "";

      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "descoberta",
        conteudo: `Entendi a direção: **${estado.descoberta.familia}**.\n\nAntes de abrir documentos, vou **descobrir a contratação** com você.${notaHistorico}\n\n**${primeira.pergunta}**\n\n_Por que estou perguntando: ${primeira.motivo}_`,
        opcoes: primeira.opcoes,
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 1.5 DESCOBERTA DA CONTRATAÇÃO / DNA DO OBJETO ──────────
    case "descoberta": {
      const dna = estado.descoberta;
      if (!dna || !dna.perguntas.length) {
        estado.etapa = "ug";
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "ug",
          conteudo: "Já entendi a necessidade inicial. Agora, para identificar a unidade responsável pelo processo: **qual a Unidade Gestora (UG)?** Se não souber, seguimos e você informa depois.",
          opcoes: memorias.ug_preferida ? [`${memorias.ug_preferida} (da última vez)`, "Outra…", "Seguir sem UG por enquanto"] : ["Não sei o que é UG", "Seguir sem UG por enquanto"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      const atual = dna.perguntas[dna.indice];
      const resposta = (texto || "").trim();
      if (!resposta) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "descoberta",
          conteudo: `**${atual.pergunta}**\n\n_Por que preciso disso: ${atual.motivo}_`,
          opcoes: atual.opcoes,
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      const naoSabe = /^(não sei|nao sei|não tenho|nao tenho|ainda não sei|ainda nao sei|não definido|nao definido)$/i.test(resposta) || /ainda não (sei|defin)/i.test(resposta);
      dna.respostas[atual.chave] = naoSabe ? "[A DEFINIR]" : resposta;
      if (naoSabe && !dna.lacunas.includes(atual.chave)) dna.lacunas.push(atual.chave);

      estado.documentosGerados = {
        ...(estado.documentosGerados || {}),
        contratacao: { ...(estado.documentosGerados?.contratacao || {}), ...dna.respostas },
      };

      dna.indice += 1;
      const proxima = dna.perguntas[dna.indice];
      if (proxima) {
        const reconheceLacuna = naoSabe
          ? "Sem problema. Vou marcar isso como **a definir** e explicar o impacto antes de fechar o documento."
          : "Anotado. Isso já entrou no mapa da contratação.";
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "descoberta",
          conteudo: `${reconheceLacuna}\n\n**${proxima.pergunta}**\n\n_Por que estou perguntando: ${proxima.motivo}_`,
          opcoes: proxima.opcoes,
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      estado.etapa = "ug";
      const definidos = Object.values(dna.respostas).filter(v => v && v !== "[A DEFINIR]").length;
      const lacunasTxt = dna.lacunas.length
        ? `\n\n**Ainda precisamos confirmar:** ${dna.lacunas.join(", ")}. Não vou inventar essas informações; elas ficam sinalizadas para revisão.`
        : "\n\nAs definições essenciais desta primeira investigação foram respondidas.";
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "ug",
        conteudo: `Fechei o **primeiro mapa da contratação**: ${definidos} definição(ões) já estão estruturadas e serão reaproveitadas no DFD/Requisição, ETP e TR.${lacunasTxt}\n\nAgora entramos na parte formal. **Qual a Unidade Gestora (UG)?**\n*(Se não souber, seguimos e você informa depois.)*`,
        opcoes: memorias.ug_preferida ? [`${memorias.ug_preferida} (da última vez)`, "Outra…", "Seguir sem UG por enquanto"] : ["Não sei o que é UG", "Seguir sem UG por enquanto"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 2. UG ───────────────────────────────────────────────────
    case "ug": {
      if (t.includes("não sei") || t.includes("nao sei")) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "ug",
          conteudo: "Sem problema! A **UG (Unidade Gestora)** é a unidade administrativa que executa a despesa — geralmente aparece no CNPJ do órgão (ex.: 12.345.678/0001-90). Se preferir, seguimos e você informa depois — deixo como alerta .",
          opcoes: ["▶ Seguir sem UG por enquanto", "Vou informar agora"],
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
          conteudo: `UG **não informada**  (deixo como alerta — você informa depois).\n\nAgora vamos aos **documentos**, um de cada vez. Começando:\n\n **${FLUXO_DOCUMENTOS[0].nome}**\n\nVocê já tem? Se tiver o arquivo, **anexe aqui**  que eu identifico e sigo.`,
          opcoes: [" Já tenho", " Ainda não", " O que é isso?", " Anexar arquivo"],
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
          aviso = ` **Percebi que você colou outro conteúdo** (parece um documento ou o objeto da contratação).\n\nIsso aqui é o campo da **UG** — só o **código numérico** da Unidade Gestora (6 dígitos, ex.: **120001** ou 12.345.678/0001-90).\n\nO documento que você colou, guardo **mais adiante**, quando pedir os documentos do processo. `;
        } else if (respostaUG.length > 20) {
          aviso = ` Essa resposta parece **longa demais** para o campo da UG.\n\nA **UG** é só o **código numérico** da Unidade Gestora (ex.: **120001** ou o CNPJ do órgão).`;
        } else {
          aviso = ` **"${respostaUG.slice(0, 50)}"** não parece um código de UG.\n\nA **UG (Unidade Gestora)** é identificada por um **número de 6 dígitos** (ex.: **120001**) ou pelo **CNPJ** do órgão (ex.: 12.345.678/0001-90).\n\nPode conferir no SEI/processo ou perguntar ao setor financeiro.`;
        }
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "ug",
          conteudo: `${aviso}\n\n Qual a **UG** correta?`,
          opcoes: ["▶ Seguir sem UG por enquanto", "Não sei o que é UG"],
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
        conteudo: `UG anotada \n\nAgora vamos aos **documentos**, um de cada vez. Começando:\n\n **${FLUXO_DOCUMENTOS[0].nome}**\n\nVocê já tem? Se tiver o arquivo, **anexe aqui**  que eu identifico e sigo.`,
        opcoes: [" Já tenho", " Ainda não", " O que é isso?", " Anexar arquivo"],
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
          conteudo: `Documentos mapeados! \n\nAgora a **pesquisa de preços**. Seu órgão costuma usar **${memorias.fonte_preco || "PNCP"}**. Confirma que busco o valor estimado com as referências?`,
          opcoes: [" Sim, buscar no PNCP", " Quero definir outra fonte", " Explica como funciona"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      // BOTÃO "▶ Seguir mesmo assim" / "▶ Seguir": avança sem travar
      if (t.includes("seguir mesmo assim") || t.includes("▶ seguir") || t.includes("seguir")) {
        if (estado.documentos[doc.chave]?.status !== "ok") {
          estado.documentos[doc.chave] = { status: "falta", implicacao: doc.implicacao };
        }
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: ` Seguindo!  **${proximo.nome}** — você já tem?`,
            opcoes: [" Já tenho", " Ainda não", " O que é isso?", " Anexar arquivo"],
            criadaEm: new Date().toISOString(),
          });
        } else {
          estado.documentoAtual = undefined;
        }
        return { mensagens: msg, estado };
      }

      // BOTÃO " Quero resolver agora": pede o anexo
      if (t.includes("quero resolver agora") || t.includes("resolver agora")) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
          conteudo: `Perfeito! Vamos resolver o **${doc.nome}** agora.\n\nClique em **Anexar arquivo** para enviar o documento, ou use **${doc.chave === "etp" ? "Criar ETP Digital" : "Criar com modelo oficial"}** — eu aproveito os dados do processo e conduzo o restante.`,
          opcoes: [" Anexar arquivo", doc.chave === "etp" ? " Criar ETP Digital" : " Criar com modelo AGU", "▶ Seguir mesmo assim"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      // BOTÃO " Criar com modelo AGU": inicia a COLETA GUIADA de campos
      if (t.includes("criar com modelo agu") || t.includes("criar com o modelo") || t.includes("gerar modelo") || t.includes("criar etp digital")) {
        const camposDef = CAMPOS_DOCUMENTO[doc.chave] || [];
        // AGENTE REDATOR: herda campos já respondidos em documentos anteriores
        // (ex.: quantidade/unidade/prazo/local do PC são reutilizados no ETP)
        const anteriores = estado.documentosGerados || {};
        const camposHerdeiros: Record<string, string> = {};
        if (doc.chave === "etp") {
          const pc = anteriores.pc || {};
          const contratacao = anteriores.contratacao || {};
          try {
            const { prepararEtp } = await import("@/lib/etp-orchestrator");
            const prep = await prepararEtp({
              objeto: estado.objeto || pc.objeto || "",
              orgao: memorias.orgao_nome,
              ug: estado.ug,
              dfd: pc,
              contratacao,
            });
            Object.assign(camposHerdeiros, prep.campos);
            if (prep.apoios.parcelamento) camposHerdeiros._apoioParcelamento = prep.apoios.parcelamento;
            if (prep.apoios.impactosAmbientais) camposHerdeiros._apoioImpactosAmbientais = prep.apoios.impactosAmbientais;
            if (prep.apoios.correlatas) camposHerdeiros._apoioCorrelatas = prep.apoios.correlatas;
            camposHerdeiros._agentesEtp = prep.agentes.map(a => `${a.grupo}: ${a.papel}`).join(" | ");
            camposHerdeiros._fontesEtp = prep.fontes.join(" | ");
          } catch {
            // Fallback mínimo: preserva o que veio da DFD sem bloquear o servidor.
            if (pc.necessidade) camposHerdeiros.necessidade = pc.necessidade;
            if (pc.quantidade) camposHerdeiros.quantidade = pc.quantidade;
            if (pc.justificativaQuantitativo) camposHerdeiros.justificativaQuantitativo = pc.justificativaQuantitativo;
            if (pc.resultado) camposHerdeiros.resultadosPretendidos = pc.resultado;
            if (pc.alinhamentoPlanejamento) camposHerdeiros.alinhamentoPlanejamento = pc.alinhamentoPlanejamento;
            if (contratacao.requisitosTecnicos || pc.requisitosTecnicos) camposHerdeiros.requisitosContratacao = contratacao.requisitosTecnicos || pc.requisitosTecnicos;
          }
        }
        const ordemFiltrada = camposDef.filter(c => {
          const pendente = (v: unknown) => /^\s*\[(?:A CONFIRMAR|A DEFINIR|A VERIFICAR|LEVANTAMENTO PENDENTE|ESTIMATIVA PENDENTE|MEMÓRIA DE CÁLCULO A COMPLEMENTAR|A VALIDAR|VIABILIDADE A CONCLUIR)/i.test(String(v || ""));
          const direto = camposHerdeiros[c.chave];
          if (String(direto || "").trim() && !pendente(direto)) return false;

          const valor = Object.values(anteriores).map(d => d[c.chave]).find(Boolean);
          if (valor) {
            camposHerdeiros[c.chave] = valor;
            if (!pendente(valor)) return false;
          }
          return true;
        });
        estado.docColeta = {
          docChave: doc.chave,
          campos: camposHerdeiros,
          ordem: ordemFiltrada.map(c => c.chave),
        };
        estado.etapa = "coleta_doc";
        const primeiro = ordemFiltrada[0];
        const herdou = Object.keys(camposHerdeiros).some(k => !k.startsWith("_apoio"));
        const apoioPrimeiro = doc.chave === "etp" && primeiro?.chave === "parcelamento" ? camposHerdeiros._apoioParcelamento
          : doc.chave === "etp" && primeiro?.chave === "impactosAmbientais" ? camposHerdeiros._apoioImpactosAmbientais
          : doc.chave === "etp" && primeiro?.chave === "correlatas" ? camposHerdeiros._apoioCorrelatas : "";
        const rotuloModelo = doc.chave === "etp" ? "ETP Digital / Compras.gov (IN SEGES 58/2022)" : "modelo oficial";
        msg.push({
          id: ID(), papel: "sistema", tipo: "card", etapa: "coleta_doc",
          conteudo: ` **${doc.nome}** — vamos montar pelo **${rotuloModelo}**, sem repetir o que o LEX já sabe.${herdou ? `\n\n**O LEX já reaproveitou ou pesquisou ${Object.entries(camposHerdeiros).filter(([k, v]) => !k.startsWith("_apoio") && String(v || "").trim()).length} elementos deste ETP.**${camposHerdeiros.levantamentoMercado ? " Levantamento de mercado preparado." : ""}${camposHerdeiros.estimativaValor ? " Estimativa de valor aproveitada/pesquisada." : ""} Restam **${ordemFiltrada.length} pontos** que dependem de confirmação ou decisão do órgão.` : ""}\n\n${ordemFiltrada.length === 0 ? "Todos os campos necessários já estão preenchidos! Gerando o documento…" : `${primeiro.grupo ? `**Bloco: ${primeiro.grupo}**\n` : ""}${primeiro.fundamento ? `Base: ${primeiro.fundamento}\n\n` : ""}**Pergunta 1/${ordemFiltrada.length}:** ${primeiro.pergunta}\n\n${primeiro.explicacao}${apoioPrimeiro ? `\n\n**Análise preliminar do LEX para você confirmar:**\n${apoioPrimeiro}` : ""}\n\n*(responda do seu jeito ou escolha uma opção; o LEX aproveita o restante automaticamente)*`}`,
          opcoes: ordemFiltrada.length === 0 ? [] : [...(primeiro.opcoes || []), "⏭ Pular por enquanto"],
          criadaEm: new Date().toISOString(),
        });
        // Se todos os campos foram herdados, gera direto (sem perguntar)
        if (ordemFiltrada.length === 0) {
          const r = await responder("", estado, memorias);
          return { mensagens: [...msg, ...r.mensagens], estado: r.estado };
        }
        return { mensagens: msg, estado };
      }

      if (t.includes("anexei") || t.includes("anexei o documento") || t.includes("sim") || t.includes("já tenho") || t.includes("tenho") || t.includes("anexar")) {
        estado.documentos[doc.chave] = { status: "ok", anexadoEm: new Date().toISOString() };
        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "documentos",
          conteudo: ` **${doc.nome}** recebido! Pode anexar o arquivo aqui  se quiser.`,
          opcoes: [" Anexar arquivo", "▶ Seguir"],
          criadaEm: new Date().toISOString(),
        });
        // Avança automaticamente para o próximo documento
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: ` **${proximo.nome}** — você já tem?`,
            opcoes: [" Já tenho", " Ainda não", " O que é isso?", " Anexar arquivo"],
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
          conteudo: ` **Alerta:** sem ${doc.nome.toLowerCase()} — ${doc.implicacao}\n\n**Não vou travar** — escolha uma opção para continuar:\n\n **${doc.nome}** — o que fazer?`,
          opcoes: [doc.chave === "etp" ? " Criar ETP Digital" : " Criar com modelo AGU", " Anexar arquivo", "▶ Seguir mesmo assim", " Quero resolver agora"],
          criadaEm: new Date().toISOString(),
        });
        // NÃO avança — espera a escolha do servidor (criar/anexar/pular)
        return { mensagens: msg, estado };
      }

      if (t.includes("o que é") || t.includes("o que e") || t.includes("não sei o que")) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "documentos",
          conteudo: ` **${doc.nome}** — o que é:\n\n${explicarDocumento(doc.chave)}\n\nTem um modelo pronto se precisar!`,
          opcoes: [" Gerar/baixar modelo", " Já entendi, tenho", " Ainda não tenho"],
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
          conteudo: ` **${doc.nome}** registrado! (${resposta.slice(0, 100)})`,
          opcoes: [" Anexar arquivo", "▶ Seguir"],
          criadaEm: new Date().toISOString(),
        });
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: ` **${proximo.nome}** — você já tem?`,
            opcoes: [" Já tenho", " Ainda não", " O que é isso?", " Anexar arquivo"],
            criadaEm: new Date().toISOString(),
          });
        } else estado.documentoAtual = undefined;
        return { mensagens: msg, estado };
      }
      if (intencao === "negar") {
        estado.documentos[doc.chave] = { status: "falta", implicacao: doc.implicacao };
        msg.push({
          id: ID(), papel: "sistema", tipo: "alerta", etapa: "documentos",
          conteudo: ` **Alerta:** sem ${doc.nome.toLowerCase()} — ${doc.implicacao}\n\n**Não vou travar** — escolha uma opção para continuar:`,
          opcoes: ["▶ Seguir mesmo assim", " Quero resolver agora", " Anexar arquivo"],
          criadaEm: new Date().toISOString(),
        });
        const proximo = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc) + 1];
        if (proximo) {
          estado.documentoAtual = proximo.chave;
          msg.push({
            id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
            conteudo: ` **${proximo.nome}** — você já tem?`,
            opcoes: [" Já tenho", " Ainda não", " O que é isso?", " Anexar arquivo"],
            criadaEm: new Date().toISOString(),
          });
        } else estado.documentoAtual = undefined;
        return { mensagens: msg, estado };
      }
      if (intencao === "explicar") {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "documentos",
          conteudo: ` **${doc.nome}** — o que é:\n\n${explicarDocumento(doc.chave)}\n\nTem um modelo pronto se precisar!`,
          opcoes: [" Gerar/baixar modelo", " Já entendi, tenho", " Ainda não tenho"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      // "informar" — o servidor deu uma informação extra; reconhece e pergunta de novo
      // de forma amigável (não é loop: a resposta foi absorvida)
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
        conteudo: `Anotado! (${resposta.slice(0, 120)})\n\n **${doc.nome}** — você já tem?`,
        opcoes: [" Já tenho", " Ainda não", " O que é isso?", " Anexar arquivo"],
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
      const campoPendente = (v: unknown) => /^\s*\[(?:A CONFIRMAR|A DEFINIR|A VERIFICAR|LEVANTAMENTO PENDENTE|ESTIMATIVA PENDENTE|MEMÓRIA DE CÁLCULO A COMPLEMENTAR|A VALIDAR|VIABILIDADE A CONCLUIR|ANÁLISE DE PARCELAMENTO PENDENTE)/i.test(String(v || ""));
      if (campoAtual && (!String(coleta.campos[campoAtual] || "").trim() || campoPendente(coleta.campos[campoAtual]))) {
        const invalida = validarCampoColeta(campoAtual, resposta);
        if (invalida) {
          msg.push({
            id: ID(), papel: "sistema", tipo: "texto", etapa: "coleta_doc",
            conteudo: `${invalida}\n\n **${campoDef?.pergunta}**\n\n ${campoDef?.explicacao}`,
            opcoes: [...(campoDef?.opcoes || []), "⏭ Pular (usar padrão)"],
            criadaEm: new Date().toISOString(),
          });
          return { mensagens: msg, estado };
        }
        if (coleta.docChave === "etp" && campoAtual === "levantamentoMercado" && /pesquis|automatic/i.test(resposta)) {
          try {
            const { levantarMercadoEtp } = await import("@/lib/etp-intelligence");
            coleta.campos[campoAtual] = await levantarMercadoEtp(estado.objeto || "");
          } catch { coleta.campos[campoAtual] = "[LEVANTAMENTO PENDENTE] Não foi possível concluir a consulta automática agora; complementar antes da conclusão."; }
        } else if (coleta.docChave === "etp" && campoAtual === "estimativaValor" && /pesquisa|oficial|lex/i.test(resposta)) {
          try {
            const { estimarValorEtp } = await import("@/lib/etp-intelligence");
            const pc = estado.documentosGerados?.pc || {};
            coleta.campos[campoAtual] = await estimarValorEtp({ objeto: estado.objeto || "", quantidade: coleta.campos.quantidade || pc.quantidade, unidade: pc.unidade, local: pc.localEntrega, contexto: { ...(estado.documentosGerados?.contratacao || {}), ...pc, ...coleta.campos } });
          } catch { coleta.campos[campoAtual] = "[ESTIMATIVA PENDENTE] A pesquisa automática não pôde ser concluída; revisar no módulo Pesquisa de preço."; }
        } else if (coleta.docChave === "etp" && campoAtual === "parcelamento" && /lex analise|lex analisar|analise|analisar/i.test(resposta)) {
          try { const { analisarParcelamentoEtp } = await import("@/lib/etp-intelligence"); coleta.campos[campoAtual] = await analisarParcelamentoEtp(estado.objeto || "", coleta.campos); }
          catch { coleta.campos[campoAtual] = "[ANÁLISE DE PARCELAMENTO PENDENTE] Confirmar divisibilidade técnica, competitividade, integração e economia de escala."; }
        } else if (coleta.docChave === "etp" && campoAtual === "correlatas" && /procur|hist[oó]ric/i.test(resposta)) {
          try { const { buscarCorrelatasEtp } = await import("@/lib/etp-intelligence"); coleta.campos[campoAtual] = await buscarCorrelatasEtp(estado.objeto || ""); }
          catch { coleta.campos[campoAtual] = "[A VERIFICAR] Não foi possível concluir a busca no histórico interno agora."; }
        } else if (coleta.docChave === "etp" && campoAtual === "impactosAmbientais" && /lex sugira|sugir|validar/i.test(resposta)) {
          try { const { sugerirImpactosEtp } = await import("@/lib/etp-intelligence"); coleta.campos[campoAtual] = await sugerirImpactosEtp(estado.objeto || ""); }
          catch { coleta.campos[campoAtual] = "[A VALIDAR] Avaliar impactos ambientais e medidas mitigadoras aplicáveis ao objeto."; }
        } else if (coleta.docChave === "etp" && campoAtual === "viabilidade" && /lex.*an[aá]lis|an[aá]lise conclusiva|fa[cç]a a an[aá]lise/i.test(resposta)) {
          try { const { analisarViabilidadeEtp } = await import("@/lib/etp-intelligence"); coleta.campos[campoAtual] = await analisarViabilidadeEtp(estado.objeto || "", coleta.campos); }
          catch { coleta.campos[campoAtual] = "[VIABILIDADE A CONCLUIR] Revisar os elementos obrigatórios e condicionantes antes da declaração final."; }
        } else if (/pular|padrão|padrao/i.test(resposta)) {
          coleta.campos[campoAtual] = ""; // padrão
        } else if (campoAtual === "riscos" && /sim|sugira/i.test(resposta)) {
          coleta.campos[campoAtual] = "Riscos típicos: atraso na execução (mitigação: cronograma e sanções), superfaturamento (mitigação: pesquisa com 3+ referências), descumprimento contratual (mitigação: garantia e penalidades), interrupção do serviço (mitigação: cláusula de continuidade).";
        } else if (campoAtual === "alternativas" && /não sei|nao sei|duvida/i.test(resposta)) {
          coleta.campos[campoAtual] = "Considerou-se a contratação de terceiros como alternativa mais adequada, frente às alternativas de quadro próprio (inviável) e aditivo contratual (inexistente).";
        } else if (campoAtual === "valorEstimado" && /não sei|nao sei|pesquisa|deixa|automaticamente|fontes oficiais/i.test(resposta)) {
          coleta.campos[campoAtual] = "PESQUISAR_AUTOMATICAMENTE";
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
        const apoioProximo = coleta.docChave === "etp" && proximoCampo === "parcelamento" ? coleta.campos._apoioParcelamento
          : coleta.docChave === "etp" && proximoCampo === "impactosAmbientais" ? coleta.campos._apoioImpactosAmbientais
          : coleta.docChave === "etp" && proximoCampo === "correlatas" ? coleta.campos._apoioCorrelatas : "";
        const respondidosVisiveis = Object.keys(coleta.campos).filter(k => !k.startsWith("_apoio") && String(coleta.campos[k] || "").trim()).length;
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "coleta_doc",
          conteudo: `Anotado. O LEX já tem **${respondidosVisiveis} elemento(s)** deste documento.\n\n${proxDef?.grupo ? `**Bloco: ${proxDef.grupo}**\n` : ""}${proxDef?.fundamento ? `Base: ${proxDef.fundamento}\n\n` : ""}**Próxima pergunta:** ${proxDef?.pergunta}\n\n${proxDef?.explicacao}${apoioProximo ? `\n\n**Análise preliminar do LEX para você confirmar:**\n${apoioProximo}` : ""}`,
          opcoes: [...(proxDef?.opcoes || []), "⏭ Pular por enquanto"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }

      // 3. TODOS os campos coletados → gera o documento completo com IA
      estado.etapa = "documentos";
      estado.documentos[coleta.docChave] = { status: "ok", anexadoEm: new Date().toISOString() };
      const doc = FLUXO_DOCUMENTOS.find(d => d.chave === coleta.docChave);
      const nomeArquivo = coleta.docChave === "pc" ? "DFD / REQUISIÇÃO DE COMPRA" : coleta.docChave === "etp" ? "ESTUDO TÉCNICO PRELIMINAR (ETP)" : "TERMO DE REFERÊNCIA (TR)";
      const camposTexto = Object.entries(coleta.campos)
        .filter(([k]) => !k.startsWith("_"))
        .map(([k, v]) => `${k}: ${v || "[A DEFINIR]"}`).join("\n");
      const dadosDescobertaTexto = Object.entries(estado.documentosGerados?.contratacao || {})
        .map(([k, v]) => `${k}: ${v || "[A DEFINIR]"}`).join("\n");
      try {
        const { chat } = await import("@/lib/ia");
        let enriquecimento: any = null;

        // O DFD já nasce com CATMAT/CATSER + estimativa preliminar pesquisada.
        // A pesquisa externa enriquece o documento, mas nunca inventa fato interno do órgão.
        if (coleta.docChave === "pc") {
          try {
            const { enriquecerDFD } = await import("@/lib/dfd-intelligence");
            enriquecimento = await enriquecerDFD({
              objeto: estado.objeto || coleta.campos.objeto || "",
              quantidade: coleta.campos.quantidade,
              unidade: coleta.campos.unidade,
              localEntrega: coleta.campos.localEntrega,
              dadosContexto: { ...(estado.documentosGerados?.contratacao || {}), ...coleta.campos },
            });

            if (enriquecimento?.catalogo) {
              coleta.campos.catmatCodigo = String(enriquecimento.catalogo.codigo);
              coleta.campos.catmatDescricao = enriquecimento.catalogo.descricao;
              coleta.campos.catmatPdm = enriquecimento.catalogo.pdm ? String(enriquecimento.catalogo.pdm) : "";
            }
            if (enriquecimento?.estimativa) {
              coleta.campos.estimativaPesquisadaUnitario = String(enriquecimento.estimativa.valorUnitario);
              coleta.campos.estimativaPesquisadaTotal = enriquecimento.estimativa.valorTotal != null ? String(enriquecimento.estimativa.valorTotal) : "";
              coleta.campos.fonteEstimativa = enriquecimento.estimativa.fontePrincipal;
            }
          } catch {
            // A indisponibilidade de uma fonte não impede a DFD: vira lacuna explícita.
          }
        }

        const dadosAnterioresTexto = Object.entries(estado.documentosGerados || {})
          .filter(([k]) => k !== "contratacao")
          .map(([k, vals]) => `${k}: ${Object.entries(vals || {}).map(([ck, cv]) => `${ck}=${cv}`).join("; ")}`)
          .join("\n");

        const instrucaoDfd = coleta.docChave === "pc" ? `

Para o DFD/REQUISIÇÃO, produza uma peça COMPLETA, pronta para revisão administrativa, com esta estrutura mínima quando aplicável:
1. IDENTIFICAÇÃO DA DEMANDA E UNIDADE REQUISITANTE.
2. CONTEXTO E DESCRIÇÃO DA NECESSIDADE: situação atual e problema concreto que se pretende resolver.
3. RESULTADO ESPERADO E UNIDADES/PÚBLICO ATENDIDOS.
4. DESCRIÇÃO DO OBJETO.
5. ITENS E CLASSIFICAÇÃO: informar expressamente o número do CATMAT/CATSER sugerido e a DESCRIÇÃO OFICIAL retornada pela fonte. Se a classificação não tiver alta confiança, registrar que depende de confirmação técnica.
6. QUANTITATIVO E MEMÓRIA DO DIMENSIONAMENTO: quantidade, unidade e justificativa de como o número foi obtido; nunca inventar memória de consumo.
7. ESTIMATIVA PRELIMINAR DE VALOR: valor unitário e, se houver quantidade válida, valor total; método, número de referências, média, mediana, mínimo, máximo, fonte e data/hora da consulta. Diferenciar preços unitários comparáveis de valores totais de editais/contratações do PNCP. NUNCA transformar valor total do PNCP em preço unitário.
8. JUSTIFICATIVA DA NECESSIDADE: desenvolver de forma robusta e específica o problema atual, evidências internas informadas, impacto de não contratar, benefícios e resultados esperados, adequação do quantitativo, prioridade/urgência, continuidade do serviço quando aplicável, economicidade e coerência com a solução pretendida. A fundamentação deve demonstrar a necessidade com fatos fornecidos pelo servidor; não preencher ausência de prova com frases genéricas.
9. ALINHAMENTO AO PLANEJAMENTO/PCA: somente afirmar previsão no PCA/plano se isso tiver sido informado. Sem confirmação, registrar [A CONFIRMAR] e indicar a providência necessária.
10. PRAZO E LOCAL DE ENTREGA/EXECUÇÃO.
11. FONTES E EVIDÊNCIAS CONSULTADAS: listar referências de preços, identificadores/links PNCP disponíveis e data da consulta.
12. LACUNAS, VALIDAÇÕES E PROVIDÊNCIAS PENDENTES.

Referências de TCU podem apoiar governança, planejamento e motivação quando forem realmente pertinentes, mas não comprovam fatos internos do órgão. Diferencie claramente: (a) fato informado pela unidade; (b) inferência técnica; (c) referência externa de controle.` : "";
        const instrucaoEtp = coleta.docChave === "etp" ? `

Para o ESTUDO TÉCNICO PRELIMINAR, produza o documento COMPLETO conforme a Lei 14.133/2021 e a IN SEGES 58/2022. Organize o documento obrigatoriamente em EXATAMENTE estes seis títulos principais, nesta ordem:
1. INFORMAÇÕES BÁSICAS
2. NECESSIDADE
3. SOLUÇÃO
4. PLANEJAMENTO
5. VIABILIDADE
6. ANEXOS
Dentro deles, distribua todos os elementos materiais do art. 9º sem omissão. Não crie um sétimo bloco principal.

${guiaEtpParaIA()}

REGRAS:
- demonstre o problema e avalie a melhor solução; não justifique retrospectivamente uma escolha já feita;
- reaproveite DFD, CATMAT/CATSER, quantitativo, estimativa pesquisada, histórico e dados confirmados;
- levantamento de mercado deve comparar alternativas reais; se ainda não pesquisado, use [LEVANTAMENTO PENDENTE];
- quantidade precisa de memória de cálculo e suporte; se faltar, use [MEMÓRIA DE CÁLCULO A COMPLEMENTAR];
- estimativa deve separar preço unitário, quantidade e total e indicar fontes; nunca trate valor total de edital como preço unitário;
- parcelamento deve analisar divisibilidade técnica, competitividade, integração e economia de escala;
- só afirme previsão em PCA/PLS/outro plano se houver confirmação;
- resultados pretendidos devem ser mensuráveis quando possível;
- impactos ambientais conforme aplicabilidade, sem inventar fatos;
- a viabilidade deve decorrer dos elementos anteriores e registrar condicionantes;
- elementos não obrigatórios não tratados devem receber justificativa objetiva;
- o documento deve vir INTEIRO, substancial, com anexos/evidências referenciados ao final.` : "";

        let conteudo: string;
        if (coleta.docChave === "etp") {
          const { gerarEtpCompleto } = await import("@/lib/etp-orchestrator");
          const camposEtp = Object.fromEntries(Object.entries(coleta.campos).filter(([k]) => !k.startsWith("_"))) as Record<string,string>;
          const gerado = await gerarEtpCompleto({
            objeto: estado.objeto || "não informado",
            orgao: memorias.orgao_nome || "não informado",
            ug: estado.ug || "não informada",
            campos: camposEtp,
            dadosAnteriores: estado.documentosGerados || {},
          });
          conteudo = gerado.documento;
          if (!gerado.validacao.seisBlocos || !gerado.validacao.terminaComAnexos) {
            throw new Error("ETP gerado sem todos os seis blocos obrigatórios");
          }
        } else {
          conteudo = await chat([
          { role: "system", content: `Você é o LEX Licitações, arquiteto de contratações públicas especializado na Lei 14.133/2021. Escreva o documento oficial "${nomeArquivo}" INTEIRO e COMPLETO, em português, com linguagem formal administrativa. NÃO produza resumo, amostra ou prévia. Reaproveite os dados descobertos na conversa e os campos específicos do documento. NÃO invente quantidade, dimensão, prazo, preço, requisito técnico, vínculo ao PCA, evidência, responsabilidade ou fato do órgão. Quando um dado essencial não estiver definido, escreva [A DEFINIR] ou [A CONFIRMAR] e explique objetivamente o que precisa ser validado. O documento deve nascer da necessidade investigada, e não de texto genérico.${instrucaoDfd}${instrucaoEtp}` },
          { role: "user", content: `Objeto: ${estado.objeto || "não informado"}
UG: ${estado.ug || "não informada"}
Órgão: ${memorias.orgao_nome || "não informado"}

DNA / dados descobertos na conversa:
${dadosDescobertaTexto || "nenhum"}

Campos específicos deste documento:
${Object.entries(coleta.campos).filter(([k]) => !k.startsWith("_")).map(([k, v]) => `${k}: ${v || "[A DEFINIR]"}`).join("\n")}

Dados herdados de documentos anteriores:
${dadosAnterioresTexto || "nenhum"}

ENRIQUECIMENTO OFICIAL PARA O DFD (use somente estes dados; não invente complemento factual):
${enriquecimento ? JSON.stringify(enriquecimento, null, 2) : "indisponível — registrar as lacunas"}` },
        ], coleta.docChave === "pc" ? 0.22 : coleta.docChave === "etp" ? 0.25 : 0.35, coleta.docChave === "pc" ? 5200 : coleta.docChave === "etp" ? 6500 : 4200);
        }

        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "documentos",
          conteudo: ` **${doc?.nome} GERADO completo:**\n\n${conteudo}\n\n **Documento inteiro exibido acima.** Você também pode baixar ou editar por seção.`,
          completo: conteudo,
          criadaEm: new Date().toISOString(),
        });
      } catch {
        msg.push({
          id: ID(), papel: "sistema", tipo: "documento", etapa: "documentos",
          conteudo: ` **${doc?.nome}** gerado! (IA indisponível — use o modelo oficial disponível na jornada do processo.)`,
          criadaEm: new Date().toISOString(),
        });
      }
      // AGENTE REDATOR: guarda os campos coletados para encadear no próximo documento
      estado.documentosGerados = {
        ...(estado.documentosGerados || {}),
        [coleta.docChave]: { ...coleta.campos },
      };
      // Avança para o próximo documento
      const proximoDoc = FLUXO_DOCUMENTOS[FLUXO_DOCUMENTOS.indexOf(doc!) + 1];
      if (proximoDoc) {
        estado.documentoAtual = proximoDoc.chave;
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "documentos",
          conteudo: ` **${proximoDoc.nome}** — você já tem? Se não, posso **${proximoDoc.chave === "etp" ? "criar pelo ETP Digital / Compras.gov" : "criar com o modelo oficial"}** e conduzir campo por campo.`,
          opcoes: [" Já tenho", " Ainda não", proximoDoc.chave === "etp" ? " Criar ETP Digital" : " Criar com modelo AGU", " Anexar arquivo"],
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
          opcoes: [" Usar a sugestão do sistema", " Informar a minha", " O que é dotação?"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      if (t.includes("explica")) {
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "pesquisa",
          conteudo: " **Pesquisa de preços**: levantamos o valor de mercado do objeto com pelo menos 3 fontes (PNCP, Painel de Preços, contratos). A **média** vira o valor estimado da licitação — é o que garante que o preço é justo.",
          opcoes: [" Entendi, buscar no PNCP", " Outra fonte"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "pesquisa",
        conteudo: `Busco a pesquisa no **${memorias.fonte_preco || "PNCP"}**?`,
        opcoes: [" Sim", " Outra fonte", " Explica", "▶ Seguir com PNCP"],
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
          conteudo: " Usei a classificação mais provável para o objeto (função/subfunção/natureza). **Valide com a unidade de orçamento** antes de empenhar — eu já deixo anotado no processo.",
          criadaEm: new Date().toISOString(),
        });
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "minuta",
          conteudo: `Quase lá!  Agora a **minuta do edital/TR**. Quer que eu **gere com IA** (preencho com os dados do processo + julgados de apoio) ou você prefere um **modelo da AGU**?`,
          opcoes: [" Gerar com IA", " Modelo AGU", " Tenho minha própria minuta"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "dotacao",
        conteudo: "E a **dotação orçamentária**? Usa a sugestão ou informa a sua?",
        opcoes: [" Sugestão do sistema", " Informar a minha", "▶ Seguir com a sugestão"],
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
          conteudo: " **Minuta gerada com IA** — preenchi com o objeto, dotação sugerida e julgados de apoio. Está salva como rascunho no processo. Você pode editar antes de usar!",
          criadaEm: new Date().toISOString(),
        });
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "juridico",
          conteudo: "Última etapa: **análise jurídica** . Vai encaminhar para a Assessoria Jurídica?",
          opcoes: [" Sim, vou encaminhar", " Seguir sem por enquanto"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      if (t.includes("agu") || t.includes("modelo")) {
        estado.etapa = "juridico";
        msg.push({
          id: ID(), papel: "sistema", tipo: "texto", etapa: "minuta",
          conteudo: " **Modelo AGU** selecionado — está na seção de modelos do processo, pronto para preencher com 1 clique.",
          criadaEm: new Date().toISOString(),
        });
        msg.push({
          id: ID(), papel: "sistema", tipo: "pergunta", etapa: "juridico",
          conteudo: "Última etapa: **análise jurídica** . Vai encaminhar para a Assessoria?",
          opcoes: [" Sim", " Seguir sem"],
          criadaEm: new Date().toISOString(),
        });
        return { mensagens: msg, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "minuta",
        conteudo: "Como prefere a **minuta**?",
        opcoes: [" Gerar com IA", " Modelo AGU", " Tenho a minha", "▶ Seguir com IA"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 7. JURÍDICO → FINALIZAÇÃO ──────────────────────────────
    case "juridico": {
      estado.etapa = "finalizado";
      const faltas = FLUXO_DOCUMENTOS.filter(d => estado.documentos[d.chave]?.status === "falta");
      let resumo = " **Contratação mapeada!** Aqui está o resumo:\n\n";
      resumo += ` **Objeto:** ${estado.objeto || "—"}\n`;
      resumo += ` **Tipo:** ${estado.tipoProcesso || "—"}\n`;
      resumo += ` **UG:** ${estado.ug || "não informada "}\n`;
      resumo += ` **Documentos:** ${FLUXO_DOCUMENTOS.filter(d => estado.documentos[d.chave]?.status === "ok").length}/${FLUXO_DOCUMENTOS.length} OK\n`;
      if (faltas.length) {
        resumo += `\n **Faltam:** ${faltas.map(d => d.nome).join(", ")}`;
      }
      resumo += `\n\n**Próximo passo:**  **elaborar o EDITAL** com o CATMAT provável!`;
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "finalizado",
        conteudo: resumo,
        opcoes: [" Elaborar edital", " Ver painel", " Continuar conversando"],
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
          conteudo: ` **Minuta pronta (gerada com IA):**\n\n${minuta.slice(0, 1800)}${minuta.length > 1800 ? "…" : ""}`,
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
          catTexto = `\n\n **Código(s) provável(eis) encontrado(s):**\n${r.itens.map((i, n) => `${n + 1}. ${i.tipo} **${i.codigo}** — ${i.descricao.slice(0, 70)}`).join("\n")}`;
        } else {
          catTexto = "\n\n Não encontrei o código exato no catálogo. Posso **sugerir com IA** — ou você informa o código que conhece.";
        }
      } catch {
        catTexto = "\n\n Não consegui consultar o catálogo agora. Posso **sugerir com IA** — ou você informa o código.";
      }

      if (t.includes("elaborar") || t.includes("edital") || t.includes("sim") || t.includes("gerar")) {
        // Pergunta o CATMAT antes de gerar (com opção de sugerir)
        msg.push({
          id: ID(), papel: "sistema", tipo: "card", etapa: "edital",
          conteudo: ` **Edital** — vamos elaborar!\n\n**CATMAT/CATSER provável para o objeto:**\n${estado.catmat || "a consultar…"}${catTexto}\n\n Se tiver **dúvida sobre o código**, eu **sugiro o mais provável** com base no objeto.`,
          opcoes: [" Sugerir o código com IA", " Vou informar o código", "▶ Seguir com o provável"],
          criadaEm: new Date().toISOString(),
        });
        estado.etapa = "edital_catmat";
        return { mensagens: msg, estado };
      }
      msg.push({
        id: ID(), papel: "sistema", tipo: "pergunta", etapa: "edital",
        conteudo: "Quer **elaborar o edital** com o CATMAT provável?",
        opcoes: [" Sim, elaborar edital", " Ver painel", " Continuar conversando"],
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
        conteudo: ` **EDITAL ELABORADO**\n\n**CATMAT/CATSER:** ${codigo}\n\n${edital ? edital.slice(0, 2000) + (edital.length > 2000 ? "…" : "") : "Não consegui gerar o edital agora. Use os modelos AGU na jornada do processo."}`,
        completo: `EDITAL DE LICITAÇÃO\nCATMAT/CATSER: ${codigo}\n\n${edital || ""}`,   // edital INTEIRO
        opcoes: [" Baixar edital", " Editar edital", " Ver painel"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    // ── 10. EDITAL PRONTO (final) ───────────────────────────────
    case "edital_pronto": {
      msg.push({
        id: ID(), papel: "sistema", tipo: "card", etapa: "edital_pronto",
        conteudo: " **Edital elaborado!** Você pode **baixar** e **editar** — e na jornada do processo encontra tudo salvo (minuta + edital + julgados + dotação).",
        opcoes: [" Baixar edital", " Editar edital", " Ver painel"],
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
    }

    default:
      msg.push({
        id: ID(), papel: "sistema", tipo: "texto",
        conteudo: "Pode me contar mais? Digite o que você precisa ou anexe um documento ",
        criadaEm: new Date().toISOString(),
      });
      return { mensagens: msg, estado };
  }
}

/** Explicação amigável de cada documento (para quem nunca fez). */
function explicarDocumento(chave: string): string {
  const expl: Record<string, string> = {
    pc: "O **DFD / Requisição de Compra** registra a necessidade do setor requisitante. No LEX ele começa a nascer durante a conversa, usando o que já foi descoberto sobre o problema, o objeto e o quantitativo.",
    etp: "O **Estudo Técnico Preliminar (ETP)** organiza o problema, as alternativas, a solução, os quantitativos e os riscos. No LEX ele reaproveita o DNA do objeto e destaca o que ainda precisa ser confirmado.",
    tr: "O **Termo de Referência (TR)** transforma a solução escolhida em regras claras de execução: escopo, requisitos, responsabilidades, medição, prazos e condições. Ele deve usar as definições já consolidadas no DFD e no ETP.",
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
        return ` **"${resposta.slice(0, 50)}"** não tem um número.\n\nA **quantidade** precisa de um número (ex.: **2** profissionais, **500** resmas, **10** licenças).`;
      }
      if (/pedido de compra|etp|edital|contrato|termo de referência|preciso|quero/i.test(t)) {
        return ` Isso parece um **documento**, não uma quantidade.\n\nAqui quero saber **quantos/quantas** do objeto (ex.: **2** profissionais, **500** resmas).`;
      }
      return null;
    case "unidade":
      const unidades = ["unidade", "un", "mês", "mes", "resma", "kg", "m²", "m2", "hora", "h", "dia", "serviço", "servico", "pacote", "caixa", "cx", "par", "lote"];
      if (resposta.length > 20 && !unidades.some(u => t.includes(u))) {
        return ` **"${resposta.slice(0, 50)}"** não parece uma **unidade de medida**.\n\nUnidades comuns: **unidade, mês, resma, kg, m², hora, caixa**...`;
      }
      return null;
    case "prazo":
      if (!/\d/.test(resposta) && !/dias|meses|mês|ano|semana|semanal/i.test(t)) {
        return ` **"${resposta.slice(0, 50)}"** não parece um **prazo**.\n\nPrazo precisa de número + período (ex.: **30 dias**, **12 meses**).`;
      }
      return null;
    case "valorEstimado":
      if (resposta.length > 0 && !/\d/.test(resposta) && !/pesquisa|pncp|definir|não sei|nao sei/i.test(t)) {
        return ` **"${resposta.slice(0, 50)}"** não parece um **valor**.\n\nPode digitar um valor (ex.: **45.000,00**) ou responder **"deixa a pesquisa definir"**.`;
      }
      return null;
    default:
      return null;
  }
}
