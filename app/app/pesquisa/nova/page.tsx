"use client";

import React, { useState, useCallback } from "react";
import { Loader2, AlertCircle, Check, X, ExternalLink, MapPin, FileSearch } from "lucide-react";
import { calcularEstatisticas, calcularPrecoEstimado, formatarMoeda } from "@/lib/math";
import { gerarXLSX, downloadXLSX } from "@/lib/xlsx-generator";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPDFDocument } from "@/lib/pdf-generator";

type MetodoCalculo = "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
type PeriodoPesquisa = "6_meses" | "12_meses" | "24_meses";
type RegiaoPesquisa = "brasil" | "centro_oeste" | "sudeste" | "sul" | "nordeste" | "norte";
type StatusAvaliacao = "pendente" | "aceito" | "rejeitado";
type FormaParcelamento = "item" | "lote" | "global";

interface ResultadoPNCP {
  id: string; orgao: string; descricao: string; quantidade: number; data: string;
  valor_unitario: number; valor_total: number; localizacao: string; similaridade: number;
  documento_origem: string; link_origem: string; status_avaliacao: StatusAvaliacao; justificativa_rejeicao?: string;
}

interface EditalProximo {
  id: string; empresa: string; objeto: string; local: string; distancia: string; data: string; link: string;
}

const MOCK_RESULTADOS: ResultadoPNCP[] = [
  { id: "1", orgao: "Min. da Educacao", descricao: "Notebook 14 Core i5 16GB/256GB Win11", quantidade: 30, data: "2026-03-15", valor_unitario: 4850.0, valor_total: 145500.0, localizacao: "Brasilia/DF", similaridade: 96, documento_origem: "PNCP-982341", link_origem: "https://pncp.gov.br/compra/982341", status_avaliacao: "pendente" },
  { id: "2", orgao: "IBAMA", descricao: "Notebook empresarial 14 16GB SSD 256GB", quantidade: 20, data: "2026-04-22", valor_unitario: 5100.0, valor_total: 102000.0, localizacao: "Brasilia/DF", similaridade: 92, documento_origem: "PNCP-982512", link_origem: "https://pncp.gov.br/compra/982512", status_avaliacao: "pendente" },
  { id: "3", orgao: "Receita Federal", descricao: "Computador portatil i5 16GB 256GB 14", quantidade: 100, data: "2026-05-10", valor_unitario: 4700.0, valor_total: 470000.0, localizacao: "Sao Paulo/SP", similaridade: 94, documento_origem: "PNCP-983001", link_origem: "https://pncp.gov.br/compra/983001", status_avaliacao: "pendente" },
  { id: "4", orgao: "INCRA", descricao: "Notebook 14 16GB RAM 256GB SSD", quantidade: 15, data: "2026-06-18", valor_unitario: 4950.0, valor_total: 74250.0, localizacao: "Brasilia/DF", similaridade: 95, documento_origem: "PNCP-983445", link_origem: "https://pncp.gov.br/compra/983445", status_avaliacao: "pendente" },
  { id: "5", orgao: "ANAC", descricao: "Equipamento de informatica notebook 14", quantidade: 10, data: "2026-07-02", valor_unitario: 5200.0, valor_total: 52000.0, localizacao: "Rio de Janeiro/RJ", similaridade: 88, documento_origem: "PNCP-983678", link_origem: "https://pncp.gov.br/compra/983678", status_avaliacao: "pendente" },
  { id: "6", orgao: "ICMBio", descricao: "Notebook Core i5 16GB 256GB 14 Win11", quantidade: 25, data: "2026-07-20", valor_unitario: 4750.0, valor_total: 118750.0, localizacao: "Curitiba/PR", similaridade: 97, documento_origem: "PNCP-983890", link_origem: "https://pncp.gov.br/compra/983890", status_avaliacao: "pendente" },
  { id: "7", orgao: "Min. da Saude", descricao: "Notebook 14 16GB 256GB SSD", quantidade: 40, data: "2026-08-01", valor_unitario: 4600.0, valor_total: 184000.0, localizacao: "Brasilia/DF", similaridade: 93, documento_origem: "PNCP-984102", link_origem: "https://pncp.gov.br/compra/984102", status_avaliacao: "pendente" },
];

