import { db } from "./index";
import { tiposProcesso, etapasProcesso, baseConhecimento } from "./schema";
import { orgaos } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Seed do sistema orientado à intenção.
 * Cria os tipos de processo com checklists automáticos de documentos,
 * etapas e validações + base de conhecimento inicial.
 */

interface EtapaSeed {
  titulo: string;
  instrucao: string;
  documentosNecessarios: string[];
  camposObrigatorios: string[];
  validacoes: Record<string, unknown>[];
  responsavel?: string;
}

const FLUXOS: { nome: string; descricao: string; etapas: EtapaSeed[] }[] = [
  {
    nome: "Contratação de bens",
    descricao: "Aquisição de bens (material de consumo, equipamentos) via licitação ou dispensa.",
    etapas: [
      {
        titulo: "Demanda e justificativa",
        instrucao: "Registre o que será contratado, a quantidade e a razão da necessidade. Anexe a solicitação do setor demandante.",
        documentosNecessarios: ["Solicitação do setor demandante", "Justificativa da contratação"],
        camposObrigatorios: ["objeto", "quantidade", "unidade", "justificativa"],
        validacoes: [{ tipo: "campo", alvo: "objeto", mensagem: "Informe o objeto da contratação." }],
      },
      {
        titulo: "Pesquisa de preços",
        instrucao: "Pesquise preços de mercado (PNCP, fornecedores, compras.gov) e anexe as referências aceitas.",
        documentosNecessarios: ["Pesquisa de preços (mín. 3 referências)", "Memória de cálculo"],
        camposObrigatorios: ["metodoCalculo", "valorEstimado"],
        validacoes: [
          { tipo: "documento", alvo: "Pesquisa de preços (mín. 3 referências)", mensagem: "Anexe ao menos 3 referências de preço." },
          { tipo: "campo", alvo: "valorEstimado", mensagem: "Informe o valor estimado." },
        ],
      },
      {
        titulo: "Verificação de disponibilidade orçamentária",
        instrucao: "Confirme se há dotação orçamentária para a despesa e anexe a nota de empenho/declaração.",
        documentosNecessarios: ["Declaração de disponibilidade orçamentária"],
        camposObrigatorios: ["dotacaoOrcamentaria"],
        validacoes: [{ tipo: "documento", alvo: "Declaração de disponibilidade orçamentária", mensagem: "Anexe a declaração de dotação." }],
      },
      {
        titulo: "Minuta do edital/termo de referência",
        instrucao: "Prepare o termo de referência ou minuta de edital com especificações técnicas. Use os modelos do sistema.",
        documentosNecessarios: ["Termo de referência", "Minuta de edital"],
        camposObrigatorios: ["especificacoes", "condicoesPagamento"],
        validacoes: [{ tipo: "documento", alvo: "Termo de referência", mensagem: "Anexe o termo de referência." }],
      },
      {
        titulo: "Análise jurídica",
        instrucao: "Encaminhe o processo para a assessoria jurídica emitir parecer.",
        documentosNecessarios: ["Parecer jurídico"],
        camposObrigatorios: [],
        validacoes: [{ tipo: "assinatura", alvo: "Parecer jurídico", mensagem: "O parecer jurídico precisa estar assinado." }],
        responsavel: "juridico",
      },
      {
        titulo: "Publicação e abertura",
        instrucao: "Publique o aviso no Diário Oficial e no PNCP, e defina data de abertura das propostas.",
        documentosNecessarios: ["Comprovante de publicação", "Aviso de licitação"],
        camposObrigatorios: ["dataAbertura", "modalidade"],
        validacoes: [{ tipo: "data", alvo: "dataAbertura", mensagem: "Defina a data de abertura." }],
      },
      {
        titulo: "Homologação e contratação",
        instrucao: "Após a fase recursal, homologue o resultado e assine o contrato.",
        documentosNecessarios: ["Termo de homologação", "Contrato assinado", "Publicação do resultado"],
        camposObrigatorios: [],
        validacoes: [{ tipo: "assinatura", alvo: "Contrato assinado", mensagem: "O contrato precisa estar assinado." }],
      },
    ],
  },
  {
    nome: "Dispensa de licitação (baixo valor)",
    descricao: "Contratação direta por dispensa (art. 75, II — bens até R$ 50 mil).",
    etapas: [
      {
        titulo: "Demanda e enquadramento legal",
        instrucao: "Descreva o objeto e confirme o enquadramento na hipótese de dispensa (art. 75, II da Lei 14.133/2021).",
        documentosNecessarios: ["Solicitação do setor demandante", "Fundamentação legal da dispensa"],
        camposObrigatorios: ["objeto", "fundamentacaoLegal"],
        validacoes: [{ tipo: "campo", alvo: "fundamentacaoLegal", mensagem: "Indique o dispositivo legal da dispensa." }],
      },
      {
        titulo: "Pesquisa de preços (3 cotações)",
        instrucao: "Obtenha 3 cotações de fornecedores distintos e registre os valores.",
        documentosNecessarios: ["Cotações de fornecedores (mín. 3)"],
        camposObrigatorios: ["valorEstimado"],
        validacoes: [{ tipo: "documento", alvo: "Cotações de fornecedores (mín. 3)", mensagem: "Anexe ao menos 3 cotações." }],
      },
      {
        titulo: "Parecer jurídico",
        instrucao: "Encaminhe ao jurídico para parecer de legalidade.",
        documentosNecessarios: ["Parecer jurídico"],
        camposObrigatorios: [],
        validacoes: [{ tipo: "assinatura", alvo: "Parecer jurídico", mensagem: "Parecer jurídico assinado é obrigatório." }],
        responsavel: "juridico",
      },
      {
        titulo: "Ratificação e publicação",
        instrucao: "Ratifique a dispensa pela autoridade competente e publique o extrato.",
        documentosNecessarios: ["Termo de ratificação", "Comprovante de publicação"],
        camposObrigatorios: [],
        validacoes: [{ tipo: "assinatura", alvo: "Termo de ratificação", mensagem: "O termo de ratificação precisa de assinatura." }],
        responsavel: "autoridade",
      },
    ],
  },
  {
    nome: "Diárias e passagens",
    descricao: "Concessão de diárias e passagens para viagem a serviço.",
    etapas: [
      {
        titulo: "Solicitação de afastamento",
        instrucao: "Registre o motivo da viagem, destino, datas e finalidade. Anexe a solicitação.",
        documentosNecessarios: ["Solicitação de afastamento"],
        camposObrigatorios: ["destino", "dataInicio", "dataFim", "motivo"],
        validacoes: [{ tipo: "campo", alvo: "motivo", mensagem: "Informe o motivo da viagem." }],
      },
      {
        titulo: "Aprovação da chefia",
        instrucao: "Encaminhe para aprovação da chefia imediata.",
        documentosNecessarios: ["Aprovação da chefia"],
        camposObrigatorios: [],
        validacoes: [{ tipo: "assinatura", alvo: "Aprovação da chefia", mensagem: "Aprovação assinada é obrigatória." }],
        responsavel: "chefia",
      },
      {
        titulo: "Cálculo e emissão de diárias",
        instrucao: "Calcule o valor das diárias conforme tabela e emita a ordem de pagamento.",
        documentosNecessarios: ["Cálculo de diárias", "Ordem de pagamento"],
        camposObrigatorios: ["valorDiarias"],
        validacoes: [{ tipo: "campo", alvo: "valorDiarias", mensagem: "Informe o valor das diárias." }],
      },
      {
        titulo: "Prestação de contas",
        instrucao: "Após o retorno, o servidor deve apresentar a prestação de contas em até 5 dias úteis.",
        documentosNecessarios: ["Prestação de contas", "Comprovantes de despesas"],
        camposObrigatorios: [],
        validacoes: [{ tipo: "documento", alvo: "Prestação de contas", mensagem: "A prestação de contas é obrigatória." }],
      },
    ],
  },
  {
    nome: "Licença e afastamento do servidor",
    descricao: "Licença para tratamento de saúde, licença-maternidade/paternidade, capacitação etc.",
    etapas: [
      {
        titulo: "Pedido do servidor",
        instrucao: "Registre o tipo de licença e o período solicitado.",
        documentosNecessarios: ["Requerimento do servidor", "Atestado/laudo médico (quando aplicável)"],
        camposObrigatorios: ["tipoLicenca", "dataInicio", "dataFim"],
        validacoes: [{ tipo: "campo", alvo: "tipoLicenca", mensagem: "Informe o tipo de licença." }],
      },
      {
        titulo: "Análise e despacho da chefia",
        instrucao: "A chefia analisa o pedido e emite despacho.",
        documentosNecessarios: ["Despacho da chefia"],
        camposObrigatorios: [],
        validacoes: [{ tipo: "assinatura", alvo: "Despacho da chefia", mensagem: "Despacho assinado é obrigatório." }],
        responsavel: "chefia",
      },
      {
        titulo: "Registro no sistema de pessoal",
        instrucao: "Registre a licença no sistema de gestão de pessoas do órgão.",
        documentosNecessarios: ["Comprovante de registro"],
        camposObrigatorios: [],
        validacoes: [{ tipo: "documento", alvo: "Comprovante de registro", mensagem: "Anexe o comprovante de registro." }],
        responsavel: "rh",
      },
    ],
  },
];

