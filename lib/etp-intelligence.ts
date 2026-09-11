import { auth } from "@/auth";
import { db } from "@/lib/db";
import { processos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

function norm(s:string){ return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }
function tokens(s:string){ const stop=new Set(["para","como","uma","com","sem","que","dos","das","por","pela","pelo","contratacao","aquisicao","servico","servicos"]); return new Set(norm(s).replace(/[^a-z0-9]+/g," ").split(/\s+/).filter(x=>x.length>=4&&!stop.has(x))); }
function brl(v:number|null|undefined){ return v==null||!Number.isFinite(v)?"N/A":new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v); }

export async function levantarMercadoEtp(objeto:string){
  const { buscarTodasFontes } = await import("@/lib/sources");
  const resultados = await buscarTodasFontes(["pncp","precos_abertos","contratos_govbr"], { termo: objeto, tamanhoPagina: 12 });
  const refs = resultados.flatMap(r => (r.items||[]).slice(0,5).map(i=>({ fonte:r.fonte, orgao:i.orgao, descricao:i.descricao, valorUnitario:i.valorUnitario, valorTotal:i.valorTotal, data:i.dataContrato, local:i.localizacao, documento:i.documentoOrigem, link:i.linkEdital, similaridade:i.similaridade })))
    .sort((a,b)=>(b.similaridade||0)-(a.similaridade||0)).slice(0,12);
  if(!refs.length) return "[LEVANTAMENTO PENDENTE] As fontes públicas consultadas não retornaram referências suficientes. Complementar com ETPs/contratações semelhantes, consulta ao mercado ou outras fontes adequadas antes da conclusão.";
  const { chat } = await import("@/lib/ia");
  return chat([
    {role:"system",content:`Você é o módulo de Levantamento de Mercado do LEX. Com base SOMENTE nas referências reais fornecidas, escreva um levantamento preliminar para ETP sob a IN SEGES 58/2022. Identifique padrões de solução, formas de fornecimento/execução e alternativas efetivamente observáveis nos dados. Compare tecnicamente/economicamente quando houver base. Não invente fornecedor, tecnologia, preço ou alternativa. Diferencie fatos observados de pontos ainda a validar. Termine com "Lacunas para validação" quando necessário. Texto administrativo, 5 a 9 parágrafos.`},
    {role:"user",content:`OBJETO: ${objeto}\nREFERÊNCIAS DE MERCADO:\n${JSON.stringify(refs,null,2)}`}
  ],0.2,2200);
}

export async function estimarValorEtp(opts:{objeto:string;quantidade?:string;unidade?:string;local?:string;contexto?:Record<string,string>}){
  const { enriquecerDFD } = await import("@/lib/dfd-intelligence");
  const r = await enriquecerDFD({objeto:opts.objeto,quantidade:opts.quantidade,unidade:opts.unidade,localEntrega:opts.local,dadosContexto:opts.contexto||{}});
  if(!r.estimativa) return "[ESTIMATIVA PENDENTE] Não foram obtidas referências unitárias comparáveis suficientes nas fontes consultadas. Realizar/complementar a pesquisa de preços antes da conclusão do ETP.";
  const e=r.estimativa;
  const amostra=(r.referenciasPreco||[]).slice(0,8).map((x:any)=>`${x.orgao} | ${x.descricao} | ${brl(x.valorUnitario)} | ${x.data||"s/data"} | ${x.documento||"s/id"}`).join("\n");
  return `Estimativa preliminar pesquisada pelo LEX: preço unitário referencial ${brl(e.valorUnitario)}; quantidade ${e.quantidade ?? opts.quantidade ?? "[A CONFIRMAR]"} ${e.unidade||opts.unidade||""}; valor total estimado ${brl(e.valorTotal)}. Método: ${e.metodo}. Amostra considerada: ${e.referencias} referência(s); média ${brl(e.media)}, mediana ${brl(e.mediana)}, mínimo ${brl(e.minimo)} e máximo ${brl(e.maximo)}. Fonte principal: ${e.fontePrincipal}. Escopo: ${e.escopoAmostra}. Referências de suporte:\n${amostra || "[REFERÊNCIAS A ANEXAR]"}`;
}

