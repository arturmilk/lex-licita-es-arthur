import { db } from "./index";
import { baseConhecimento } from "./schema";
import { eq, isNull } from "drizzle-orm";

const ART23 = {
  titulo: "Lei 14.133/2021 — Art. 23 (Pesquisa de preços e valor estimado)",
  categoria: "norma",
  conteudo: `Art. 23. O valor previamente estimado da contratação deverá ser compatível com os valores praticados pelo mercado, considerados os preços constantes de bancos de dados públicos e as quantidades a serem contratadas, observadas a potencial economia de escala e as peculiaridades do local de execução do objeto.

§ 1º No processo licitatório para a contratação de bens e serviços que possam ser fornecidos por empresas com ou sem compromisso de entrega, o valor estimado da contratação poderá ser obtido a partir de, no mínimo, 3 (três) preços de mercado, por meio da utilização dos seguintes parâmetros:
I - composição de custos unitários menores ou iguais à mediana do item correspondente no painel para consulta de preços ou no banco de preços em saúde disponíveis no Portal Nacional de Contratações Públicas (PNCP);
II - contratações similares feitas pela Administração Pública, em execução ou concluídas no período de 1 (um) ano anterior à data da pesquisa de preços, observado o índice de atualização de preços correspondente;
III - utilização de dados de pesquisa publicada em mídia especializada, de sítios eletrônicos especializados ou de domínio amplo, desde que contenha a data e hora de acesso;
IV - pesquisa direta com, no mínimo, 3 (três) fornecedores, mediante solicitação formal de cotação, desde que seja apresentada justificativa da escolha desses fornecedores e que os orçamentos não tenham sido obtidos com mais de 6 (seis) meses de antecedência da data de divulgação do edital;
V - pesquisa na base nacional de notas fiscais eletrônicas, desde que a data das notas fiscais esteja compreendida no período de até 1 (um) ano anterior à data de divulgação do edital, conforme disposto no regulamento.

§ 2º O disposto no inciso II do § 1º deste artigo poderá ser utilizado para a comprovação da compatibilidade dos preços praticados no mercado, ainda que as contratações não tenham sido concluídas, desde que não tenha havido êxito na utilização do disposto no inciso I do § 1º deste artigo, desde que haja documento hábil que comprove a proposta mais vantajosa.

§ 3º Nas contratações realizadas com base nos incisos I e II do caput do art. 75 desta Lei, a estimativa de preços poderá ser feita concomitantemente à seleção da proposta economicamente mais vantajosa.

§ 4º Nas contratações de obras e serviços de engenharia, o valor estimado, acrescido do percentual de benefícios e despesas indiretas (BDI), será obtido a partir da composição de custos unitários menores ou iguais à mediana do item correspondente do Sistema Nacional de Pesquisa de Custos e Índices da Construção Civil (Sinapi) ou de sistemas de custos adotados pela Administração Pública Federal, desde que demonstrado que os valores não ultrapassam os praticados pelo mercado.`,
  fonte: "Lei 14.133/2021",
  tags: ["art. 23", "pesquisa de preços", "valor estimado", "parâmetros", "mediana", "3 preços"],
};

async function main() {
  const existentes = await db.select().from(baseConhecimento).where(eq(baseConhecimento.titulo, ART23.titulo));
  if (existentes.length > 0) {
    console.log("Art. 23 já existe na base.");
    process.exit(0);
  }
  await db.insert(baseConhecimento).values({ orgaoId: null, ...ART23 });
  console.log("Art. 23 da Lei 14.133/2021 inserido na base de conhecimento!");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