const BASE_CONHECIMENTO = [
  {
    titulo: "Lei 14.133/2021 — Licitações e Contratos",
    categoria: "norma",
    conteudo: "Nova Lei de Licitações. Prazos mínimos: convite 3 dias úteis; concorrência 25 dias (melhor técnica/técnica e preço) ou 35 dias (maior desconto). Dispensa art. 75 (bens até R$ 50 mil, obras até R$ 100 mil). Limite de aceitabilidade: rejeitar propostas manifestamente inexequíveis ou com preço acima do parâmetro (art. 23, §1º).",
    fonte: "Lei 14.133/2021",
    tags: ["licitação", "lei", "prazo", "dispensa"],
  },
  {
    titulo: "Lei 14.133/2021 — Art. 23 (Pesquisa de preços e valor estimado)",
    categoria: "norma",
    conteudo: "Art. 23. O valor previamente estimado da contratação deverá ser compatível com os valores praticados pelo mercado, considerados os preços constantes de bancos de dados públicos e as quantidades a serem contratadas, observadas a potencial economia de escala e as peculiaridades do local de execução do objeto.\n\n§ 1º No processo licitatório para a contratação de bens e serviços que possam ser fornecidos por empresas com ou sem compromisso de entrega, o valor estimado da contratação poderá ser obtido a partir de, no mínimo, 3 (três) preços de mercado, por meio da utilização dos seguintes parâmetros:\nI - composição de custos unitários menores ou iguais à mediana do item correspondente no painel para consulta de preços ou no banco de preços em saúde disponíveis no Portal Nacional de Contratações Públicas (PNCP);\nII - contratações similares feitas pela Administração Pública, em execução ou concluídas no período de 1 (um) ano anterior à data da pesquisa de preços, observado o índice de atualização de preços correspondente;\nIII - utilização de dados de pesquisa publicada em mídia especializada, de sítios eletrônicos especializados ou de domínio amplo, desde que contenha a data e hora de acesso;\nIV - pesquisa direta com, no mínimo, 3 (três) fornecedores, mediante solicitação formal de cotação, desde que seja apresentada justificativa da escolha desses fornecedores e que os orçamentos não tenham sido obtidos com mais de 6 (seis) meses de antecedência da data de divulgação do edital;\nV - pesquisa na base nacional de notas fiscais eletrônicas, desde que a data das notas fiscais esteja compreendida no período de até 1 (um) ano anterior à data de divulgação do edital, conforme disposto no regulamento.\n\n§ 2º O disposto no inciso II do § 1º deste artigo poderá ser utilizado para a comprovação da compatibilidade dos preços praticados no mercado, ainda que as contratações não tenham sido concluídas, desde que não tenha havido êxito na utilização do disposto no inciso I do § 1º deste artigo, desde que haja documento hábil que comprove a proposta mais vantajosa.\n\n§ 3º Nas contratações realizadas com base nos incisos I e II do caput do art. 75 desta Lei, a estimativa de preços poderá ser feita concomitantemente à seleção da proposta economicamente mais vantajosa.\n\n§ 4º Nas contratações de obras e serviços de engenharia, o valor estimado, acrescido do percentual de benefícios e despesas indiretas (BDI), será obtido a partir da composição de custos unitários menores ou iguais à mediana do item correspondente do Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil (Sinapi) ou de sistemas de custos adotados pela Administração Pública Federal, desde que demonstrado que os valores não ultrapassam os praticados pelo mercado.",
    fonte: "Lei 14.133/2021",
    tags: ["art. 23", "pesquisa de preços", "valor estimado", "parâmetros", "mediana", "3 preços"],
  },
  {
    titulo: "LC 123/2006 — ME/EPP",
    categoria: "norma",
    conteudo: "Reserva de 25% para ME/EPP em licitações de até R$ 80 mil para bens/serviços comuns. Exclusividade para ME/EPP até R$ 80 mil. Art. 48 e 49.",
    fonte: "LC 123/2006",
    tags: ["me", "epp", "reserva", "exclusividade"],
  },
  {
    titulo: "Prazo de prestação de contas de diárias",
    categoria: "regra_interna",
    conteudo: "O servidor deve apresentar a prestação de contas de diárias em até 5 dias úteis após o retorno da viagem. Atraso gera desconto em folha.",
    fonte: "Instrução Normativa interna",
    tags: ["diárias", "prestação de contas", "prazo"],
  },
  {
    titulo: "Pesquisa de preços — como fazer",
    categoria: "procedimento",
    conteudo: "Passos: 1) definir objeto e especificações; 2) pesquisar no PNCP, compras.gov e fornecedores; 3) obter no mínimo 3 referências; 4) calcular média/mediana; 5) verificar CV (dispersão) — se acima de 20%, usar critério conservador; 6) registrar memória de cálculo.",
    fonte: "Manual de Pesquisa de Preços",
    tags: ["pesquisa", "preços", "PNCP", "procedimento"],
  },
  {
    titulo: "Estrutura do processo de contratação",
    categoria: "procedimento",
    conteudo: "Ordem típica: demanda → justificativa → pesquisa de preços → disponibilidade orçamentária → termo de referência/edital → parecer jurídico → publicação → julgamento → homologação → contrato.",
    fonte: "Guia interno de contratações",
    tags: ["contratação", "processo", "etapas"],
  },
];

