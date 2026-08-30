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
    nome: "Estudo Técnico Preliminar — ETP (AGU 14.133)",
    categoria: "etp",
    origem: "agu",
    descricao: "Modelo de Estudo Técnico Preliminar conforme AGU — Lei 14.133/2021 (art. 18)",
    campos: ["objeto", "numeroProcesso", "justificativa", "julgados", "data"],
    conteudoTemplate: `ESTUDO TÉCNICO PRELIMINAR (ETP)
PROCESSO ADMINISTRATIVO Nº {{numeroProcesso}}

1. DESCRIÇÃO DA NECESSIDADE
1.1. A presente contratação atende à necessidade de: {{objeto}}.

2. REQUISITOS DA CONTRATAÇÃO
2.1. Os requisitos necessários ao atendimento da necessidade são: qualidade, regularidade e conformidade com as especificações, conforme detalhado no Termo de Referência.

3. ESTIMATIVA DAS QUANTIDADES
3.1. As quantidades estimadas baseiam-se no histórico de consumo da unidade e na demanda informada pelo setor requisitante.

4. LEVANTAMENTO DE MERCADO
4.1. Realizada pesquisa de preços com fontes oficiais (PNCP, Painel de Preços, contratações similares), conforme documentação anexa.

5. JUSTIFICATIVA DA ESCOLHA DA SOLUÇÃO
5.1. {{justificativa}}
5.2. A solução escolhida apresenta melhor relação custo-benefício e adequação à necessidade, conforme análise de alternativas no processo.

6. ANÁLISE DE RISCOS
6.1. Os principais riscos identificados e as medidas de mitigação:
- Risco de atraso na entrega/execução → cláusulas de sanções e cronograma no edital;
- Risco de superfaturamento → pesquisa de preços com mínimo de 3 referências;
- Risco de descumprimento contratual → garantia e penalidades previstas em edital.

7. RESULTADOS ESPERADOS
7.1. Espera-se a continuidade e qualidade do serviço/bem, com preço justo e aderência à legislação.

8. JULGADOS DE APOIO (parâmetro de fundamentação)
8.1. {{julgados}}

{{data}}`,
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