const MOCK_CARACTERISTICAS = [
  { caracteristica: "categoria", valor: "informatica / notebooks", confianca: 98 },
  { caracteristica: "processador", valor: "Intel Core i5 ou superior", confianca: 95 },
  { caracteristica: "memoria ram", valor: "16 GB", confianca: 97 },
  { caracteristica: "armazenamento", valor: "256 GB SSD", confianca: 96 },
  { caracteristica: "tela", valor: "14 polegadas", confianca: 94 },
  { caracteristica: "sistema operacional", valor: "Windows 11 Pro ou equivalente", confianca: 92 },
  { caracteristica: "garantia", valor: "minimo 3 anos", confianca: 93 },
];


const MOCK_EDITAIS: EditalProximo[] = [
  { id: "E1", empresa: "TechSolucoes Informatica Ltda", objeto: "Fornecimento de equipamentos de TI", local: "Brasilia/DF", distancia: "12 km", data: "10/07/2026", link: "https://pncp.gov.br/edital/techsolucoes-2026" },
  { id: "E2", empresa: "Brasil Notebooks Comercio", objeto: "Aquisicao de notebooks e desktops", local: "Taguatinga/DF", distancia: "18 km", data: "22/06/2026", link: "https://pncp.gov.br/edital/brasilnotebooks-2026" },
  { id: "E3", empresa: "DF Tecnologia e Servicos", objeto: "Contrato de fornecimento de hardware", local: "Brasilia/DF", distancia: "8 km", data: "05/08/2026", link: "https://pncp.gov.br/edital/dftec-2026" },
];

const UNIDADES_MEDIDA = [
  "unidade", "kit", "lote", "servico",
  "kg", "g", "ton",
  "m", "km", "m2", "m3", "ha",
  "hora", "dia", "mes", "ano",
  "litro", "ml", "m3-gas",
  "pacote", "caixa", "pallet", "container",
  "pagina", "laudo", "relatorio",
];

