/**
 * Seed de modelos de documentos (AGU — Lei 14.133/2021) com campos
 * auto-preenchíveis via placeholders: {{objeto}}, {{numeroProcesso}},
 * {{dotacao}}, {{modalidade}}, {{justificativa}}, {{julgados}}, {{data}}...
 *
 * Estrutura baseada nos modelos oficiais da AGU (gov.br/agu), adaptados
 * para preenchimento assistido com dados do processo.
 */
import { db } from "./index";
import { modelosDocumento } from "./schema";
import { eq } from "drizzle-orm";

const MODELOS = [
  {
    nome: "Pedido de Compra (AGU 14.133)",
    categoria: "pedido_compra",
    origem: "agu",
    descricao: "Modelo de Pedido de Compra conforme AGU — Lei 14.133/2021 (Documento de Formalização de Demanda)",
    campos: ["objeto", "numeroProcesso", "justificativa", "quantidade", "unidade", "data"],
    conteudoTemplate: `PEDIDO DE COMPRA Nº ____/2026
PROCESSO ADMINISTRATIVO Nº {{numeroProcesso}}

1. SOLICITANTE
1.1. Órgão/Unidade: {{orgao}}
1.2. Unidade Gestora: {{ug}}

2. DO OBJETO DO PEDIDO
2.1. {{objeto}}
2.2. Quantidade: {{quantidade}} {{unidade}}

3. DA JUSTIFICATIVA
3.1. {{justificativa}}

4. DA DISPONIBILIDADE ORÇAMENTÁRIA
4.1. Dotação orçamentária: {{dotacao}}

5. DO ENCAMINHAMENTO
5.1. O presente pedido segue para análise e autorização da autoridade competente.

{{data}}`,
  },
  {
    nome: "ETP Digital — Compras.gov / IN SEGES 58/2022",
    categoria: "etp",
    origem: "comprasgov",
    descricao: "Estrutura do ETP Digital atualizada para a Lei 14.133/2021 e IN SEGES 58/2022, organizada em seis blocos de trabalho.",
    campos: ["objeto", "numeroProcesso", "orgao", "responsavel", "data"],
    conteudoTemplate: `ESTUDO TÉCNICO PRELIMINAR — ETP
PROCESSO ADMINISTRATIVO Nº {{numeroProcesso}}
ÓRGÃO: {{orgao}}
OBJETO EM ESTUDO: {{objeto}}

1. INFORMAÇÕES BÁSICAS
1.1. Área requisitante: [A CONFIRMAR]
1.2. Área técnica/equipe de planejamento, quando houver: [A CONFIRMAR]
1.3. Responsáveis pela elaboração/revisão: {{responsavel}}

2. NECESSIDADE
2.1. Descrição da necessidade sob a perspectiva do interesse público: [A DESENVOLVER COM BASE NA DFD E EVIDÊNCIAS]
2.2. Requisitos necessários e suficientes da contratação: [A DEFINIR/VALIDAR]

3. SOLUÇÃO
3.1. Levantamento de mercado e alternativas analisadas: [LEVANTAMENTO PENDENTE]
3.2. Justificativa técnica e econômica da solução escolhida: [A DESENVOLVER APÓS O LEVANTAMENTO]
3.3. Descrição da solução como um todo, incluindo manutenção e assistência técnica quando aplicável: [A DEFINIR]
3.4. Estimativa das quantidades e memória de cálculo: [A COMPLEMENTAR COM DADOS E DOCUMENTOS DE SUPORTE]
3.5. Estimativa do valor, preços unitários referenciais e memória de cálculo: [A PREENCHER A PARTIR DA PESQUISA DE PREÇOS]
3.6. Justificativa para o parcelamento ou não da solução: [A ANALISAR]
3.7. Contratações correlatas e/ou interdependentes: [A VERIFICAR]

4. PLANEJAMENTO
4.1. Alinhamento com PCA, PLS e demais instrumentos de planejamento: [A CONFIRMAR]
4.2. Resultados pretendidos: [A DEFINIR EM TERMOS DE ECONOMICIDADE/EFICIÊNCIA/EFICÁCIA]
4.3. Providências prévias à contratação: [A VERIFICAR]
4.4. Impactos ambientais e medidas mitigadoras, quando aplicáveis: [A VERIFICAR]

5. VIABILIDADE
5.1. Posicionamento conclusivo sobre a adequação e viabilidade da contratação: [A CONCLUIR COM BASE NOS ELEMENTOS DO ESTUDO]

6. ANEXOS E EVIDÊNCIAS
6.1. DFD e documentos da necessidade.
6.2. Memória de cálculo do quantitativo.
6.3. Pesquisa de preços, preços unitários e memória de cálculo do valor.
6.4. CATMAT/CATSER e especificações usadas na pesquisa, quando aplicáveis.
6.5. ETPs/contratações semelhantes consultados no levantamento de mercado.
6.6. Relatórios, inventários, laudos, cotações e demais documentos de suporte.

Referência normativa: Lei nº 14.133/2021 e IN SEGES nº 58/2022.
Data: {{data}}`,
  },
  {
    nome: "Edital de Pregão Eletrônico (AGU 14.133)",
    categoria: "edital",
    origem: "agu",
    descricao: "Modelo de edital de pregão eletrônico conforme AGU — Lei 14.133/2021",
    campos: ["objeto", "numeroProcesso", "modalidade", "dotacao", "justificativa", "julgados", "data"],
    conteudoTemplate: `EDITAL DE PREGÃO ELETRÔNICO Nº ____/2026

PROCESSO ADMINISTRATIVO Nº {{numeroProcesso}}

O órgão solicitante, por intermédio do Pregoeiro e Equipe de Apoio, no uso de suas atribuições legais, torna público que realizará licitação na modalidade PREGÃO, na forma ELETRÔNICA, do tipo MENOR PREÇO, regida pela Lei nº 14.133/2021 e legislação correlata.

1. DO OBJETO
1.1. A presente licitação tem por objeto: {{objeto}}.

2. DA JUSTIFICATIVA
2.1. {{justificativa}}
2.2. A despesa correrá à conta da dotação orçamentária: {{dotacao}}.

3. DA FUNDAMENTAÇÃO E JULGADOS DE APOIO
3.1. A contratação observa os seguintes julgados como parâmetro de apoio:
{{julgados}}

4. DAS CONDIÇÕES DE PARTICIPAÇÃO
4.1. Poderão participar desta licitação os interessados que atendam às exigências deste Edital e seus anexos.

5. DA ABERTURA DAS PROPOSTAS
5.1. A sessão pública será realizada em data a ser divulgada no Portal Nacional de Contratações Públicas (PNCP).

6. DO CRITÉRIO DE JULGAMENTO
6.1. O julgamento das propostas observará o critério de MENOR PREÇO, conforme disposto no art. 33 da Lei nº 14.133/2021.

Brasília/UF, {{data}}.`,
  },
  {
    nome: "Termo de Referência (AGU 14.133)",
    categoria: "termo_referencia",
    origem: "agu",
    descricao: "Modelo de Termo de Referência conforme AGU — Lei 14.133/2021",
    campos: ["objeto", "numeroProcesso", "dotacao", "justificativa", "julgados", "data"],
    conteudoTemplate: `TERMO DE REFERÊNCIA
PROCESSO ADMINISTRATIVO Nº {{numeroProcesso}}

1. OBJETO
1.1. Contratação de: {{objeto}}.

2. JUSTIFICATIVA DA CONTRATAÇÃO
2.1. {{justificativa}}

3. DESCRIÇÃO DA SOLUÇÃO E ESPECIFICAÇÕES
3.1. As especificações técnicas detalhadas constam do Anexo I deste Termo de Referência.

4. REQUISITOS DA CONTRATAÇÃO
4.1. O contratado deverá atender integralmente às especificações e condições estabelecidas neste Termo de Referência e no Edital.

5. ESTIMATIVA DE PREÇOS E DOTAÇÃO
5.1. O custo estimado da contratação será suportado pela dotação orçamentária: {{dotacao}}.

6. JULGADOS DE APOIO (parâmetro de fundamentação)
6.1. {{julgados}}

7. PRAZO E CONDIÇÕES DE EXECUÇÃO
7.1. O prazo de execução será definido no instrumento convocatório.

Brasília/UF, {{data}}.`,
  },
  {
    nome: "Ata de Registro de Preços (AGU 14.133)",
    categoria: "ata",
    origem: "agu",
    descricao: "Modelo de Ata de Registro de Preços conforme AGU — Lei 14.133/2021",
    campos: ["objeto", "numeroProcesso", "modalidade", "julgados", "data"],
    conteudoTemplate: `ATA DE REGISTRO DE PREÇOS Nº ____/2026
PROCESSO ADMINISTRATIVO Nº {{numeroProcesso}}

Aos ____ dias do mês de ________ de 2026, o órgão solicitante, em decorrência da licitação na modalidade {{modalidade}}, RESOLVE registrar os preços para futura e eventual contratação de: {{objeto}}.

1. DO OBJETO E DOS PREÇOS REGISTRADOS
1.1. Os preços registrados constam do Anexo I desta Ata, conforme propostas vencedoras.

2. DA VIGÊNCIA
2.1. Esta Ata terá vigência de 12 (doze) meses, contados da sua publicação.

3. DA ASSINATURA
3.1. Assinam a presente Ata o órgão gerenciador e as empresas participantes.

4. FUNDAMENTAÇÃO
4.1. {{julgados}}

Brasília/UF, {{data}}.`,
  },
  {
    nome: "Contrato de Serviços com Dedicação Exclusiva de Mão de Obra (AGU 14.133)",
    categoria: "contrato",
    origem: "agu",
    descricao: "Modelo de contrato de serviços com mão de obra exclusiva conforme AGU — Lei 14.133/2021",
    campos: ["objeto", "numeroProcesso", "dotacao", "julgados", "data"],
    conteudoTemplate: `CONTRATO Nº ____/2026
PROCESSO ADMINISTRATIVO Nº {{numeroProcesso}}

CONTRATO DE PRESTAÇÃO DE SERVIÇOS COM DEDICAÇÃO EXCLUSIVA DE MÃO DE OBRA QUE ENTRE SI CELEBRAM O ÓRGÃO SOLICITANTE E A CONTRATADA.

CLÁUSULA PRIMEIRA — DO OBJETO
1.1. O presente contrato tem por objeto: {{objeto}}.

CLÁUSULA SEGUNDA — DA DOTAÇÃO ORÇAMENTÁRIA
2.1. As despesas decorrentes deste contrato correrão à conta da dotação: {{dotacao}}.

CLÁUSULA TERCEIRA — DA VIGÊNCIA
3.1. O prazo de vigência será de ____ meses, contados da assinatura.

CLÁUSULA QUARTA — DA FUNDAMENTAÇÃO
4.1. O presente contrato fundamenta-se na Lei nº 14.133/2021 e nos seguintes julgados de apoio:
{{julgados}}

E, por estarem justos e contratados, firmam o presente instrumento em 2 (duas) vias de igual teor.

Brasília/UF, {{data}}.`,
  },
  {
    nome: "Lista de Verificação — Compras e Serviços (AGU 14.133)",
    categoria: "lista_verificacao",
    origem: "agu",
    descricao: "Checklist de verificação para compras e serviços sem mão de obra exclusiva — AGU 14.133",
    campos: ["objeto", "numeroProcesso", "data"],
    conteudoTemplate: `LISTA DE VERIFICAÇÃO — COMPRAS E SERVIÇOS
PROCESSO ADMINISTRATIVO Nº {{numeroProcesso}}
OBJETO: {{objeto}}

[ ] 1. Demanda formalizada pelo setor requisitante (Documento de Formalização de Demanda — DFD)
[ ] 2. Estudo Técnico Preliminar (ETP) elaborado e aprovado
[ ] 3. Termo de Referência/Projeto Básico elaborado
[ ] 4. Pesquisa de preços realizada com mínimo de 3 (três) referências
[ ] 5. Análise crítica da pesquisa de preços e justificativa dos valores
[ ] 6. Dotação orçamentária identificada e disponível
[ ] 7. Análise jurídica emitida pela Assessoria Jurídica
[ ] 8. Autorização da autoridade competente
[ ] 9. Publicação do aviso no PNCP e no Diário Oficial
[ ] 10. Sessão pública de abertura das propostas realizada
[ ] 11. Julgamento das propostas e habilitação dos licitantes
[ ] 12. Adjudicação e homologação
[ ] 13. Assinatura do contrato e publicação do extrato

Responsável: {{responsavel}}
Data: {{data}}`,
  },
];

async function main() {
  const existentes = await db.select().from(modelosDocumento).where(eq(modelosDocumento.origem, "agu"));
  let criados = 0;
  for (const m of MODELOS) {
    const jaExiste = existentes.some((e) => e.nome === m.nome);
    if (jaExiste) continue;
    await db.insert(modelosDocumento).values({ ...m, ativo: true });
    criados++;
  }
  console.log(`Modelos AGU: ${criados > 0 ? criados + " criados" : "nenhum novo"} (total ${MODELOS.length})`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