async function seed() {
  console.log("Seeding sistema orientado à intenção...");

  const [orgao] = await db.select({ id: orgaos.id }).from(orgaos).limit(1);

  for (const fluxo of FLUXOS) {
    const [tipo] = await db
      .insert(tiposProcesso)
      .values({ nome: fluxo.nome, descricao: fluxo.descricao, orgaoId: orgao?.id ?? null })
      .onConflictDoNothing()
      .returning();
    if (!tipo) continue;

    await db.insert(etapasProcesso).values(
      fluxo.etapas.map((e, i) => ({
        tipoProcessoId: tipo.id,
        ordem: i + 1,
        titulo: e.titulo,
        instrucao: e.instrucao,
        documentosNecessarios: e.documentosNecessarios,
        camposObrigatorios: e.camposObrigatorios,
        validacoes: e.validacoes,
        responsavel: e.responsavel ?? "servidor",
      })),
    );
    console.log(`  + Tipo: ${fluxo.nome} (${fluxo.etapas.length} etapas)`);
  }

  for (const item of BASE_CONHECIMENTO) {
    await db
      .insert(baseConhecimento)
      .values({ orgaoId: orgao?.id ?? null, ...item })
      .onConflictDoNothing();
  }
  console.log(`  + Base de conhecimento: ${BASE_CONHECIMENTO.length} itens`);

  console.log("Seed orientado à intenção concluído!");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