export async function analisarParcelamentoEtp(objeto:string, campos:Record<string,string>){
  const { chat } = await import("@/lib/ia");
  return chat([
    {role:"system",content:`Analise parcelamento para ETP conforme Lei 14.133/2021 e IN SEGES 58/2022. Considere divisibilidade técnica, autonomia dos itens, integração/interoperabilidade, ampliação da competição, custo de gestão, economia de escala e risco de perda de desempenho. NÃO invente características do objeto. Se os dados não permitirem concluir, produza recomendação condicionada e diga o que precisa ser confirmado. Retorne texto pronto para a seção "Justificativa para o parcelamento ou não".`},
    {role:"user",content:`Objeto: ${objeto}\nDados confirmados: ${JSON.stringify(campos)}`}
  ],0.15,1400);
}

export async function buscarCorrelatasEtp(objeto:string){
  const session=await auth(); const user=session?.user as any; if(!user?.orgaoId) return "[A VERIFICAR] Não foi possível identificar o órgão para consultar o histórico interno.";
  const rows=await db.select({numero:processos.numero,objeto:processos.objeto,status:processos.status}).from(processos).where(eq(processos.orgaoId,user.orgaoId)).limit(120);
  const q=tokens(objeto); const scored=rows.map(r=>{const t=tokens(r.objeto||""); const c=Array.from(q).filter(x=>t.has(x)).length; return {...r,score:c/Math.max(1,Math.min(q.size,t.size||1))};}).filter(r=>r.score>=0.35).sort((a,b)=>b.score-a.score).slice(0,6);
  if(!scored.length) return "Não foram identificadas, no histórico interno disponível do órgão, contratações com similaridade textual suficiente. Isso não prova inexistência de contratação correlata/interdependente; a área requisitante deve confirmar a relação operacional com outros processos.";
  return `Processos semelhantes encontrados no histórico interno para análise de correlação/interdependência:\n${scored.map(r=>`- ${r.numero}: ${r.objeto} [${r.status}]`).join("\n")}\nA similaridade histórica serve como pista; a área requisitante deve confirmar se existe dependência operacional real com a contratação atual.`;
}

export async function sugerirImpactosEtp(objeto:string){
  const { chat } = await import("@/lib/ia");
  return chat([
    {role:"system",content:`Você é especialista em sustentabilidade em contratações públicas. Para o objeto informado, liste apenas POSSÍVEIS impactos ambientais e medidas de mitigação que a equipe deve VALIDAR: consumo de energia/água/materiais, geração de resíduos, logística reversa, descarte, durabilidade, embalagem, transporte e outros apenas quando plausíveis. Não afirme que o impacto existe. Não invente certificação obrigatória. Formate como texto de ETP com marcação explícita "a validar".`},
    {role:"user",content:`Objeto: ${objeto}`}
  ],0.15,1200);
}

export async function analisarViabilidadeEtp(objeto:string, campos:Record<string,string>){
  const obrigatorios=["necessidade","quantidade","justificativaQuantitativo","estimativaValor","parcelamento"];
  const faltam=obrigatorios.filter(k=>!String(campos[k]||"").trim());
  const { chat } = await import("@/lib/ia");
  return chat([
    {role:"system",content:`Redija o posicionamento conclusivo de viabilidade de um ETP conforme IN SEGES 58/2022. A conclusão deve decorrer dos elementos fornecidos. Se houver lacunas obrigatórias, NÃO declare viabilidade plena: use "viabilidade condicionada" ou "não conclusiva" e liste as condicionantes. Não invente fatos, orçamento, PCA, mercado, preço ou requisito.`},
    {role:"user",content:`Objeto: ${objeto}\nCampos do ETP: ${JSON.stringify(campos)}\nLacunas obrigatórias detectadas: ${faltam.length?faltam.join(", "):"nenhuma"}`}
  ],0.12,1400);
}