export default function NovaPesquisaPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 15;
  const [processo, setProcesso] = useState({ numero: "2026/0042", orgao: "Ministerio do Planejamento", unidade: "SEGEP/DTI", responsavel: "Ana Costa", email: "ana.costa@planejamento.gov.br" });
  const [objetoDesc, setObjetoDesc] = useState("Aquisicao de 50 (cinquenta) notebooks para uso administrativo, com processador Intel Core i5 ou superior, 16 GB de memoria RAM, 256 GB SSD, tela 14 polegadas, sistema operacional Windows 11 Pro ou equivalente, garantia minima de 3 anos.");
  const [especificacao, setEspecificacao] = useState([
    { item: "Processador", especificacao: "Intel Core i5 ou superior", obrigatorio: true },
    { item: "Memoria RAM", especificacao: "16 GB DDR4", obrigatorio: true },
    { item: "Armazenamento", especificacao: "256 GB SSD", obrigatorio: true },
    { item: "Tela", especificacao: "14 polegadas Full HD", obrigatorio: true },
    { item: "Sistema Operacional", especificacao: "Windows 11 Pro ou equivalente", obrigatorio: true },
    { item: "Garantia", especificacao: "Minimo 3 anos", obrigatorio: true },
  ]);
  const [quantidade, setQuantidade] = useState(50);
  const [unidadeMedida, setUnidadeMedida] = useState("unidade");
  const [formaParcelamento, setFormaParcelamento] = useState<FormaParcelamento>("item");
  const [localEntrega, setLocalEntrega] = useState("Brasilia/DF");
  const [editaisProximos, setEditaisProximos] = useState<EditalProximo[]>([]);
  const [buscandoEditais, setBuscandoEditais] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [caracteristicasIA, setCaracteristicasIA] = useState<{ caracteristica: string; valor: string; confianca: number }[]>([]);
  const [config, setConfig] = useState({ periodo: "12_meses" as PeriodoPesquisa, regiao: "brasil" as RegiaoPesquisa, qtdMin: 5, metodo: "media_aritmetica" as MetodoCalculo });
  const [pesquisando, setPesquisando] = useState(false);
  const [erroPesquisa, setErroPesquisa] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoPNCP[]>([]);
  const [estatisticas, setEstatisticas] = useState<ReturnType<typeof calcularEstatisticas> | null>(null);
  const [precoEstimado, setPrecoEstimado] = useState<{ unitario: number; total: number } | null>(null);
  const [justificativaIA, setJustificativaIA] = useState<string | null>(null);
  const [validacaoIA, setValidacaoIA] = useState<any | null>(null);

  const nextStep = useCallback(() => setStep(s => Math.min(s + 1, totalSteps)), []);
  const prevStep = useCallback(() => setStep(s => Math.max(s - 1, 1)), []);
  const goToStep = useCallback((s: number) => { if (s >= 1 && s <= totalSteps) setStep(s); }, []);

  const addEspecificacao = () => setEspecificacao([...especificacao, { item: "", especificacao: "", obrigatorio: true }]);
  const updateEspec = (idx: number, field: string, value: string | boolean) => {
    const novo = [...especificacao];
    novo[idx] = { ...novo[idx], [field]: value };
    setEspecificacao(novo);
  };
  const removeEspec = (idx: number) => setEspecificacao(especificacao.filter((_, i) => i !== idx));

  const buscarEditais = async () => {
    setBuscandoEditais(true);
    await new Promise(r => setTimeout(r, 1200));
    setEditaisProximos(MOCK_EDITAIS);
    setBuscandoEditais(false);
  };

  const extrairIA = async () => {
    setIaLoading(true);
    try {
      const res = await fetch("/api/ia/extracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: objetoDesc, especificacoes: especificacao }),
      });
      const data = await res.json();
      if (data.caracteristicas && data.caracteristicas.length > 0) {
        setCaracteristicasIA(data.caracteristicas.map((c: any) => ({ caracteristica: c.nome, valor: c.valor, confianca: c.confianca })));
      } else {
        console.warn("Extrator sem caracteristicas, usando fallback:", data);
        setCaracteristicasIA(MOCK_CARACTERISTICAS);
      }
    } catch (err) {
      console.error("Erro no agente extrator:", err);
      setCaracteristicasIA(MOCK_CARACTERISTICAS);
    }
    setIaLoading(false);
    nextStep();
  };

  const pesquisarPNCP = async () => {
    setPesquisando(true); setResultados([]); setErroPesquisa(null);
    goToStep(9); // mostra o spinner de consulta
    try {
      const termo = objetoDesc || (especificacao[0]?.item || "");
      const res = await fetch(`/api/pncp?termo=${encodeURIComponent(termo)}&fonte=precos_abertos&tamanhoPagina=20`, {
        signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json();
      if (data?.items?.length > 0) {
        const novos = data.items.map((it: any, idx: number) => ({
          id: String(idx + 1),
          orgao: it.orgao || "Órgão público",
          descricao: it.descricao || "",
          quantidade: it.quantidade,
          data: it.dataContrato || "",
          valor_unitario: it.valorUnitario,
          valor_total: it.valorTotal,
          localizacao: it.localizacao || "",
          similaridade: it.similaridade ?? 0,
          documento_origem: it.documentoOrigem || "",
          link_origem: it.linkEdital || "",
          status_avaliacao: "pendente" as const,
        }));
        setResultados(novos);
        setPesquisando(false);
        goToStep(10); // vai direto para a tabela de resultados
        return;
      } else {
        setErroPesquisa(`Nenhuma referência encontrada para "${termo}". ${data?.erro || ""}`.trim());
        setResultados([]);
      }
    } catch (err: any) {
      console.error("Erro na pesquisa:", err);
      setErroPesquisa("Erro ao consultar as fontes de preços: " + (err?.message || "falha na rede"));
    }
    setPesquisando(false);
  };

  const avaliarResultado = (id: string, status: StatusAvaliacao, justificativa?: string) => {
    setResultados(prev => prev.map(r => r.id === id ? { ...r, status_avaliacao: status, justificativa_rejeicao: justificativa } : r));
  };

  const gerarConteudoIA = async (stats: any, nAceitas: number) => {
    try {
      const res = await fetch("/api/ia/justificativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatisticas: stats, metodo: config.metodo, quantidade, referenciasAceitas: nAceitas }),
      });
      const data = await res.json();
      if (data.justificativa) setJustificativaIA(data.justificativa);
    } catch (err) { console.error("Erro no agente justificador:", err); }
    try {
      const aceitos = resultados.filter(r => r.status_avaliacao === "aceito");
      const menores = aceitos.map(r => r.similaridade);
      const res2 = await fetch("/api/ia/validacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          n: nAceitas,
          cv: stats.coeficienteVariacao,
          min_referencias: config.qtdMin,
          cv_limite: 25,
          similaridade_minima: 75,
          menor_similaridade_aceita: menores.length ? Math.min(...menores) : 100,
        }),
      });
      setValidacaoIA(await res2.json());
    } catch (err) { console.error("Erro no agente validador:", err); }
  };

  const calcular = () => {
    const aceitos = resultados.filter(r => r.status_avaliacao === "aceito").map(r => r.valor_unitario);
    if (aceitos.length === 0) { setEstatisticas(null); return; }
    const stats = calcularEstatisticas(aceitos);
    setEstatisticas(stats);
    const preco = calcularPrecoEstimado(aceitos, config.metodo, quantidade);
    setPrecoEstimado(preco);
    gerarConteudoIA(stats, aceitos.length);
  };

  const linksAceitos = resultados.filter(r => r.status_avaliacao === "aceito").map(r => ({ nome: r.documento_origem, url: r.link_origem, tipo: "link" as const }));

  const relatorioData = {
    processo, objeto: objetoDesc, quantidade, metodo: config.metodo,
    estatisticas: estatisticas || { n: 0, media: 0, mediana: 0, minimo: 0, maximo: 0, desvioPadrao: 0, coeficienteVariacao: 0 },
    precoUnitario: precoEstimado?.unitario || 0, precoTotal: precoEstimado?.total || 0,
    justificativa: justificativaIA || (precoEstimado ? `O preco foi formado com base em ${estatisticas?.n} registros do PNCP, utilizando o metodo da ${config.metodo}.` : ""),
    referencias: resultados.filter(r => r.status_avaliacao === "aceito"),
    responsavel: processo.responsavel,
    email: processo.email,
    linksEvidencias: linksAceitos,
  };

  const stepLabels = ["processo","objeto","especificacao","quantidade","local-editais","ia","revisar","config","pncp","resultados","analise","calculos","preco","evidencias","relatorio"];

  const renderStep = () => {
    switch (step) {
      case 1: return (
        <Card title="Informacoes do processo">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Numero do processo"><input className="input" value={processo.numero} onChange={e => setProcesso({ ...processo, numero: e.target.value })} /></Field>
            <Field label="Orgao"><input className="input" value={processo.orgao} onChange={e => setProcesso({ ...processo, orgao: e.target.value })} /></Field>
            <Field label="Unidade"><input className="input" value={processo.unidade} onChange={e => setProcesso({ ...processo, unidade: e.target.value })} /></Field>
            <Field label="Responsavel"><input className="input" value={processo.responsavel} onChange={e => setProcesso({ ...processo, responsavel: e.target.value })} /></Field>
            <Field label="E-mail do responsavel"><input type="email" className="input" value={processo.email} onChange={e => setProcesso({ ...processo, email: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end mt-6"><Button onClick={nextStep} primary>Proximo</Button></div>
        </Card>
      );
      case 2: return (
        <Card title="Descricao do objeto">
          <Field label="Descreva o objeto da contratacao (visao geral)"><textarea className="input min-h-[100px]" value={objetoDesc} onChange={e => setObjetoDesc(e.target.value)} /></Field>
          <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={nextStep} primary>Proximo</Button></div>
        </Card>
      );
      case 3: return (
        <Card title="Especificacao tecnica do objeto">
          <p className="text-sm text-neutral-500 mb-4">Detalhe as caracteristicas tecnicas que serao exigidas na contratacao. A IA tambem usara estas informacoes para comparar similaridade.</p>
          <div className="space-y-3">
            {especificacao.map((esp, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start p-3 rounded-lg border border-neutral-100 bg-neutral-50/50">
                <div className="md:col-span-3"><input className="input text-sm" placeholder="Item (ex: Processador)" value={esp.item} onChange={e => updateEspec(idx, "item", e.target.value)} /></div>
                <div className="md:col-span-6"><input className="input text-sm" placeholder="Especificacao (ex: Intel Core i5 ou superior)" value={esp.especificacao} onChange={e => updateEspec(idx, "especificacao", e.target.value)} /></div>
                <div className="md:col-span-2 flex items-center gap-2">
                  <input type="checkbox" id={`obr-${idx}`} checked={esp.obrigatorio} onChange={e => updateEspec(idx, "obrigatorio", e.target.checked)} />
                  <label htmlFor={`obr-${idx}`} className="text-xs text-neutral-500">Obrigatorio</label>
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <button onClick={() => removeEspec(idx)} className="p-1.5 rounded hover:bg-red-100 text-neutral-400 hover:text-red-600"><X size={14} /></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addEspecificacao} className="mt-3 inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 font-medium"><PlusIcon /> Adicionar item</button>
          <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={nextStep} primary>Proximo</Button></div>
        </Card>
      );
      case 4: return (
        <Card title="Quantidade, parcelamento e unidade">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Quantidade"><input type="number" className="input" value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} /></Field>
            <Field label="Unidade de medida">
              <select className="input" value={unidadeMedida} onChange={e => setUnidadeMedida(e.target.value)}>
                {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Forma de parcelamento">
              <select className="input" value={formaParcelamento} onChange={e => setFormaParcelamento(e.target.value as FormaParcelamento)}>
                <option value="item">Por item</option>
                <option value="lote">Por lote</option>
                <option value="global">Preco global</option>
              </select>
            </Field>
            <Field label="Local de entrega"><input className="input" value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} /></Field>
          </div>
          {formaParcelamento === "global" && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <strong>Atencao:</strong> No preco global, o valor total sera calculado diretamente sem divisao por unidade. A quantidade servira apenas como referencia de escopo.
            </div>
          )}
          <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={nextStep} primary>Proximo</Button></div>
        </Card>
      );
      case 5: return (
        <Card title="Editais de empresas proximas">
          <p className="text-sm text-neutral-500 mb-4">Pesquise editais de empresas que podem executar o servico/fornecimento proximo ao local de entrega: <strong>{localEntrega}</strong></p>
          <div className="flex gap-3 mb-4">
            <Button onClick={buscarEditais} primary>{buscandoEditais ? <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</> : <><FileSearch className="w-4 h-4" /> Buscar editais proximos</>}</Button>
          </div>
          {editaisProximos.length > 0 && (
            <div className="rounded-lg border border-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50"><tr>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Empresa</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Objeto</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Local</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Distancia</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Data</th>
                  <th className="text-left px-4 py-2 font-medium text-neutral-600">Link</th>
                </tr></thead>
                <tbody>
                  {editaisProximos.map(e => (
                    <tr key={e.id} className="border-t border-neutral-100">
                      <td className="px-4 py-2 font-medium">{e.empresa}</td>
                      <td className="px-4 py-2">{e.objeto}</td>
                      <td className="px-4 py-2"><span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-neutral-400" />{e.local}</span></td>
                      <td className="px-4 py-2">{e.distancia}</td>
                      <td className="px-4 py-2">{e.data}</td>
                      <td className="px-4 py-2">
                        <a href={e.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                          <ExternalLink className="w-3 h-3" /> Abrir edital
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={nextStep} primary>Proximo</Button></div>
        </Card>
      );
      case 6: return (
        <Card title="Extracao de caracteristicas (IA)">
          {iaLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
              <p className="text-sm text-neutral-500">A IA esta analisando a descricao e as especificacoes tecnicas...</p>
            </div>
          ) : caracteristicasIA.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <AlertCircle className="w-8 h-8 text-neutral-400" />
              <p className="text-sm text-neutral-500">Clique em "Extrair com IA" para analisar o objeto.</p>
              <Button onClick={extrairIA} primary>Extrair com IA</Button>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-neutral-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50"><tr><th className="text-left px-4 py-2 font-medium text-neutral-600">Caracteristica</th><th className="text-left px-4 py-2 font-medium text-neutral-600">Valor extraido</th><th className="text-left px-4 py-2 font-medium text-neutral-600">Confianca</th></tr></thead>
                  <tbody>
                    {caracteristicasIA.map((c, i) => (
                      <tr key={i} className="border-t border-neutral-100"><td className="px-4 py-2 capitalize">{c.caracteristica}</td><td className="px-4 py-2">{c.valor}</td><td className="px-4 py-2">{c.confianca}%</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={nextStep} primary>Proximo</Button></div>
            </>
          )}
        </Card>
      );
      case 7: return (
        <Card title="Revisar e confirmar informacoes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Processo"><input className="input bg-neutral-50" value={processo.numero} readOnly /></Field>
            <Field label="Orgao"><input className="input bg-neutral-50" value={processo.orgao} readOnly /></Field>
            <Field label="Responsavel"><input className="input bg-neutral-50" value={processo.responsavel} readOnly /></Field>
            <Field label="E-mail"><input className="input bg-neutral-50" value={processo.email} readOnly /></Field>
            <Field label="Objeto resumido"><input className="input bg-neutral-50" value={`Aquisicao de ${quantidade} ${unidadeMedida}(s)`} readOnly /></Field>
            <Field label="Parcelamento"><input className="input bg-neutral-50" value={formaParcelamento} readOnly /></Field>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-800">
            <strong>Caracteristicas confirmadas:</strong> {caracteristicasIA.map(c => c.valor).join(", ")}.
          </div>
          <div className="mt-4 p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-sm">
            <strong>Especificacoes tecnicas ({especificacao.length} itens):</strong>
            <ul className="list-disc list-inside mt-1 text-neutral-600">
              {especificacao.map((e, i) => (<li key={i}>{e.item}: {e.especificacao} {e.obrigatorio ? "(obrigatorio)" : "(desejavel)"}</li>))}
            </ul>
          </div>
          <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={nextStep} primary>Confirmar e prosseguir</Button></div>
        </Card>
      );
      case 8: return (
        <Card title="Configuracoes da pesquisa">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Periodo">
              <select className="input" value={config.periodo} onChange={e => setConfig({ ...config, periodo: e.target.value as PeriodoPesquisa })}>
                <option value="12_meses">ultimos 12 meses</option><option value="6_meses">ultimos 6 meses</option><option value="24_meses">ultimos 24 meses</option>
              </select>
            </Field>
            <Field label="Regiao">
              <select className="input" value={config.regiao} onChange={e => setConfig({ ...config, regiao: e.target.value as RegiaoPesquisa })}>
                <option value="brasil">todo o Brasil</option><option value="centro_oeste">Centro-Oeste</option><option value="sudeste">Sudeste</option><option value="sul">Sul</option><option value="nordeste">Nordeste</option><option value="norte">Norte</option>
              </select>
            </Field>
            <Field label="Qtd. minima"><input type="number" className="input" value={config.qtdMin} onChange={e => setConfig({ ...config, qtdMin: Number(e.target.value) })} /></Field>
            <Field label="Metodo">
              <select className="input" value={config.metodo} onChange={e => setConfig({ ...config, metodo: e.target.value as MetodoCalculo })}>
                <option value="media_aritmetica">media aritmetica</option><option value="mediana">mediana</option><option value="media_ponderada">media ponderada</option><option value="menor_preco">menor preco</option>
              </select>
            </Field>
          </div>
          <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={pesquisarPNCP} primary>Pesquisar no PNCP</Button></div>
        </Card>
      );
      case 9: return (
        <Card title="Pesquisando precos nas fontes oficiais">
          {pesquisando ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-neutral-500" />
              <p className="text-sm text-neutral-500">Consultando as fontes de preços públicas (Compras.gov.br)...</p>
              <p className="text-xs text-neutral-400 font-mono">Filtros: {config.regiao} | {config.periodo} | min. {config.qtdMin} refs</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle className="w-10 h-10 text-amber-500" />
              <p className="text-sm text-neutral-600">A pesquisa não está em execução ou não retornou referências.</p>
              {erroPesquisa && <p className="text-xs text-neutral-500 max-w-md text-center">{erroPesquisa}</p>}
              <div className="flex gap-3 mt-2">
                <Button onClick={() => goToStep(10)} secondary>Ver últimos resultados</Button>
                <Button onClick={pesquisarPNCP} primary>Refazer pesquisa</Button>
              </div>
            </div>
          )}
        </Card>
      );
      case 10: return (
        <Card title="Resultados da pesquisa (PNCP)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Orgao</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Descricao</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Qtd</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Data</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Valor unit.</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Local</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Sim.</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Origem / Link</th>
                  <th className="text-left px-3 py-2 font-medium text-neutral-600">Acao</th>
                </tr>
              </thead>
              <tbody>
                {resultados.map(r => (
                  <tr key={r.id} className={`border-t border-neutral-100 ${r.status_avaliacao === "rejeitado" ? "opacity-50 bg-red-50/30" : r.status_avaliacao === "aceito" ? "bg-green-50/30" : ""}`}>
                    <td className="px-3 py-2">{r.orgao}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={r.descricao}>{r.descricao}</td>
                    <td className="px-3 py-2">{r.quantidade}</td>
                    <td className="px-3 py-2">{r.data}</td>
                    <td className="px-3 py-2">{formatarMoeda(r.valor_unitario)}</td>
                    <td className="px-3 py-2">{r.localizacao}</td>
                    <td className="px-3 py-2">{r.similaridade}%</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-xs">{r.documento_origem}</span>
                        <a href={r.link_origem} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium">
                          <ExternalLink className="w-3 h-3" /> Ver edital
                        </a>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <button onClick={() => avaliarResultado(r.id, "aceito")} className="p-1 rounded hover:bg-green-100 text-green-600" title="Aceitar"><Check size={14} /></button>
                        <button onClick={() => avaliarResultado(r.id, "rejeitado")} className="p-1 rounded hover:bg-red-100 text-red-600" title="Rejeitar"><X size={14} /></button>
                      </div>
                      {r.status_avaliacao === "rejeitado" && (
                        <input className="mt-1 w-full text-xs px-2 py-1 rounded border border-neutral-200" placeholder="Justificativa..." value={r.justificativa_rejeicao || ""} onChange={e => avaliarResultado(r.id, "rejeitado", e.target.value)} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between mt-6"><Button onClick={() => goToStep(8)} secondary>Voltar</Button><Button onClick={() => { calcular(); nextStep(); }} primary>Ir para calculos</Button></div>
        </Card>
      );
      case 12: return (
        <Card title="Analise estatistica">
          {estatisticas ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <StatBox label="referencias" value={estatisticas.n.toString()} />
                <StatBox label="media" value={formatarMoeda(estatisticas.media)} />
                <StatBox label="mediana" value={formatarMoeda(estatisticas.mediana)} />
                <StatBox label="minimo" value={formatarMoeda(estatisticas.minimo)} />
                <StatBox label="maximo" value={formatarMoeda(estatisticas.maximo)} />
                <StatBox label="desvio padrao" value={estatisticas.desvioPadrao.toFixed(2).replace(".", ",")} />
                <StatBox label="coef. variacao" value={`${estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%`} />
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <h3 className="text-sm font-medium mb-2">Memoria de calculo</h3>
                <div className="font-mono text-xs text-neutral-600 space-y-1">
                  <p>referencias aceitas: {estatisticas.n}</p>
                  <p>valores: {resultados.filter(r => r.status_avaliacao === "aceito").map(r => formatarMoeda(r.valor_unitario)).join(" | ")}</p>
                  <p>media = {formatarMoeda(estatisticas.media)}</p>
                  <p>mediana = {formatarMoeda(estatisticas.mediana)}</p>
                  <p>minimo = {formatarMoeda(estatisticas.minimo)} | maximo = {formatarMoeda(estatisticas.maximo)}</p>
                  <p>desvio padrao = {estatisticas.desvioPadrao.toFixed(2).replace(".", ",")}</p>
                  <p>coeficiente de variacao = {estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500 py-8 text-center">Nenhum resultado aceito. Volte e aceite pelo menos um registro.</p>
          )}
          <div className="flex justify-between mt-6"><Button onClick={() => goToStep(10)} secondary>Voltar</Button><Button onClick={nextStep} primary>Gerar preco estimado</Button></div>
        </Card>
      );
      case 13: return (
        <Card title="Preco estimado">
          {precoEstimado ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatBox label="valor unitario estimado" value={formatarMoeda(precoEstimado.unitario)} />
                <StatBox label={`valor total estimado (${quantidade} ${unidadeMedida})`} value={formatarMoeda(precoEstimado.total)} />
                <StatBox label="metodo aplicado" value={config.metodo.replace("_", " ")} />
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
                <strong>Justificativa automatica:</strong> {justificativaIA || `O preco foi formado com base em ${estatisticas?.n} registros do PNCP, utilizando o metodo da ${config.metodo.replace("_", " ")}. O coeficiente de variacao esta dentro dos limites aceitaveis para a categoria de informatica.`}
              </div>
              {validacaoIA && !validacaoIA.valido && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-medium text-red-700">Validacao do agente validador: pesquisa reprovada (score {validacaoIA.score_confianca})</p>
                  {validacaoIA.alertas.map((a: any, i: number) => (
                    <p key={i} className="mt-1 text-xs text-red-600">[{a.tipo}] {a.campo}: {a.mensagem} — {a.sugestao}</p>
                  ))}
                </div>
              )}
              {validacaoIA && validacaoIA.valido && (
                <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-700">Validacao do agente validador: pesquisa aprovada (score {validacaoIA.score_confianca})</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500 py-8 text-center">Aceite pelo menos um resultado para gerar o preco estimado.</p>
          )}
          <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={nextStep} primary>Salvar evidencias</Button></div>
        </Card>
      );
      case 14: return (
        <Card title="Documentos, links e evidencias">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field label="Responsavel pela pesquisa"><input className="input bg-neutral-50" value={processo.responsavel} readOnly /></Field>
            <Field label="E-mail"><input className="input bg-neutral-50" value={processo.email} readOnly /></Field>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 mb-4">
            <h4 className="text-sm font-medium mb-2">Links das referencias aceitas (evidencias)</h4>
            {linksAceitos.length > 0 ? (
              <ul className="space-y-2">
                {linksAceitos.map((link, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500" />
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 font-medium">{link.nome}</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">Nenhuma referencia aceita ainda.</p>
            )}
          </div>
          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4">
            <h4 className="text-sm font-medium mb-2">Evidencias vinculadas automaticamente</h4>
            <ul className="list-disc list-inside text-sm text-neutral-600 space-y-1">
              <li>Registros PNCP consultados em {new Date().toLocaleDateString("pt-BR")}</li>
              <li>Termo de referencia do processo {processo.numero}</li>
              <li>Prints das telas de pesquisa</li>
              <li>Planilha de calculo intermediaria</li>
              <li>Editais de empresas proximas consultados</li>
            </ul>
          </div>
          <div className="flex justify-between mt-6"><Button onClick={prevStep} secondary>Voltar</Button><Button onClick={nextStep} primary>Gerar relatorio</Button></div>
        </Card>
      );
      case 15: return (
        <Card title="Relatorio final">
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 mb-6">
            <strong>Relatorio pronto para exportacao.</strong> O documento contem memoria de calculo, fontes utilizadas, links das referencias, estatisticas, dados do responsavel e justificativa do preco estimado.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field label="Nome do arquivo PDF"><input className="input" defaultValue={`estimativa_${processo.numero.replace("/", "_")}.pdf`} /></Field>
            <Field label="Nome do arquivo XLSX"><input className="input" defaultValue={`estimativa_${processo.numero.replace("/", "_")}.xlsx`} /></Field>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 mb-4 text-sm">
            <p className="font-medium text-neutral-700 mb-1">Metadados incluidos no documento:</p>
            <ul className="list-disc list-inside text-neutral-600 space-y-1">
              <li>Responsavel: {processo.responsavel} ({processo.email})</li>
              <li>Processo: {processo.numero} | Orgao: {processo.orgao}</li>
              <li>Links das referencias aceitas no PNCP</li>
              <li>Memoria de calculo completa</li>
            </ul>
          </div>
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <div className="flex gap-2">
              <Button onClick={() => {
                const bytes = gerarXLSX(relatorioData);
                downloadXLSX(bytes, `estimativa_${processo.numero.replace("/", "_")}.xlsx`);
              }} secondary>Baixar XLSX</Button>
              <PDFDownloadLink
                document={<RelatorioPDFDocument {...relatorioData} />}
                fileName={`estimativa_${processo.numero.replace("/", "_")}.pdf`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors"
              >
                {"Baixar PDF"}
              </PDFDownloadLink>
            </div>
          </div>
        </Card>
      );
      default: return null;
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Nova pesquisa</h1>
        <span className="text-xs font-medium px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200">DEMONSTRACAO</span>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
          <button key={s} onClick={() => goToStep(s)} className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            s === step ? "bg-neutral-900 text-white border-neutral-900" : s < step ? "bg-neutral-100 text-neutral-700 border-neutral-200" : "bg-white text-neutral-400 border-neutral-200"
          }`}>
            {s}. {stepLabels[s-1]}
          </button>
        ))}
      </div>
      {renderStep()}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm"><h2 className="text-base font-medium mb-4">{title}</h2>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-neutral-500">{label}</label>{children}</div>;
}
function Button({ children, onClick, primary, secondary }: { children: React.ReactNode; onClick?: () => void; primary?: boolean; secondary?: boolean }) {
  const base = "px-4 py-2 rounded-lg text-sm font-medium transition-colors border";
  const styles = primary ? "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50";
  return <button onClick={onClick} className={`${base} ${styles}`}>{children}</button>;
}
function StatBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center"><span className="block text-lg font-medium tabular-nums">{value}</span><span className="text-xs text-neutral-500">{label}</span></div>;
}
function PlusIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;
}
