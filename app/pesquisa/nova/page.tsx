"use client";

import React, { useState, useCallback } from "react";
import {
  Loader2, AlertCircle, Check, X, ExternalLink, MapPin,
  FileSearch, ChevronRight, Sparkles, BarChart3, FileText,
  ClipboardList, Settings, Search, CheckCircle2, TrendingUp,
} from "lucide-react";
import { calcularEstatisticas, calcularPrecoEstimado, formatarMoeda } from "@/lib/math";
import { gerarXLSX, downloadXLSX } from "@/lib/xlsx-generator";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPDFDocument } from "@/lib/pdf-generator";
import { criarProcesso, criarPesquisa, salvarResultadosPesquisa, atualizarPesquisa } from "@/lib/actions";

type MetodoCalculo = "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
type PeriodoPesquisa = "6_meses" | "12_meses" | "24_meses";
type RegiaoPesquisa = "brasil" | "centro_oeste" | "sudeste" | "sul" | "nordeste" | "norte";
type StatusAvaliacao = "pendente" | "aceito" | "rejeitado";
type FormaParcelamento = "item" | "lote" | "global";

interface ResultadoPNCP {
  id: string; orgao: string; descricao: string; quantidade: number | null; data: string;
  valor_unitario: number | null; valor_total: number | null; localizacao: string | null;
  similaridade: number; documento_origem: string; link_origem: string;
  fornecedor?: string; status_avaliacao: StatusAvaliacao; justificativa_rejeicao?: string;
}

interface EditalProximo {
  id: string; empresa: string; objeto: string; local: string; distancia: string; data: string; link: string;
}

const UNIDADES_MEDIDA = [
  "unidade", "kit", "lote", "serviço",
  "kg", "g", "ton",
  "m", "km", "m²", "m³", "ha",
  "hora", "dia", "mês", "ano",
  "litro", "ml",
  "pacote", "caixa", "pallet",
  "página", "laudo", "relatório",
];

// ─── Fases do wizard ──────────────────────────────────────────────────────────
const FASES = [
  { nome: "Processo",   icon: ClipboardList, steps: [1, 2, 3, 4] },
  { nome: "Pesquisa",   icon: Search,        steps: [5, 6, 7, 8, 9] },
  { nome: "Análise",    icon: BarChart3,      steps: [10, 11, 12, 13] },
  { nome: "Relatório",  icon: FileText,       steps: [14, 15] },
];

const STEP_NAMES: Record<number, string> = {
  1: "Informações do processo", 2: "Objeto da contratação", 3: "Especificação técnica",
  4: "Quantidade e local", 5: "Editais próximos", 6: "Extração IA",
  7: "Revisão", 8: "Configurações", 9: "Pesquisa PNCP",
  10: "Resultados", 11: "Análise IA", 12: "Estatísticas",
  13: "Preço estimado", 14: "Evidências", 15: "Relatório final",
};

export default function NovaPesquisaPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 15;
  const [processo, setProcesso] = useState({ numero: "", orgao: "", unidade: "", responsavel: "", email: "" });
  const [objetoDesc, setObjetoDesc] = useState("");
  const [especificacao, setEspecificacao] = useState<{ item: string; especificacao: string; obrigatorio: boolean }[]>([]);
  const [quantidade, setQuantidade] = useState(0);
  const [unidadeMedida, setUnidadeMedida] = useState("");
  const [formaParcelamento, setFormaParcelamento] = useState<FormaParcelamento | "">("");
  const [localEntrega, setLocalEntrega] = useState("");
  const [erroExtracao, setErroExtracao] = useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        if (s?.user) {
          setProcesso((p) => ({
            ...p,
            responsavel: s.user.name || "",
            email: s.user.email || "",
            orgao: (s.user as any).orgaoNome || "",
          }));
        }
      });
  }, []);

  const [editaisProximos, setEditaisProximos] = useState<EditalProximo[]>([]);
  const [buscandoEditais, setBuscandoEditais] = useState(false);
  const [iaLoading, setIaLoading] = useState(false);
  const [pesquisaSalvaId, setPesquisaSalvaId] = useState<string | null>(null);
  const [salvandoPesquisa, setSalvandoPesquisa] = useState(false);
  const [erroSalvamento, setErroSalvamento] = useState<string | null>(null);
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
    try {
      const uf = (localEntrega.split("/").pop() || "").trim().toUpperCase().slice(0, 2);
      const termo = objetoDesc || (especificacao[0]?.item || "");
      const res = await fetch(`/api/pncp?termo=${encodeURIComponent(termo)}&fonte=precos_abertos&tamanhoPagina=10&uf=${encodeURIComponent(uf)}`, {
        signal: AbortSignal.timeout(120_000),
      });
      const data = await res.json();
      const vistos = new Set<string>();
      const empresas: EditalProximo[] = [];
      for (const it of data?.items || []) {
        const forn = it?.dadosBrutos?.nomeFornecedor || it?.dadosBrutos?.fornecedor;
        if (!forn || vistos.has(forn)) continue;
        vistos.add(forn);
        const idCompra = it?.documentoOrigem || "";
        empresas.push({
          id: idCompra || String(empresas.length + 1),
          empresa: forn,
          objeto: (it?.descricao || "").slice(0, 90),
          local: it?.localizacao || "",
          distancia: uf ? `UF: ${uf}` : "",
          data: it?.dataContrato || "",
          link: it?.linkEdital || "",
        });
      }
      setEditaisProximos(empresas);
    } catch (err) {
      console.error("Erro ao buscar fornecedores:", err);
      setEditaisProximos([]);
    }
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
        setErroExtracao(null);
        setCaracteristicasIA(data.caracteristicas.map((c: any) => ({ caracteristica: c.nome, valor: c.valor, confianca: c.confianca })));
      } else {
        setErroExtracao("O agente extrator não retornou características para este objeto. Verifique a descrição e tente novamente.");
        setCaracteristicasIA([]);
      }
    } catch (err) {
      console.error("Erro no agente extrator:", err);
      setErroExtracao("Erro ao contactar o agente extrator. Tente novamente em instantes.");
      setCaracteristicasIA([]);
    }
    setIaLoading(false);
    nextStep();
  };

  const pesquisarPNCP = async () => {
    setPesquisando(true); setResultados([]); setErroPesquisa(null);
    goToStep(9);
    const termo = caracteristicasIA.length
      ? caracteristicasIA.map(c => c.valor).join(" ")
      : objetoDesc;
    try {
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
          fornecedor: it.dadosBrutos?.nomeFornecedor || "",
          status_avaliacao: "pendente" as const,
        }));
        setResultados(novos);
        setPesquisando(false);
        goToStep(10);
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
    const aceitos = resultados.filter(r => r.status_avaliacao === "aceito").map(r => r.valor_unitario).filter((v): v is number => v != null);
    if (aceitos.length === 0) { setEstatisticas(null); return; }
    const stats = calcularEstatisticas(aceitos);
    setEstatisticas(stats);
    const preco = calcularPrecoEstimado(aceitos, config.metodo, quantidade);
    setPrecoEstimado(preco);
    gerarConteudoIA(stats, aceitos.length);
  };

  const linksAceitos = resultados.filter(r => r.status_avaliacao === "aceito").map(r => ({ nome: r.documento_origem, url: r.link_origem, tipo: "link" as const }));

  const salvarPesquisa = async () => {
    if (pesquisaSalvaId) return pesquisaSalvaId;
    setSalvandoPesquisa(true);
    setErroSalvamento(null);
    try {
      const processoSalvo = await criarProcesso({ numero: processo.numero, objeto: objetoDesc, unidade: processo.unidade });
      const nova = await criarPesquisa({
        processoId: processoSalvo.id,
        objeto: objetoDesc,
        quantidade,
        unidadeMedida,
        localEntrega,
        especificacoes: especificacao,
        caracteristicasIA: caracteristicasIA.length ? caracteristicasIA : null,
        periodoPesquisa: config.periodo,
        regiaoPesquisa: config.regiao,
        metodoCalculo: config.metodo,
        fontesAtivas: ["precos_abertos"],
      });
      if (resultados.length > 0) {
        await salvarResultadosPesquisa(nova.id, resultados.map((r) => ({
          fonte: "precos_abertos",
          orgao: r.orgao,
          descricao: r.descricao,
          quantidade: r.quantidade,
          dataContrato: r.data,
          valorUnitario: r.valor_unitario,
          valorTotal: r.valor_total,
          localizacao: r.localizacao,
          similaridade: r.similaridade,
          documentoOrigem: r.documento_origem,
          linkEdital: r.link_origem || null,
          avaliacao: r.status_avaliacao,
          justificativaRejeicao: r.justificativa_rejeicao || null,
          dadosBrutos: { fornecedor: r.fornecedor || null },
        })));
      }
      await atualizarPesquisa(nova.id, {
        precoUnitarioEstimado: precoEstimado?.unitario != null ? String(precoEstimado.unitario) : null,
        precoTotalEstimado: precoEstimado?.total != null ? String(precoEstimado.total) : null,
        estatisticas: estatisticas || null,
        justificativa: justificativaIA || null,
        status: "concluida",
      });
      setPesquisaSalvaId(nova.id);
      return nova.id;
    } catch (err: any) {
      console.error("Erro ao salvar pesquisa:", err);
      setErroSalvamento(String(err?.message || err));
      return null;
    } finally {
      setSalvandoPesquisa(false);
    }
  };

  const relatorioData = {
    processo, objeto: objetoDesc, quantidade, metodo: config.metodo,
    estatisticas: estatisticas || { n: 0, media: 0, mediana: 0, minimo: 0, maximo: 0, desvioPadrao: 0, coeficienteVariacao: 0 },
    precoUnitario: precoEstimado?.unitario || 0, precoTotal: precoEstimado?.total || 0,
    justificativa: justificativaIA || (precoEstimado ? `O preço foi formado com base em ${estatisticas?.n} registros do PNCP, utilizando o método da ${config.metodo}.` : ""),
    referencias: resultados.filter(r => r.status_avaliacao === "aceito"),
    responsavel: processo.responsavel,
    email: processo.email,
    linksEvidencias: linksAceitos,
  };

  // ─── Stepper helpers ────────────────────────────────────────────────────────
  const faseAtual = FASES.findIndex(f => f.steps.includes(step));
  const nAceitos = resultados.filter(r => r.status_avaliacao === "aceito").length;
  const nRejeitados = resultados.filter(r => r.status_avaliacao === "rejeitado").length;

  const renderStep = () => {
    switch (step) {
      // ── Etapa 1 ─────────────────────────────────────────────────────────────
      case 1: return (
        <StepCard
          title="Informações do processo"
          desc="Preencha os dados de identificação do processo licitatório."
          footer={<><span /><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <Grid2>
            <Field label="Número do processo *">
              <input className="inp" placeholder="Ex: 2026/00123" value={processo.numero} onChange={e => setProcesso({ ...processo, numero: e.target.value })} />
            </Field>
            <Field label="Órgão">
              <input className="inp inp-ro" value={processo.orgao} readOnly />
            </Field>
            <Field label="Unidade">
              <input className="inp" placeholder="Ex: SUPLAN/DILIC" value={processo.unidade} onChange={e => setProcesso({ ...processo, unidade: e.target.value })} />
            </Field>
            <Field label="Responsável">
              <input className="inp inp-ro" value={processo.responsavel} readOnly />
            </Field>
            <Field label="E-mail do responsável">
              <input type="email" className="inp inp-ro" value={processo.email} readOnly />
            </Field>
          </Grid2>
        </StepCard>
      );

      // ── Etapa 2 ─────────────────────────────────────────────────────────────
      case 2: return (
        <StepCard
          title="Objeto da contratação"
          desc="Descreva o objeto de forma clara. Essa descrição será usada para pesquisar preços e gerar a justificativa."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <Field label="Descrição do objeto (visão geral) *">
            <textarea
              className="inp min-h-[120px] resize-y"
              placeholder="Ex: Aquisição de notebooks para uso nas atividades administrativas da Diretoria de Logística..."
              value={objetoDesc}
              onChange={e => setObjetoDesc(e.target.value)}
            />
          </Field>
        </StepCard>
      );

      // ── Etapa 3 ─────────────────────────────────────────────────────────────
      case 3: return (
        <StepCard
          title="Especificação técnica"
          desc="Detalhe as características técnicas exigidas. A IA usará esses dados para calcular similaridade com preços encontrados."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <div className="space-y-2">
            {especificacao.map((esp, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg border border-slate-100 bg-slate-50">
                <div className="col-span-3">
                  <input className="inp text-sm" placeholder="Item (ex: Processador)" value={esp.item} onChange={e => updateEspec(idx, "item", e.target.value)} />
                </div>
                <div className="col-span-6">
                  <input className="inp text-sm" placeholder="Especificação técnica" value={esp.especificacao} onChange={e => updateEspec(idx, "especificacao", e.target.value)} />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id={`obr-${idx}`} checked={esp.obrigatorio} onChange={e => updateEspec(idx, "obrigatorio", e.target.checked)} className="accent-indigo-600" />
                  <label htmlFor={`obr-${idx}`} className="text-xs text-slate-500 cursor-pointer">Obrigatório</label>
                </div>
                <div className="col-span-1 flex justify-end">
                  <button type="button" onClick={() => removeEspec(idx)} className="p-1.5 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            {especificacao.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhuma especificação adicionada. Esta etapa é opcional mas melhora a qualidade da busca.</p>
            )}
          </div>
          <button type="button" onClick={addEspecificacao} className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold leading-none">+</span>
            Adicionar especificação
          </button>
        </StepCard>
      );

      // ── Etapa 4 ─────────────────────────────────────────────────────────────
      case 4: return (
        <StepCard
          title="Quantidade, parcelamento e local"
          desc="Informe a quantidade a ser contratada e o local de entrega. Esses dados afetam o cálculo do preço total."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Quantidade *">
              <input type="number" className="inp" placeholder="Ex: 50" value={quantidade === 0 ? "" : quantidade} onChange={e => setQuantidade(e.target.value === "" ? 0 : Number(e.target.value))} />
            </Field>
            <Field label="Unidade de medida">
              <select className="inp" value={unidadeMedida} onChange={e => setUnidadeMedida(e.target.value)}>
                <option value="">Selecione...</option>
                {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Forma de parcelamento">
              <select className="inp" value={formaParcelamento} onChange={e => setFormaParcelamento(e.target.value as FormaParcelamento | "")}>
                <option value="">Selecione...</option>
                <option value="item">Por item</option>
                <option value="lote">Por lote</option>
                <option value="global">Preço global</option>
              </select>
            </Field>
            <Field label="Local de entrega">
              <input className="inp" placeholder="Ex: Porto Velho/RO" value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} />
            </Field>
          </div>
          {formaParcelamento === "global" && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <strong>Atenção:</strong> No preço global, o valor total será calculado diretamente sem divisão por unidade.
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 5 ─────────────────────────────────────────────────────────────
      case 5: return (
        <StepCard
          title="Editais de fornecedores próximos"
          desc={`Consulte editais de fornecedores que atuam próximo ao local de entrega: ${localEntrega || "(não informado)"}`}
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <div className="mb-4">
            <Btn primary onClick={buscarEditais} icon={buscandoEditais ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />}>
              {buscandoEditais ? "Buscando..." : "Buscar fornecedores próximos"}
            </Btn>
          </div>
          {editaisProximos.length > 0 ? (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Fornecedor", "Objeto", "Local", "Data", "Edital"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editaisProximos.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{e.empresa}</td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-[220px] truncate" title={e.objeto}>{e.objeto}</td>
                      <td className="px-4 py-2.5 text-slate-600">
                        <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{e.local}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{e.data}</td>
                      <td className="px-4 py-2.5">
                        {e.link
                          ? <a href={e.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium"><ExternalLink className="w-3 h-3" /> Abrir</a>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            !buscandoEditais && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
                Clique em "Buscar fornecedores próximos" para consultar o mercado local.
              </div>
            )
          )}
        </StepCard>
      );

      // ── Etapa 6 ─────────────────────────────────────────────────────────────
      case 6: return (
        <StepCard
          title="Extração de características (IA)"
          desc="O agente IA analisa a descrição e as especificações e extrai os atributos técnicos para melhorar a busca."
          footer={!iaLoading && caracteristicasIA.length > 0 ? <><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></> : undefined}
        >
          {iaLoading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
              <p className="text-sm text-slate-500">A IA está analisando o objeto e as especificações técnicas...</p>
            </div>
          ) : caracteristicasIA.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">Clique em "Extrair com IA" para analisar o objeto.</p>
              {erroExtracao && (
                <div className="max-w-md text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-center">{erroExtracao}</div>
              )}
              <div className="flex gap-3">
                <Btn onClick={prevStep}>Voltar</Btn>
                <Btn primary onClick={extrairIA} icon={<Sparkles size={14}/>}>Extrair com IA</Btn>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Característica</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Valor extraído</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Confiança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {caracteristicasIA.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 capitalize text-slate-700 font-medium">{c.caracteristica}</td>
                      <td className="px-4 py-2.5 text-slate-600">{c.valor}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.confianca >= 80 ? "bg-green-100 text-green-700" : c.confianca >= 60 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                          {c.confianca}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 7 ─────────────────────────────────────────────────────────────
      case 7: return (
        <StepCard
          title="Revisão e confirmação"
          desc="Verifique os dados antes de avançar para a pesquisa de preços."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Confirmar e prosseguir</Btn></>}
        >
          <Grid2>
            <Field label="Processo"><input className="inp inp-ro" value={processo.numero} readOnly /></Field>
            <Field label="Órgão"><input className="inp inp-ro" value={processo.orgao} readOnly /></Field>
            <Field label="Responsável"><input className="inp inp-ro" value={processo.responsavel} readOnly /></Field>
            <Field label="E-mail"><input className="inp inp-ro" value={processo.email} readOnly /></Field>
            <Field label="Objeto resumido"><input className="inp inp-ro" value={`Aquisição de ${quantidade} ${unidadeMedida}(s)`} readOnly /></Field>
            <Field label="Parcelamento"><input className="inp inp-ro" value={formaParcelamento} readOnly /></Field>
          </Grid2>
          {caracteristicasIA.length > 0 && (
            <InfoBox color="indigo" className="mt-4">
              <strong>Características extraídas pela IA:</strong> {caracteristicasIA.map(c => c.valor).join(" · ")}
            </InfoBox>
          )}
          {especificacao.length > 0 && (
            <div className="mt-3 p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm">
              <strong className="text-slate-700">Especificações técnicas ({especificacao.length} itens):</strong>
              <ul className="mt-2 space-y-1 text-slate-600">
                {especificacao.map((e, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight size={14} className="mt-0.5 text-slate-400 shrink-0" />
                    <span><strong>{e.item}:</strong> {e.especificacao} <span className="text-slate-400">{e.obrigatorio ? "(obrigatório)" : "(desejável)"}</span></span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 8 ─────────────────────────────────────────────────────────────
      case 8: return (
        <StepCard
          title="Configurações da pesquisa"
          desc="Defina os parâmetros que controlam a busca e o cálculo do preço estimado."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={pesquisarPNCP} icon={<Search size={14}/>}>Pesquisar preços</Btn></>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Período">
              <select className="inp" value={config.periodo} onChange={e => setConfig({ ...config, periodo: e.target.value as PeriodoPesquisa })}>
                <option value="12_meses">Últimos 12 meses</option>
                <option value="6_meses">Últimos 6 meses</option>
                <option value="24_meses">Últimos 24 meses</option>
              </select>
            </Field>
            <Field label="Região">
              <select className="inp" value={config.regiao} onChange={e => setConfig({ ...config, regiao: e.target.value as RegiaoPesquisa })}>
                <option value="brasil">Todo o Brasil</option>
                <option value="centro_oeste">Centro-Oeste</option>
                <option value="sudeste">Sudeste</option>
                <option value="sul">Sul</option>
                <option value="nordeste">Nordeste</option>
                <option value="norte">Norte</option>
              </select>
            </Field>
            <Field label="Qtd. mínima de refs.">
              <input type="number" className="inp" value={config.qtdMin} onChange={e => setConfig({ ...config, qtdMin: Number(e.target.value) })} />
            </Field>
            <Field label="Método de cálculo">
              <select className="inp" value={config.metodo} onChange={e => setConfig({ ...config, metodo: e.target.value as MetodoCalculo })}>
                <option value="media_aritmetica">Média aritmética</option>
                <option value="mediana">Mediana</option>
                <option value="media_ponderada">Média ponderada</option>
                <option value="menor_preco">Menor preço</option>
              </select>
            </Field>
          </div>
        </StepCard>
      );

      // ── Etapa 9 ─────────────────────────────────────────────────────────────
      case 9: return (
        <StepCard title="Consultando fontes de preços" desc="">
          {pesquisando ? (
            <BuscaAnimada regiao={config.regiao} periodo={config.periodo} qtdMin={config.qtdMin} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-5">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700">Pesquisa não está em execução ou não retornou referências.</p>
                {erroPesquisa && <p className="text-xs text-slate-500 mt-2 max-w-md">{erroPesquisa}</p>}
              </div>
              <div className="flex gap-3">
                <Btn onClick={() => goToStep(10)}>Ver últimos resultados</Btn>
                <Btn primary onClick={pesquisarPNCP} icon={<Search size={14}/>}>Refazer pesquisa</Btn>
              </div>
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 10 ────────────────────────────────────────────────────────────
      case 10: return (
        <StepCard
          title="Resultados da pesquisa"
          desc={`${resultados.length} referências encontradas · ${nAceitos} aceitas · ${nRejeitados} rejeitadas`}
          footer={<><Btn onClick={() => goToStep(8)}>Voltar</Btn><Btn primary onClick={() => { calcular(); nextStep(); }} icon={<BarChart3 size={14}/>}>Calcular e analisar</Btn></>}
        >
          {resultados.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
              Nenhum resultado. Volte e refaça a pesquisa.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Órgão", "Descrição", "Qtd", "Data", "Valor unit.", "Fornecedor", "Local", "Sim.", "Edital", "Avaliação"].map(h => (
                      <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultados.map(r => (
                    <tr key={r.id} className={`transition-colors ${
                      r.status_avaliacao === "aceito"
                        ? "bg-green-50 hover:bg-green-100"
                        : r.status_avaliacao === "rejeitado"
                        ? "bg-red-50 opacity-60"
                        : "hover:bg-slate-50"
                    }`}>
                      <td className="px-3 py-2 max-w-[140px] truncate text-slate-700" title={r.orgao}>{r.orgao}</td>
                      <td className="px-3 py-2 max-w-[200px] truncate text-slate-600" title={r.descricao}>{r.descricao}</td>
                      <td className="px-3 py-2 text-slate-500">{r.quantidade ?? "—"}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">{r.data}</td>
                      <td className="px-3 py-2 font-mono font-medium text-slate-800 whitespace-nowrap">{formatarMoeda(r.valor_unitario ?? 0)}</td>
                      <td className="px-3 py-2 max-w-[160px] truncate text-slate-500" title={r.fornecedor}>{r.fornecedor || "—"}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap text-xs">{r.localizacao}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                          r.similaridade >= 80 ? "bg-green-100 text-green-700" :
                          r.similaridade >= 60 ? "bg-amber-100 text-amber-700" :
                          "bg-slate-100 text-slate-500"
                        }`}>{r.similaridade}%</span>
                      </td>
                      <td className="px-3 py-2">
                        {r.link_origem
                          ? <a href={r.link_origem} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium whitespace-nowrap"><ExternalLink className="w-3 h-3" /> Ver</a>
                          : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => avaliarResultado(r.id, "aceito")}
                            title="Aceitar"
                            className={`p-1 rounded border text-xs transition-colors ${r.status_avaliacao === "aceito" ? "bg-green-600 text-white border-green-600" : "border-green-400 text-green-600 hover:bg-green-100"}`}
                          ><Check size={13} /></button>
                          <button
                            type="button"
                            onClick={() => avaliarResultado(r.id, "rejeitado")}
                            title="Rejeitar"
                            className={`p-1 rounded border text-xs transition-colors ${r.status_avaliacao === "rejeitado" ? "bg-red-600 text-white border-red-600" : "border-red-400 text-red-600 hover:bg-red-100"}`}
                          ><X size={13} /></button>
                        </div>
                        {r.status_avaliacao === "rejeitado" && (
                          <input
                            className="mt-1 w-full text-xs px-2 py-1 rounded border border-slate-200 bg-white"
                            placeholder="Justificativa..."
                            value={r.justificativa_rejeicao || ""}
                            onChange={e => avaliarResultado(r.id, "rejeitado", e.target.value)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 11 ────────────────────────────────────────────────────────────
      case 11: return (
        <StepCard
          title="Análise da pesquisa (IA)"
          desc="O agente IA gera a justificativa técnica e valida a robustez estatística da amostra."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          {justificativaIA ? (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Justificativa gerada pela IA</p>
              {justificativaIA}
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm text-slate-500 py-8 px-4 rounded-lg bg-slate-50 border border-dashed border-slate-200">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              Gerando justificativa e validação...
            </div>
          )}
          {validacaoIA && (
            <div className={`mt-4 rounded-lg border p-4 ${validacaoIA.valido ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-center gap-2 mb-2">
                {validacaoIA.valido
                  ? <CheckCircle2 size={16} className="text-green-600" />
                  : <AlertCircle size={16} className="text-red-600" />}
                <p className={`text-sm font-semibold ${validacaoIA.valido ? "text-green-800" : "text-red-800"}`}>
                  Validação {validacaoIA.valido ? "aprovada" : "reprovada"} · score {validacaoIA.score_confianca}
                </p>
              </div>
              {(validacaoIA.alertas || []).map((a: any, i: number) => (
                <div key={i} className={`mt-1.5 text-xs px-3 py-1.5 rounded ${a.tipo === "erro" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  <strong>[{a.tipo}]</strong> {a.campo}: {a.mensagem} — <em>{a.sugestao}</em>
                </div>
              ))}
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 12 ────────────────────────────────────────────────────────────
      case 12: return (
        <StepCard
          title="Análise estatística"
          desc="Estatísticas calculadas com base nas referências aceitas."
          footer={<><Btn onClick={() => goToStep(10)}>Voltar</Btn><Btn primary onClick={nextStep} icon={<TrendingUp size={14}/>}>Gerar preço estimado</Btn></>}
        >
          {estatisticas ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <StatBox label="Referências" value={estatisticas.n.toString()} />
                <StatBox label="Média" value={formatarMoeda(estatisticas.media)} />
                <StatBox label="Mediana" value={formatarMoeda(estatisticas.mediana)} />
                <StatBox label="Mínimo" value={formatarMoeda(estatisticas.minimo)} />
                <StatBox label="Máximo" value={formatarMoeda(estatisticas.maximo)} />
                <StatBox label="Desvio padrão" value={estatisticas.desvioPadrao.toFixed(2).replace(".", ",")} />
                <StatBox label="CV" value={`${estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%`}
                  badge={estatisticas.coeficienteVariacao <= 15 ? "ok" : estatisticas.coeficienteVariacao <= 25 ? "warn" : "err"} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Memória de cálculo</p>
                <div className="font-mono text-xs text-slate-600 space-y-1">
                  <p>Referências aceitas: {estatisticas.n}</p>
                  <p>Valores: {resultados.filter(r => r.status_avaliacao === "aceito").map(r => formatarMoeda(r.valor_unitario ?? 0)).join(" | ")}</p>
                  <p>Média = {formatarMoeda(estatisticas.media)} · Mediana = {formatarMoeda(estatisticas.mediana)}</p>
                  <p>Mínimo = {formatarMoeda(estatisticas.minimo)} · Máximo = {formatarMoeda(estatisticas.maximo)}</p>
                  <p>Desvio padrão = {estatisticas.desvioPadrao.toFixed(2).replace(".", ",")} · CV = {estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%</p>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-400">
              Nenhum resultado aceito. Volte e aceite pelo menos um registro.
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 13 ────────────────────────────────────────────────────────────
      case 13: return (
        <StepCard
          title="Preço estimado"
          desc="Resultado final do cálculo com base nas referências aceitas."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={async () => { await salvarPesquisa(); nextStep(); }} icon={salvandoPesquisa ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}>{salvandoPesquisa ? "Salvando..." : "Salvar e avançar"}</Btn></>}
        >
          {precoEstimado ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 text-center">
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">Valor unitário estimado</p>
                  <p className="text-2xl font-bold text-indigo-700 tabular-nums">{formatarMoeda(precoEstimado.unitario)}</p>
                </div>
                <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 text-center">
                  <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-1">Valor total estimado</p>
                  <p className="text-2xl font-bold text-indigo-700 tabular-nums">{formatarMoeda(precoEstimado.total)}</p>
                  <p className="text-xs text-indigo-400 mt-1">{quantidade} {unidadeMedida}(s)</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Método aplicado</p>
                  <p className="text-base font-semibold text-slate-700">{config.metodo.replace(/_/g, " ")}</p>
                </div>
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800 leading-relaxed">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-1">Justificativa automática</p>
                {justificativaIA || `O preço foi formado com base em ${estatisticas?.n} registros do PNCP, utilizando o método da ${config.metodo.replace(/_/g, " ")}.`}
              </div>
              {validacaoIA && (
                <div className={`mt-3 rounded-lg border p-3 ${validacaoIA.valido ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                  <div className="flex items-center gap-2">
                    {validacaoIA.valido ? <CheckCircle2 size={14} className="text-green-600" /> : <AlertCircle size={14} className="text-red-600" />}
                    <p className={`text-sm font-medium ${validacaoIA.valido ? "text-green-700" : "text-red-700"}`}>
                      Validação {validacaoIA.valido ? "aprovada" : "reprovada"} · score {validacaoIA.score_confianca}
                    </p>
                  </div>
                  {!validacaoIA.valido && (validacaoIA.alertas || []).map((a: any, i: number) => (
                    <p key={i} className="mt-1 text-xs text-red-600 pl-6">{a.campo}: {a.mensagem}</p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-400">
              Aceite pelo menos um resultado para gerar o preço estimado.
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 14 ────────────────────────────────────────────────────────────
      case 14: return (
        <StepCard
          title="Documentos e evidências"
          desc="Registros e links das referências utilizadas na pesquisa."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<FileText size={14}/>}>Gerar relatório</Btn></>}
        >
          {pesquisaSalvaId && (
            <InfoBox color="green" className="mb-4">
              Pesquisa salva com sucesso · ID: <span className="font-mono">{pesquisaSalvaId.slice(0, 8)}</span>
            </InfoBox>
          )}
          {erroSalvamento && (
            <InfoBox color="red" className="mb-4">
              <strong>Erro ao salvar:</strong> {erroSalvamento}
            </InfoBox>
          )}
          <Grid2 className="mb-4">
            <Field label="Responsável pela pesquisa"><input className="inp inp-ro" value={processo.responsavel} readOnly /></Field>
            <Field label="E-mail"><input className="inp inp-ro" value={processo.email} readOnly /></Field>
          </Grid2>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Links das referências aceitas</p>
            {linksAceitos.length > 0 ? (
              <ul className="space-y-2">
                {linksAceitos.map((link, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    {link.url
                      ? <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 font-medium truncate">{link.nome}</a>
                      : <span className="text-slate-500">{link.nome}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Nenhuma referência aceita com link disponível.</p>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Evidências registradas automaticamente</p>
            <ul className="text-sm text-slate-600 space-y-1.5">
              {[
                `Registros consultados em ${new Date().toLocaleDateString("pt-BR")}`,
                `Processo: ${processo.numero}`,
                `Método de cálculo: ${config.metodo.replace(/_/g, " ")}`,
                `${nAceitos} referência(s) aceita(s) de ${resultados.length} consultada(s)`,
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check size={12} className="text-green-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </StepCard>
      );

      // ── Etapa 15 ────────────────────────────────────────────────────────────
      case 15: return (
        <StepCard
          title="Relatório final"
          desc="Exporte o relatório completo com memória de cálculo, fontes e justificativa."
          footer={<><Btn onClick={prevStep}>Voltar</Btn></>}
        >
          <InfoBox color="indigo" className="mb-6">
            Relatório pronto para exportação. Contém memória de cálculo, fontes, links das referências, estatísticas e justificativa do preço estimado.
          </InfoBox>
          <Grid2 className="mb-6">
            <Field label="Nome do arquivo PDF">
              <input className="inp" defaultValue={`estimativa_${processo.numero.replace("/", "_")}.pdf`} />
            </Field>
            <Field label="Nome do arquivo XLSX">
              <input className="inp" defaultValue={`estimativa_${processo.numero.replace("/", "_")}.xlsx`} />
            </Field>
          </Grid2>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-6 text-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Metadados incluídos no documento</p>
            <ul className="text-slate-600 space-y-1.5">
              {[
                `Responsável: ${processo.responsavel} (${processo.email})`,
                `Processo: ${processo.numero} · Órgão: ${processo.orgao}`,
                `Links das referências aceitas no PNCP`,
                `Memória de cálculo completa`,
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check size={12} className="text-green-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { const bytes = gerarXLSX(relatorioData); downloadXLSX(bytes, `estimativa_${processo.numero.replace("/", "_")}.xlsx`); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Baixar XLSX
            </button>
            <PDFDownloadLink
              document={<RelatorioPDFDocument {...relatorioData} />}
              fileName={`estimativa_${processo.numero.replace("/", "_")}.pdf`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Baixar PDF
            </PDFDownloadLink>
          </div>
        </StepCard>
      );

      default: return null;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Cabeçalho */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
            <span>Pesquisas</span>
            <ChevronRight size={12} />
            <span className="text-slate-600 font-medium">Nova pesquisa de preços</span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-800">Nova pesquisa de preços</h1>
          <p className="text-sm text-slate-500 mt-1">Estimativa baseada em dados públicos · Lei 14.133/2021</p>
        </div>

        {/* Stepper por fases */}
        <div className="mb-8">
          <div className="flex items-stretch gap-0 rounded-xl overflow-hidden border border-slate-200 bg-white shadow-sm">
            {FASES.map((fase, fi) => {
              const isAtual = fi === faseAtual;
              const isConcluida = fi < faseAtual;
              const Icon = fase.icon;
              return (
                <button
                  key={fi}
                  type="button"
                  onClick={() => goToStep(fase.steps[0])}
                  className={`flex-1 flex flex-col items-center gap-1.5 px-3 py-3.5 text-xs font-medium transition-colors border-r border-slate-200 last:border-r-0 ${
                    isAtual
                      ? "bg-indigo-600 text-white"
                      : isConcluida
                      ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                      : "bg-white text-slate-400 hover:bg-slate-50"
                  }`}
                >
                  <Icon size={16} />
                  <span>{fase.nome}</span>
                  {isConcluida && <span className="text-[10px] opacity-70">✓ Concluído</span>}
                  {isAtual && <span className="text-[10px] opacity-80">Etapa {step}/{totalSteps}</span>}
                </button>
              );
            })}
          </div>

          {/* Barra de progresso */}
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap shrink-0">
              {step}/{totalSteps} · {STEP_NAMES[step]}
            </span>
          </div>
        </div>

        {/* Conteúdo do step */}
        {renderStep()}
      </div>
    </div>
  );
}

// ─── Componentes de UI ────────────────────────────────────────────────────────

const MENSAGENS_BUSCA = [
  "Consultando Compras.gov.br (Dados Abertos)...",
  "Buscando preços por código PDM...",
  "Analisando referências de preço encontradas...",
  "Filtrando por similaridade com o objeto...",
  "Cruzando dados de múltiplas fontes...",
  "Verificando preços dos últimos meses...",
  "Calculando índices de similaridade...",
  "Organizando resultados por relevância...",
  "Validando referências de preço...",
  "Quase pronto, aguarde mais um instante...",
];

function BuscaAnimada({ regiao, periodo, qtdMin }: { regiao: string; periodo: string; qtdMin: number }) {
  const [idx, setIdx] = React.useState(0);
  const [fade, setFade] = React.useState(true);
  const [progresso, setProgresso] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % MENSAGENS_BUSCA.length);
        setFade(true);
      }, 300);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  React.useEffect(() => {
    const start = Date.now();
    const duration = 90_000; // assume ~90s max
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgresso(Math.min(95, (elapsed / duration) * 100));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-6">
      {/* Ícone animado */}
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-indigo-50 flex items-center justify-center">
          <Loader2 className="w-9 h-9 animate-spin text-indigo-600" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-indigo-200 animate-ping opacity-30" />
      </div>

      {/* Mensagem rotativa */}
      <div className="text-center min-h-[48px] flex flex-col items-center justify-center gap-1">
        <p
          className="text-sm font-medium text-slate-700 transition-opacity duration-300"
          style={{ opacity: fade ? 1 : 0 }}
        >
          {MENSAGENS_BUSCA[idx]}
        </p>
        <p className="text-xs text-slate-400 font-mono">{regiao} · {periodo} · mín. {qtdMin} refs.</p>
      </div>

      {/* Barra de progresso */}
      <div className="w-72">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="text-center text-xs text-slate-400 mt-2">Pesquisa em andamento — não feche a página</p>
      </div>
    </div>
  );
}

function StepCard({
  title, desc, children, footer,
}: {
  title: string; desc: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
        {desc && <p className="text-sm text-slate-500 mt-0.5">{desc}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          {footer}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function Grid2({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>{children}</div>;
}

function Btn({
  children, onClick, primary, icon,
}: {
  children: React.ReactNode; onClick?: () => void; primary?: boolean; icon?: React.ReactNode;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border";
  const style = primary
    ? "bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700"
    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50";
  return (
    <button type="button" onClick={onClick} className={`${base} ${style}`}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

function StatBox({ label, value, badge }: { label: string; value: string; badge?: "ok" | "warn" | "err" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
      <span className="block text-lg font-bold tabular-nums text-slate-800">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
      {badge && (
        <span className={`block mt-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
          badge === "ok" ? "bg-green-100 text-green-600" :
          badge === "warn" ? "bg-amber-100 text-amber-600" :
          "bg-red-100 text-red-600"
        }`}>
          {badge === "ok" ? "CV OK" : badge === "warn" ? "CV alto" : "CV crítico"}
        </span>
      )}
    </div>
  );
}

function InfoBox({ children, color = "slate", className = "" }: { children: React.ReactNode; color?: "indigo" | "green" | "red" | "amber" | "slate"; className?: string }) {
  const colors = {
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-800",
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-lg border p-3 text-sm ${colors[color]} ${className}`}>
      {children}
    </div>
  );
}
