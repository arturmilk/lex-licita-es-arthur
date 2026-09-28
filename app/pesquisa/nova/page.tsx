"use client";

import React, { useState, useCallback } from "react";
import {
  Loader2, AlertCircle, Check, X, ExternalLink, MapPin,
  FileSearch, ChevronRight, ChevronDown, Sparkles, BarChart3, FileText,
  ClipboardList, Search, CheckCircle2, TrendingUp, RefreshCw, Calculator,
} from "lucide-react";
import { calcularEstatisticas, calcularPrecoEstimado, formatarMoeda, calcularComRegraCv } from "@/lib/math";
import { analisarReferencias, type ResultadoAnaliseCritica } from "@/lib/analise-critica";
import { useDialogos } from "@/components/Dialogos";
import { gerarXLSX, downloadXLSX } from "@/lib/xlsx-generator";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPDFDocument } from "@/lib/pdf-generator";
import { criarProcesso, criarPesquisa, salvarResultadosPesquisa, atualizarPesquisa, historicoOrgao } from "@/lib/actions";

type MetodoCalculo = "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
type PeriodoPesquisa = "90_dias" | "6_meses" | "12_meses" | "24_meses";
type RegiaoPesquisa = "brasil" | "centro_oeste" | "sudeste" | "sul" | "nordeste" | "norte";
type StatusAvaliacao = "pendente" | "aceito" | "rejeitado";
type FormaParcelamento = "item" | "lote" | "global";

interface SubItem {
  id: string;
  descricao: string;
  especificacao: string;
  quantidade: number;
  unidadeMedida: string;
  itemEdital?: string;
}

interface ItemPesquisa {
  id: string;
  descricao: string;         // nome do lote (quando formaParcelamento==="lote")
  especificacao: string;
  quantidade: number;
  unidadeMedida: string;
  itemEdital?: string;
  obrigatorio?: boolean;
  subitens?: SubItem[];      // itens dentro do lote (só usado em modo lote)
}

interface RegistroMercado {
  id: string;
  itemId: string;
  fornecedor: string;
  cnpj: string;
  fonte: string;
  valor: number;
  data: string;
  observacao?: string;
}

type TipoCusto = "insumo" | "mao_de_obra" | "encargo" | "bdi" | "outro";

interface CustoComposicao {
  id: string;
  tipo: TipoCusto;
  descricao: string;
  unidade?: string;
  quantidade?: number;
  custoUnitario?: number;   // insumo / mão de obra
  percentual?: number;      // encargos / BDI
}

interface ComposicaoItem {
  id: string;
  itemId: string;
  nome: string;
  custos: CustoComposicao[];
}

interface ResultadoPNCP {
  id: string; fonte: string; orgao: string; descricao: string; quantidade: number | null; data: string;
  valor_unitario: number | null; valor_total: number | null; localizacao: string | null;
  similaridade: number; documento_origem: string; link_origem: string;
  fornecedor?: string; status_avaliacao: StatusAvaliacao; justificativa_rejeicao?: string;
  itemId?: string; cnpj?: string; fonte_dados?: string;
  dadosBrutos?: Record<string, unknown>;
}

interface CatalogoOpcaoUI {
  tipo: "CATMAT" | "CATSER";
  codigo: number;
  descricao: string;
  pdm?: number | null;
  nomePdm?: string;
  principal: boolean;
  confianca: "alta" | "media" | "baixa";
  nota: string;
  requisitosComparados: number;
  diferencas?: string[];
}

interface CatalogoItemState {
  opcoes: CatalogoOpcaoUI[];
  selecionado?: number;
  carregando?: boolean;
  desatualizado?: boolean;
  alerta?: string | null;
  erro?: string | null;
  estimativaPreliminar?: any;
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
// ─── Fases do wizard ──────────────────────────────────────────────────────────
// 4 "momentos" na cabeça do usuário (em vez de 5 blocos técnicos).
const FASES = [
  { nome: "Preparar",         icon: ClipboardList, steps: [1, 2, 3, 4] },
  { nome: "Precificação",     icon: Search,        steps: [5, 6, 7, 8] },
  { nome: "Conferir preços",  icon: BarChart3,     steps: [9, 10, 11, 12] },
  { nome: "Fechar relatório", icon: FileText,      steps: [13, 14, 15, 16] },
];

const STEP_NAMES: Record<number, string> = {
  1: "Objeto e parcelamento", 2: "Itens da contratação", 3: "Informações do processo",
  4: "Preços que você já tem", 5: "Buscar nas fontes oficiais",
  6: "Revisão", 7: "Ajustes da pesquisa", 8: "Buscar preços",
  9: "Resultados", 10: "Análise automática", 11: "Resumo dos preços",
  12: "Preço estimado", 13: "Metodologia do cálculo", 14: "Detalhamento de custos",
  15: "Comprovações", 16: "Relatório final",
};


const GUIA_STEP: Record<number, { pergunta: string; orientacao: string }> = {
  1: { pergunta: "O que exatamente você precisa pesquisar?", orientacao: "Conte do seu jeito. O LEX identifica objeto, parcelamento, local, itens, quantidades e unidades quando essas informações estiverem claras." },
  2: { pergunta: "Os itens ou lotes representam corretamente o que será comprado ou contratado?", orientacao: "Confira descrição, especificação, quantidade e unidade. Quanto mais comparável estiver o item, melhor será a pesquisa." },
  3: { pergunta: "Qual processo administrativo está dando origem a esta pesquisa?", orientacao: "Complete somente a identificação do processo. O órgão e o responsável já são aproveitados do cadastro quando disponíveis." },
  4: { pergunta: "Você já tem cotações, notas, propostas ou preços coletados fora das bases públicas?", orientacao: "Registre aqui as referências manuais. Elas continuam separadas, rastreáveis e entram no relatório com fonte e CNPJ." },
  5: { pergunta: "Pronto para consultar as fontes públicas?", orientacao: "O LEX prepara termos de busca por item e consulta as fontes disponíveis sem apagar as referências manuais." },
  6: { pergunta: "Foi isso que você quis pesquisar?", orientacao: "Revise o que a IA extraiu e confirme os itens. Esta é a hora de corrigir qualquer interpretação antes da coleta de preços." },
  7: { pergunta: "Como a pesquisa deve ser comparada?", orientacao: "Defina período, região, quantidade mínima de referências, método estatístico e limite de variação. O LEX mantém os padrões quando você não pedir mudança." },
  8: { pergunta: "Quer ajustar algum parâmetro antes da busca?", orientacao: "Faça o último ajuste de abrangência. Depois o LEX pesquisa e organiza os resultados por relevância." },
  9: { pergunta: "Quais referências realmente são comparáveis ao seu objeto?", orientacao: "Aceite, rejeite, filtre e ordene. A IA ajuda a priorizar, mas a decisão fica visível e auditável." },
  10: { pergunta: "Quer que o LEX escreva a justificativa técnica da amostra?", orientacao: "A IA usa somente as referências e estatísticas calculadas. Você pode revisar a análise antes de seguir." },
  11: { pergunta: "A amostra está consistente?", orientacao: "Confira média, mediana, mínimo, máximo, desvio padrão e coeficiente de variação antes de gerar a estimativa." },
  12: { pergunta: "Qual é a estimativa resultante?", orientacao: "Aqui o LEX mostra valor unitário, valor total, método efetivamente aplicado e os alertas que influenciaram o cálculo." },
  13: { pergunta: "Como a metodologia deve aparecer no relatório?", orientacao: "Revise tendência central, parâmetros estatísticos e tratamento de ME/EPP sem perder a memória de cálculo já formada." },
  14: { pergunta: "Esta contratação precisa de composição ou decomposição de custos?", orientacao: "Quando aplicável, detalhe insumos, mão de obra, encargos, BDI e outros custos para comparar a composição com o mercado." },
  15: { pergunta: "As evidências da pesquisa estão completas?", orientacao: "Confira links, registros e documentos que demonstram de onde vieram os preços usados na estimativa." },
  16: { pergunta: "Pronto para fechar a pesquisa?", orientacao: "Exporte o relatório final em PDF e a planilha XLSX com memória de cálculo, fontes, estatísticas, justificativas e evidências." },
};

export default function NovaPesquisaPage() {
  const { avisar } = useDialogos();
  const [step, setStep] = useState(1);
  const totalSteps = 16;
  const [processo, setProcesso] = useState({ numero: "", orgao: "", unidade: "", responsavel: "", email: "" });
  const [objetoDesc, setObjetoDesc] = useState("");
  const [itens, setItens] = useState<ItemPesquisa[]>([]);
  const [quantidade, setQuantidade] = useState(0);
  const [unidadeMedida, setUnidadeMedida] = useState("");
  const [formaParcelamento, setFormaParcelamento] = useState<FormaParcelamento | "">("");
  const [localEntrega, setLocalEntrega] = useState("");
  const [pesquisaMercado, setPesquisaMercado] = useState<RegistroMercado[]>([]);
  const [parametrosRelatorio, setParametrosRelatorio] = useState({
    exibirMedia: true, exibirDesvio: true, exibirMaximo: true, exibirMinimo: true,
  });
  const [meEpp, setMeEpp] = useState<{ aplicar: boolean; tipo: "exclusividade" | "reserva_25" }>({
    aplicar: true, tipo: "exclusividade",
  });
  const [decomposicaoCustos, setDecomposicaoCustos] = useState<ComposicaoItem[]>([]);
  const [erroExtracao, setErroExtracao] = useState<string | null>(null);
  const [pedidoGuiado, setPedidoGuiado] = useState("");
  const [interpretandoGuiado, setInterpretandoGuiado] = useState(false);
  const [resultadoGuiado, setResultadoGuiado] = useState<any | null>(null);
  const [erroGuiado, setErroGuiado] = useState<string | null>(null);
  const [catalogoPorItem, setCatalogoPorItem] = useState<Record<string, CatalogoItemState>>({});

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

  const [iaLoading, setIaLoading] = useState(false);
  const [pesquisaSalvaId, setPesquisaSalvaId] = useState<string | null>(null);
  const [salvandoPesquisa, setSalvandoPesquisa] = useState(false);
  const [erroSalvamento, setErroSalvamento] = useState<string | null>(null);
  const [caracteristicasIA, setCaracteristicasIA] = useState<{ caracteristica: string; valor: string; confianca: number }[]>([]);
  const [config, setConfig] = useState({ periodo: "12_meses" as PeriodoPesquisa, regiao: "brasil" as RegiaoPesquisa, qtdMin: 5, metodo: "media_aritmetica" as MetodoCalculo, cvLimite: 20 });
  const [pesquisando, setPesquisando] = useState(false);
  const [erroPesquisa, setErroPesquisa] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoPNCP[]>([]);
  const [estatisticas, setEstatisticas] = useState<ReturnType<typeof calcularEstatisticas> | null>(null);
  const [alertaCv, setAlertaCv] = useState<{ cv: number; limite: number; metodoEfetivo: string } | null>(null);
  const [precoEstimado, setPrecoEstimado] = useState<{ unitario: number; total: number } | null>(null);
  const [metodoEfetivo, setMetodoEfetivo] = useState<MetodoCalculo | null>(null);
  const [justificativaIA, setJustificativaIA] = useState<string | null>(null);
  const [validacaoIA, setValidacaoIA] = useState<any | null>(null);
  const [analiseCritica, setAnaliseCritica] = useState<ResultadoAnaliseCritica | null>(null);
  const [historicoOrgaoRows, setHistoricoOrgaoRows] = useState<any[] | null>(null);
  const [itemFiltro, setItemFiltro] = useState<string>("todos");
  const [situFiltro, setSituFiltro] = useState<"todos" | "abertos" | "encerrados" | "ia">("todos");
  const [paginaPorItem, setPaginaPorItem] = useState<Record<string, number>>({});
  const [totalPorItem, setTotalPorItem] = useState<Record<string, number>>({});
  const [totalPagsPorItem, setTotalPagsPorItem] = useState<Record<string, number>>({});
  const [termoPorItem, setTermoPorItem] = useState<Record<string, string>>({});
  const [iaAnalisando, setIaAnalisando] = useState(false);
  const [iaFiltroReady, setIaFiltroReady] = useState(false);
  const [textoFiltro, setTextoFiltro] = useState("");
  const [regiaoFiltro, setRegiaoFiltro] = useState("todas");
  const [parametrosBusca, setParametrosBusca] = useState<{ rotulo: string; termo: string; filtros: string; parametros: string }[] | null>(null);
  const [filtrosPorItem, setFiltrosPorItem] = useState<Record<string, string>>({});
  // ── AGENTE PESQUISADOR: progresso por item (multi-itens simultâneos) ──
  const [progressoItens, setProgressoItens] = useState<Record<string, { status: "buscando" | "ok" | "falha"; total?: number; erro?: string }>>({});
  const [refazendoItem, setRefazendoItem] = useState<string | null>(null);
  const [ordenacao, setOrdenacao] = useState<"relevancia" | "valor_asc" | "valor_desc" | "data_desc">("relevancia");

  // Período  dias (usado tanto na 1ª busca quanto na paginação)
  const PERIODO_DIAS: Record<string, number> = {
    "90_dias": 90,
    "6_meses": 180,
    "12_meses": 365,
    "24_meses": 730,
  };
  const limiteDias = PERIODO_DIAS[config.periodo] ?? 365;
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [erroPaginacao, setErroPaginacao] = useState<string | null>(null);
  const [erroStep1, setErroStep1] = useState<string | null>(null);

  const nextStep = useCallback(() => setStep(s => Math.min(s + 1, totalSteps)), []);
  const prevStep = useCallback(() => setStep(s => Math.max(s - 1, 1)), []);
  const goToStep = useCallback((s: number) => { if (s >= 1 && s <= totalSteps) setStep(s); }, []);


  React.useEffect(() => {
    if (formaParcelamento === "lote") {
      // Lotes podem reunir unidades incompatíveis; não força um quantitativo global artificial.
      setQuantidade(0);
      setUnidadeMedida("");
      return;
    }
    const validos = itens.filter(i => i.quantidade > 0 && i.unidadeMedida);
    if (validos.length === 0) {
      setQuantidade(0);
      setUnidadeMedida("");
      return;
    }
    const unidades = Array.from(new Set(validos.map(i => i.unidadeMedida.trim().toLowerCase())));
    if (unidades.length === 1) {
      setQuantidade(validos.reduce((soma, i) => soma + i.quantidade, 0));
      setUnidadeMedida(validos[0].unidadeMedida);
    } else {
      // Unidades diferentes devem ser estimadas por item; evita somar grandezas incompatíveis.
      setQuantidade(0);
      setUnidadeMedida("");
    }
  }, [itens, formaParcelamento]);
  // Volta para a etapa de Resultados (9) para aceitar referências
  const nextStepToResultados = useCallback(() => setStep(9), []);

  // ── AGENTE PESQUISADOR: refaz a busca de UM item específico (sem refazer os outros) ──
  const refazerItem = async (itemId: string) => {
    setRefazendoItem(itemId);
    setProgressoItens(prev => ({ ...prev, [itemId]: { status: "buscando" } }));
    try {
      const termo = termoPorItem[itemId] || objetoDesc;
      const TAM = 50;
      const resp = await fetch(`/api/pncp?termo=${encodeURIComponent(termo)}&fontes=pncp,compras_gov,contratos_govbr&tamanhoPagina=${TAM}`, { signal: AbortSignal.timeout(40_000) });
      const data = await resp.json().catch(() => null);
      const items: any[] = data?.items || [];
      const total: number = data?.total ?? items.length;
      const novos: ResultadoPNCP[] = items.map((it, idx) => ({
        id: `${itemId}-${idx}`,
        fonte: it.fonte || "pncp",
        itemId,
        orgao: it.orgao || "Órgão público",
        descricao: it.descricao || "",
        quantidade: it.quantidade ?? null,
        data: it.dataContrato || "",
        valor_unitario: it.valorUnitario ?? null,
        valor_total: it.valorTotal ?? null,
        localizacao: it.localizacao || "",
        similaridade: it.similaridade ?? 0,
        documento_origem: it.documentoOrigem || "",
        link_origem: it.linkEdital || "",
        status_avaliacao: "pendente" as const,
        dadosBrutos: it.dadosBrutos || {},
      }));
      setResultados(prev => [...prev.filter(r => r.itemId !== itemId), ...novos]);
      setTotalPorItem(prev => ({ ...prev, [itemId]: total }));
      setTotalPagsPorItem(prev => ({ ...prev, [itemId]: Math.max(1, Math.ceil(total / TAM)) }));
      setPaginaPorItem(prev => ({ ...prev, [itemId]: 1 }));
      setProgressoItens(prev => ({ ...prev, [itemId]: { status: "ok", total } }));
    } catch {
      setProgressoItens(prev => ({ ...prev, [itemId]: { status: "falha", erro: "Falha na conexão" } }));
    } finally {
      setRefazendoItem(null);
    }
  };

  // ── Itens (acordeão) ────────────────────────────────────────────────────────
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const [expandidoRes, setExpandidoRes] = useState<Record<string, boolean>>({});

  const addItem = () => {
    const novo: ItemPesquisa = {
      id: crypto.randomUUID(), descricao: "", especificacao: "",
      quantidade: 1, unidadeMedida: "", obrigatorio: true,
    };
    setItens([...itens, novo]);
    setExpandido(e => ({ ...e, [novo.id]: true }));
  };
  const updateItem = (idx: number, field: keyof ItemPesquisa, value: string | number | boolean) => {
    const novo = [...itens];
    (novo[idx] as unknown as Record<string, unknown>)[field] = value;
    setItens(novo);
    if (field === "descricao" || field === "especificacao") {
      const id = novo[idx]?.id;
      if (id) setCatalogoPorItem(prev => prev[id] ? ({ ...prev, [id]: { ...prev[id], desatualizado: true } }) : prev);
    }
  };
  const removeItem = (idx: number) => {
    const removido = itens[idx];
    setItens(itens.filter((_, i) => i !== idx));
    if (removido) {
      setExpandido(e => { const n = { ...e }; delete n[removido.id]; return n; });
      setCatalogoPorItem(prev => { const n = { ...prev }; delete n[removido.id]; return n; });
    }
  };

  const buscarCatalogoParaItem = async (item: ItemPesquisa | SubItem) => {
    if (!item?.id || item.descricao.trim().length < 3) return;
    setCatalogoPorItem(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || { opcoes: [] }), carregando: true, erro: null, desatualizado: false } }));
    try {
      const resp = await fetch("/api/catalogo/sugestoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: item.descricao,
          especificacao: item.especificacao,
          quantidade: item.quantidade || null,
          unidade: item.unidadeMedida || null,
          localEntrega: localEntrega || null,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Falha ao consultar o catálogo oficial.");
      const opcoes: CatalogoOpcaoUI[] = Array.isArray(data.opcoes) ? data.opcoes : [];
      setCatalogoPorItem(prev => ({
        ...prev,
        [item.id]: {
          opcoes,
          selecionado: Number(data.principalCodigo) || opcoes[0]?.codigo,
          carregando: false,
          desatualizado: false,
          alerta: data.alerta || null,
          estimativaPreliminar: data.estimativaPreliminar || null,
        },
      }));
    } catch (e: any) {
      setCatalogoPorItem(prev => ({ ...prev, [item.id]: { ...(prev[item.id] || { opcoes: [] }), carregando: false, erro: String(e?.message || e), desatualizado: false } }));
    }
  };

  const buscarCatalogosParaItens = async (lista: ItemPesquisa[]) => {
    const alvos = lista.filter(i => i.descricao.trim().length >= 3).slice(0, 12);
    await Promise.allSettled(alvos.map(buscarCatalogoParaItem));
  };

  const selecionarCatalogo = (itemId: string, codigo: number) => {
    setCatalogoPorItem(prev => prev[itemId] ? ({ ...prev, [itemId]: { ...prev[itemId], selecionado: codigo, desatualizado: false } }) : prev);
  };

  // ── Sub-itens do lote ────────────────────────────────────────────────────────
  const addSubItem = (loteIdx: number) => {
    const novo = [...itens];
    const subNovo: SubItem = { id: crypto.randomUUID(), descricao: "", especificacao: "", quantidade: 1, unidadeMedida: "" };
    novo[loteIdx] = { ...novo[loteIdx], subitens: [...(novo[loteIdx].subitens || []), subNovo] };
    setItens(novo);
  };
  const updateSubItem = (loteIdx: number, subIdx: number, field: keyof SubItem, value: string | number) => {
    const novo = [...itens];
    const subs = [...(novo[loteIdx].subitens || [])];
    (subs[subIdx] as unknown as Record<string, unknown>)[field] = value;
    novo[loteIdx] = { ...novo[loteIdx], subitens: subs };
    setItens(novo);
    if (field === "descricao" || field === "especificacao") {
      const id = subs[subIdx]?.id;
      if (id) setCatalogoPorItem(prev => prev[id] ? ({ ...prev, [id]: { ...prev[id], desatualizado: true } }) : prev);
    }
  };
  const removeSubItem = (loteIdx: number, subIdx: number) => {
    const novo = [...itens];
    const removido = (novo[loteIdx].subitens || [])[subIdx];
    novo[loteIdx] = { ...novo[loteIdx], subitens: (novo[loteIdx].subitens || []).filter((_, i) => i !== subIdx) };
    setItens(novo);
    if (removido) setCatalogoPorItem(prev => { const n = { ...prev }; delete n[removido.id]; return n; });
  };

  // ── Pesquisa de mercado (manual) ────────────────────────────────────────────
  const addRegistroMercado = () => {
    const alvo = formaParcelamento === "global" ? "global" : (itens[0]?.id || "");
    setPesquisaMercado([...pesquisaMercado, {
      id: crypto.randomUUID(), itemId: alvo, fornecedor: "", cnpj: "",
      fonte: "", valor: 0, data: new Date().toISOString().slice(0, 10), observacao: "",
    }]);
  };
  const updateRegistroMercado = (idx: number, field: keyof RegistroMercado, value: string | number) => {
    const novo = [...pesquisaMercado];
    (novo[idx] as unknown as Record<string, unknown>)[field] = value;
    setPesquisaMercado(novo);
  };
  const removeRegistroMercado = (idx: number) => setPesquisaMercado(pesquisaMercado.filter((_, i) => i !== idx));

  // ── Decomposição de custos ──────────────────────────────────────────────────
  const addComposicao = (itemId: string) => {
    setDecomposicaoCustos([...decomposicaoCustos, {
      id: crypto.randomUUID(), itemId, nome: "", custos: [],
    }]);
  };
  const updateComposicao = (idx: number, field: "nome", value: string) => {
    const novo = [...decomposicaoCustos];
    novo[idx] = { ...novo[idx], [field]: value };
    setDecomposicaoCustos(novo);
  };
  const addCusto = (compIdx: number) => {
    const novo = [...decomposicaoCustos];
    novo[compIdx] = {
      ...novo[compIdx],
      custos: [...novo[compIdx].custos, { id: crypto.randomUUID(), tipo: "insumo" as TipoCusto, descricao: "", unidade: "un", quantidade: 1, custoUnitario: 0 }],
    };
    setDecomposicaoCustos(novo);
  };
  const updateCusto = (compIdx: number, custoIdx: number, field: keyof CustoComposicao, value: string | number) => {
    const novo = [...decomposicaoCustos];
    const custos = [...novo[compIdx].custos];
    (custos[custoIdx] as unknown as Record<string, unknown>)[field] = value;
    novo[compIdx] = { ...novo[compIdx], custos };
    setDecomposicaoCustos(novo);
  };
  const removeCusto = (compIdx: number, custoIdx: number) => {
    const novo = [...decomposicaoCustos];
    novo[compIdx] = { ...novo[compIdx], custos: novo[compIdx].custos.filter((_, i) => i !== custoIdx) };
    setDecomposicaoCustos(novo);
  };
  const removerComposicao = (compIdx: number) => setDecomposicaoCustos(decomposicaoCustos.filter((_, i) => i !== compIdx));

  // Cálculo de uma composição: insumos + mão de obra (com encargos) + BDI
  const calcularComposicao = (comp: ComposicaoItem) => {
    let insumos = 0, maoObra = 0, encargos = 0, bdi = 0;
    for (const c of comp.custos) {
      if (c.tipo === "insumo") insumos += (c.custoUnitario || 0) * (c.quantidade || 1);
      if (c.tipo === "mao_de_obra") maoObra += (c.custoUnitario || 0) * (c.quantidade || 1);
      if (c.tipo === "encargo") encargos += c.percentual || 0;
      if (c.tipo === "bdi") bdi += c.percentual || 0;
      if (c.tipo === "outro") insumos += (c.custoUnitario || 0) * (c.quantidade || 1);
    }
    const subtotal = insumos + maoObra * (1 + encargos / 100);
    const total = subtotal * (1 + bdi / 100);
    return { insumos, maoObra, encargos, bdi, subtotal, total };
  };

  const extrairIA = async () => {
    setIaLoading(true);
    try {
      // Compatibilidade com o agente extrator: especificacoes no formato antigo
      const especificacoesLegado = itens
        .filter(i => i.descricao || i.especificacao)
        .map(i => ({ item: i.descricao, especificacao: i.especificacao, obrigatorio: i.obrigatorio ?? true }));
      const res = await fetch("/api/ia/extracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao: objetoDesc, especificacoes: especificacoesLegado, itens }),
      });
      const data = await res.json();
      if (data.caracteristicas && data.caracteristicas.length > 0) {
        setErroExtracao(null);
        // inclui palavras_chave_busca como primeiras características para enriquecer a busca
        const extras = (data.palavras_chave_busca || []).map((kw: string, i: number) => ({
          caracteristica: `palavra_chave_${i + 1}`, valor: kw, confianca: 88,
        }));
        setCaracteristicasIA([
          ...extras,
          ...data.caracteristicas.map((c: any) => ({ caracteristica: c.nome, valor: c.valor, confianca: c.confianca })),
        ]);
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
  };

  const interpretarPedidoGuiado = async () => {
    if (pedidoGuiado.trim().length < 8 || interpretandoGuiado) return;
    setInterpretandoGuiado(true);
    setErroGuiado(null);
    setResultadoGuiado(null);
    try {
      const resp = await fetch("/api/ia/pesquisa-guiada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pedido: pedidoGuiado,
          contexto: {
            objeto: objetoDesc || null,
            formaParcelamento: formaParcelamento || null,
            localEntrega: localEntrega || null,
            itens: itens.map(i => ({ descricao: i.descricao, especificacao: i.especificacao, quantidade: i.quantidade || null, unidadeMedida: i.unidadeMedida || null })),
            processo: { numero: processo.numero || null, unidade: processo.unidade || null },
            parametros: config,
          },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || "Não consegui interpretar a solicitação.");

      if (data.objeto && !objetoDesc.trim()) setObjetoDesc(data.objeto);
      if (data.formaParcelamento && !formaParcelamento) setFormaParcelamento(data.formaParcelamento);
      if (data.localEntrega && !localEntrega.trim()) setLocalEntrega(data.localEntrega);
      if (data.processo?.numero && !processo.numero.trim()) setProcesso(p => ({ ...p, numero: data.processo.numero }));
      if (data.processo?.unidade && !processo.unidade.trim()) setProcesso(p => ({ ...p, unidade: data.processo.unidade }));

      if (Array.isArray(data.itens) && data.itens.length > 0 && itens.length === 0) {
        const novos: ItemPesquisa[] = data.itens.map((i: any) => ({
          id: crypto.randomUUID(),
          descricao: i.descricao || "",
          especificacao: i.especificacao || "",
          quantidade: Number(i.quantidade) > 0 ? Number(i.quantidade) : 0,
          unidadeMedida: i.unidadeMedida || "",
          itemEdital: i.itemEdital || "",
          obrigatorio: i.obrigatorio !== false,
          subitens: [],
        }));
        setItens(novos);
        setExpandido(Object.fromEntries(novos.map(i => [i.id, true])));
        void buscarCatalogosParaItens(novos);
      }

      if (data.parametros) {
        setConfig(c => ({
          ...c,
          periodo: data.parametros.periodo || c.periodo,
          regiao: data.parametros.regiao || c.regiao,
          qtdMin: data.parametros.qtdMin || c.qtdMin,
          metodo: data.parametros.metodo || c.metodo,
          cvLimite: data.parametros.cvLimite || c.cvLimite,
        }));
      }

      if (Array.isArray(data.cotacoes) && data.cotacoes.length > 0 && pesquisaMercado.length === 0) {
        setPesquisaMercado(data.cotacoes.map((c: any) => ({
          id: crypto.randomUUID(),
          itemId: "global",
          fornecedor: c.fornecedor || "",
          cnpj: c.cnpj || "",
          fonte: c.fonte || "",
          valor: Number(c.valor) > 0 ? Number(c.valor) : 0,
          data: c.data || new Date().toISOString().slice(0, 10),
          observacao: c.observacao || "",
        })));
      }

      setResultadoGuiado(data);
    } catch (err: any) {
      setErroGuiado(String(err?.message || err));
    } finally {
      setInterpretandoGuiado(false);
    }
  };

  const pesquisarPNCP = async () => {
    setPesquisando(true); setResultados([]); setErroPesquisa(null); setParametrosBusca(null);
    setSituFiltro("todos"); setIaFiltroReady(false); setIaAnalisando(false);
    setPaginaPorItem({}); setTotalPorItem({}); setTotalPagsPorItem({});
    goToStep(9);

    function limparTermo(t: string): string {
      return t
        .replace(/\b(c[oó]digo|cod|ref|referencia|aplica[cç][aã]o|modelo|pn|sku)\s*[:\-\.]\s*\S+/gi, " ")
        .replace(/\b[A-Z]{1,3}[0-9]{2,}[A-Z0-9]*\b/g, " ")
        .replace(/,\s*/g, " ")
        .replace(/\s+/g, " ").trim();
    }

    const objetoLimpo = limparTermo(objetoDesc);

    // ── TERMO PARAMETRIZADO (2 camadas) ──
    // CAMADA 1 — TERMO DE BUSCA (o que vai ao PNCP): APENAS o núcleo da descrição
    //   do item (limpo de códigos/ruído). NUNCA entram especificação completa,
    //   quantidade, unidade ou local — o PNCP faz busca textual de TODAS as
    //   palavras juntas, e qualquer excesso derruba o resultado (ex: especificação
    //   longa de clínico geral  1). Termo curto = amplitude máxima.
    // CAMADA 2 — PRIORIZAÇÃO: especificação/quantidade/unidade/local aplicados
    //   DEPOIS, como boost de similaridade/ordenação nos resultados.
    function montarTermoBusca(item?: any): string {
      const partes: string[] = [];
      if (item?.descricao) partes.push(limparTermo(item.descricao));
      if (!item && objetoLimpo) partes.push(objetoLimpo);
      const termo = partes.filter(Boolean).join(" ").trim();
      // Garante no mínimo o núcleo do objeto
      return termo || objetoDesc;
    }
    // Metadados da priorização (não entram na busca — entram no re-ranking)
    function montarFiltros(item?: any): string {
      const extras: string[] = [];
      if (item?.quantidade && item.quantidade > 0 && item.unidadeMedida) extras.push(`${item.quantidade} ${item.unidadeMedida}`);
      else if (item?.unidadeMedida) extras.push(item.unidadeMedida);
      if (localEntrega) extras.push(`local=${localEntrega}`);
      if (item?.especificacao) extras.push(`espec=${limparTermo(item.especificacao).slice(0, 80)}`);
      return extras.join(" | ");
    }

    // Um alvo por item (busca separada para cada item/lote)
    const alvos: { itemId: string; rotulo: string; termo: string; filtros: string; parametros: string }[] = [];
    if (formaParcelamento === "global" || itens.length === 0) {
      alvos.push({
        itemId: "global", rotulo: objetoDesc.slice(0, 60) || "Objeto",
        termo: montarTermoBusca(),
        filtros: montarFiltros(),
        parametros: `objeto=${objetoDesc.slice(0, 60)}${localEntrega ? ` | local=${localEntrega}` : ""}`,
      });
    } else if (formaParcelamento === "lote") {
      for (const lote of itens) {
        for (const sub of (lote.subitens || []).filter(s => (s.descricao || "").trim().length > 0)) {
          alvos.push({
            itemId: sub.id,
            rotulo: `${lote.descricao || "Lote"} · ${sub.descricao}`.slice(0, 60),
            termo: montarTermoBusca(sub),
            filtros: montarFiltros(sub),
            parametros: `${sub.descricao.slice(0, 60)}${sub.unidadeMedida ? ` | ${sub.quantidade || ""} ${sub.unidadeMedida}` : ""}${localEntrega ? ` | local=${localEntrega}` : ""}`,
          });
        }
      }
    } else {
      const base = itens.filter(i => (i.descricao || "").trim().length > 0);
      for (const item of (base.length ? base : itens)) {
        alvos.push({
          itemId: item.id, rotulo: item.descricao.slice(0, 60), termo: montarTermoBusca(item),
          filtros: montarFiltros(item),
          parametros: `${item.descricao.slice(0, 60)}${item.unidadeMedida ? ` | ${item.quantidade || ""} ${item.unidadeMedida}` : ""}${localEntrega ? ` | local=${localEntrega}` : ""}`,
        });
      }
    }

    // Salva os termos para paginação posterior
    const novosTermos: Record<string, string> = {};
    for (const a of alvos) novosTermos[a.itemId] = a.termo;
    setTermoPorItem(novosTermos);

    // Mostra ao servidor quais parâmetros o agente juntou na busca
    setParametrosBusca(alvos.map(a => ({ rotulo: a.rotulo, termo: a.termo, filtros: a.filtros, parametros: a.parametros })));
    const mapFiltros: Record<string, string> = {};
    for (const a of alvos) mapFiltros[a.itemId] = a.filtros;
    setFiltrosPorItem(mapFiltros);

    // Busca multi-fonte — PNCP principal (rápido) + Compras.gov + Contratos.gov.br
    // (preços REAIS pagos). NOTA: precos_abertos leva ~30s (excluído);
    // painel_precos exige auth (403). Se o PNCP falhar, o fallback Firecrawl
    // entra automaticamente (pncp-search.ts).
    const TAM = 50;
    const fontesMulti = "pncp,compras_gov,contratos_govbr";
    // AGENTE PESQUISADOR: marca todos como "buscando" e busca em paralelo
    const progInicial: Record<string, { status: "buscando" }> = {};
    for (const a of alvos) progInicial[a.itemId] = { status: "buscando" };
    setProgressoItens(progInicial);
    const buscas = alvos.map(alvo =>
      fetch(`/api/pncp?termo=${encodeURIComponent(alvo.termo)}&fontes=${fontesMulti}&tamanhoPagina=${TAM}`, { signal: AbortSignal.timeout(40_000) })
        .then(async r => ({ alvo, data: await r.json().catch(() => null) }))
        .catch(() => ({ alvo, data: null }))
    );

    try {
      const respostas = await Promise.allSettled(buscas);
      const novosResultados: ResultadoPNCP[] = [];
      const novoTotal: Record<string, number> = {};
      const novoPags: Record<string, number> = {};
      const novoPagAtual: Record<string, number> = {};
      const rotulos = new Map(alvos.map(a => [a.itemId, a.rotulo]));

      for (const resp of respostas) {
        if (resp.status !== "fulfilled" || !resp.value?.data) {
          // AGENTE PESQUISADOR: marca falha e segue com os outros itens
          if (resp.status === "fulfilled") {
            setProgressoItens(prev => ({ ...prev, [resp.value.alvo.itemId]: { status: "falha", erro: "Não retornou dados" } }));
          }
          continue;
        }
        const { alvo, data } = resp.value;
        const items: any[] = data.items || [];
        const total: number = data.total ?? items.length;

        // AGENTE PESQUISADOR: marca o item como concluído
        setProgressoItens(prev => ({ ...prev, [alvo.itemId]: { status: "ok", total } }));

        novoTotal[alvo.itemId] = total;
        novoPags[alvo.itemId] = Math.max(1, Math.ceil(total / TAM));
        novoPagAtual[alvo.itemId] = 1;

        items.forEach((it, idx) => {
          // Filtro de recência: descarta referências fora do período configurado.
          const dataRef = it.dataContrato ? String(it.dataContrato).slice(0, 10) : "";
          if (dataRef) {
            const ts = new Date(dataRef + "T00:00:00").getTime();
            if (!isNaN(ts) && Date.now() - ts > limiteDias * 86400_000) return;
          }
          novosResultados.push({
            id: `${alvo.itemId}-${idx}`,
            fonte: it.fonte || "pncp",
            itemId: alvo.itemId,
            orgao: it.orgao || "Órgão público",
            descricao: it.descricao || "",
            quantidade: it.quantidade ?? null,
            data: it.dataContrato || "",
            valor_unitario: it.valorUnitario ?? null,  // contratos_govbr traz preço real pago
            valor_total: it.valorTotal ?? null,        // valor_total_estimado do edital (Opção A)
            localizacao: it.localizacao || "",
            similaridade: (() => {
              const escolhido = catalogoPorItem[alvo.itemId]?.selecionado;
              const codigoResultado = Number(it?.dadosBrutos?.codigoItemCatalogo || 0);
              const boostCatmat = escolhido && codigoResultado === escolhido ? 20 : 0;
              return Math.min(100, Number(it.similaridade ?? 0) + boostCatmat);
            })(),
            documento_origem: it.documentoOrigem || "",
            link_origem: it.linkEdital || "",
            status_avaliacao: "pendente" as const,
            dadosBrutos: { ...(it.dadosBrutos || {}), _catmatSelecionado: catalogoPorItem[alvo.itemId]?.selecionado || null },
          });
        });
      }

      // Coleta erros retornados pela API (ex: PNCP HTTP 403, timeout)
      const errosApi = respostas
        .filter(r => r.status === "fulfilled" && r.value?.data?.erro)
        .map(r => (r as any).value.data.erro as string);

      if (novosResultados.length === 0) {
        const msgErro = errosApi.length
          ? `Erro ao consultar o PNCP: ${errosApi[0]}. Verifique a conectividade do servidor.`
          : "Nenhum edital encontrado. Tente termos mais genéricos.";
        setErroPesquisa(msgErro);
        // ── SUGESTÃO: refaz com termo reduzido (sem quantidade/unidade/local) ──
        // Se a busca parametrizada (objeto+espec+qtde+unidade+local) não achou
        // nada, tenta com o termo essencial — o que a usuária pediu: "se ele não
        // encontrar exatamente como foi pesquisado, ele deve sugerir o que foi encontrado".
        try {
          const termoEssencial = (() => {
            if (formaParcelamento === "global" || itens.length === 0) return objetoLimpo || objetoDesc;
            const item = (itens.filter(i => (i.descricao || "").trim().length > 0)[0]) || itens[0];
            return limparTermo(`${item?.descricao || ""} ${item?.especificacao || ""}`.trim()) || objetoLimpo || objetoDesc;
          })();
          if (termoEssencial && termoEssencial !== alvos[0]?.termo) {
            const resp2 = await fetch(`/api/pncp?termo=${encodeURIComponent(termoEssencial)}&fontes=${fontesMulti}&tamanhoPagina=${TAM}`, { signal: AbortSignal.timeout(40_000) });
            const data2 = await resp2.json().catch(() => null);
            const items2: any[] = data2?.items || [];
            if (items2.length > 0) {
              const sugeridos: ResultadoPNCP[] = items2.map((it, idx) => ({
                id: `sugestao-${alvos[0]?.itemId || "global"}-${idx}`,
                fonte: it.fonte || "pncp",
                itemId: alvos[0]?.itemId || "global",
                orgao: it.orgao || "Órgão público",
                descricao: it.descricao || "",
                quantidade: it.quantidade ?? null,
                data: it.dataContrato || "",
                valor_unitario: it.valorUnitario ?? null,
                valor_total: it.valorTotal ?? null,
                localizacao: it.localizacao || "",
                similaridade: it.similaridade ?? 0,
                documento_origem: it.documentoOrigem || "",
                link_origem: it.linkEdital || "",
                status_avaliacao: "pendente" as const,
                dadosBrutos: it.dadosBrutos || {},
              }));
              setResultados(sugeridos);
              setTotalPorItem({ [alvos[0]?.itemId || "global"]: data2?.total ?? items2.length });
              setTotalPagsPorItem({ [alvos[0]?.itemId || "global"]: Math.max(1, Math.ceil((data2?.total ?? items2.length) / TAM)) });
              setPaginaPorItem({ [alvos[0]?.itemId || "global"]: 1 });
              setErroPesquisa(
                `Não encontramos referências exatas para "${alvos[0]?.termo}". ` +
                `Buscamos com o termo essencial "${termoEssencial}" — veja as sugestões abaixo.`
              );
            }
          }
        } catch { /* fallback silencioso */ }
      } else {
        setResultados(novosResultados);
        setTotalPorItem(novoTotal);
        setTotalPagsPorItem(novoPags);
        setPaginaPorItem(novoPagAtual);

        // Opção B: busca preços unitários dos top-10 editais mais similares em background
        buscarPrecosUnitariosBackground(novosResultados.slice(0, 10));

        // IA: analisa em background e ativa o filtro "IA" quando pronto
        rodarIABackground(novosResultados, alvos.map(a => a.rotulo));
      }
    } catch (err: any) {
      setErroPesquisa("Erro ao consultar o PNCP: " + (err?.message || "falha na rede"));
    }
    setPesquisando(false);
  };

  // ── Troca de página por item ─────────────────────────────────────────────────
  const buscarPaginaItem = async (itemId: string, pagina: number) => {
    const termo = termoPorItem[itemId];
    if (!termo) return;
    const TAM = 50;
    try {
      const resp = await fetch(`/api/pncp?termo=${encodeURIComponent(termo)}&fontes=pncp,compras_gov&tamanhoPagina=${TAM}&pagina=${pagina}`, { signal: AbortSignal.timeout(30_000) });
      const data = await resp.json();
      const items: any[] = (data.items || []).filter((it: any) => {
        const dataRef = it.dataContrato ? String(it.dataContrato).slice(0, 10) : "";
        if (!dataRef) return true;
        const ts = new Date(dataRef + "T00:00:00").getTime();
        return isNaN(ts) || Date.now() - ts <= limiteDias * 86400_000;
      });
      const novos: ResultadoPNCP[] = items.map((it, idx) => ({
        id: `${itemId}-p${pagina}-${idx}`,
        fonte: "pncp",
        itemId,
        orgao: it.orgao || "Órgão público",
        descricao: it.descricao || "",
        quantidade: null,
        data: it.dataContrato || "",
        valor_unitario: null,
        valor_total: it.valorTotal ?? null,
        localizacao: it.localizacao || "",
        similaridade: it.similaridade ?? 0,
        documento_origem: it.documentoOrigem || "",
        link_origem: it.linkEdital || "",
        status_avaliacao: "pendente" as const,
        dadosBrutos: it.dadosBrutos || {},
      }));
      setResultados(prev => [...prev.filter(r => r.itemId !== itemId), ...novos]);
      setPaginaPorItem(prev => ({ ...prev, [itemId]: pagina }));
    } catch {
      setErroPaginacao("Erro ao carregar página " + pagina + ". Verifique sua conexão.");
    }
  };

  // ── IA em background: extrai keywords e re-pontua os resultados ──────────────
  const rodarIABackground = async (res: ResultadoPNCP[], rotulos: string[]) => {
    setIaAnalisando(true);

    // Fallback: scoring local por palavras-chave do objeto (sempre executa)
    const aplicarFallback = () => {
      const termos = (objetoDesc || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/\s+/).filter(t => t.length > 3);
      if (termos.length === 0) { setIaFiltroReady(true); return; }
      setResultados(prev => prev.map(r => {
        const desc = (r.descricao || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const hits = termos.filter(t => desc.includes(t));
        const sim = termos.length === 0 ? 0 : Math.min(100, Math.round((hits.length / termos.length) * 100));
        return { ...r, similaridade: Math.max(r.similaridade, sim) };
      }));
      setIaFiltroReady(true);
    };

    try {
      const resp = await fetch("/api/ia/extracao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descricao: objetoDesc,
          especificacoes: itens.map(i => ({ item: i.descricao, especificacao: i.especificacao, obrigatorio: i.obrigatorio ?? true })),
        }),
      });
      if (!resp.ok) { aplicarFallback(); return; }
      const data = await resp.json();
      if (data.error) { aplicarFallback(); return; }

      const keywords: string[] = [
        ...(data.palavras_chave_busca || []),
        ...(data.caracteristicas || []).map((c: any) => c.valor),
      ].map((s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

      if (keywords.length > 0) {
        setCaracteristicasIA(
          (data.palavras_chave_busca || []).map((kw: string, i: number) => ({ caracteristica: `palavra_chave_${i + 1}`, valor: kw, confianca: 88 })).concat(
            (data.caracteristicas || []).map((c: any) => ({ caracteristica: c.nome, valor: c.valor, confianca: c.confianca }))
          )
        );
        setResultados(prev => prev.map(r => {
          const desc = (r.descricao || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const hits = keywords.filter(kw => desc.includes(kw));
          const sim = Math.min(100, Math.round((hits.length / Math.max(keywords.length, 1)) * 100));
          return { ...r, similaridade: Math.max(r.similaridade, sim) };
        }));
        setIaFiltroReady(true);
      } else {
        aplicarFallback();
      }
    } catch {
      aplicarFallback();
    }
    setIaAnalisando(false);
  };

  // ── Opção B: busca preços unitários dos primeiros editais via API de itens ───
  const buscarPrecosUnitariosBackground = async (top: ResultadoPNCP[]) => {
    await Promise.allSettled(top.map(async (r) => {
      try {
        const db = r.dadosBrutos as any;
        const cnpj = db?._cnpjOrgao || db?.orgao_cnpj || "";
        const ano  = db?.ano || "";
        const seq  = db?.numero_sequencial || "";
        if (!cnpj || !ano || !seq) return;
        const resp = await fetch(`/api/pncp/itens?cnpj=${cnpj}&ano=${ano}&seq=${seq}`, { signal: AbortSignal.timeout(10_000) });
        if (!resp.ok) return;
        const data = await resp.json();
        const precos: number[] = (data.itens || []).map((i: any) => Number(i.valorUnitarioEstimado || i.valorUnitario || 0)).filter((v: number) => v > 0);
        if (precos.length === 0) return;
        const menor = Math.min(...precos);
        setResultados(prev => prev.map(x => x.id === r.id ? { ...x, valor_unitario: menor } : x));
      } catch { /* ignora timeout individual */ }
    }));
  };

  const avaliarResultado = (id: string, status: StatusAvaliacao, justificativa?: string) => {
    setResultados(prev => prev.map(r => r.id === id ? { ...r, status_avaliacao: status, justificativa_rejeicao: justificativa } : r));
  };

  const gerarConteudoIA = async (stats: any, nAceitas: number) => {
    if (!stats) {
      setJustificativaIA(" Nenhuma referência aceita com valor. Volte à tabela de resultados e clique em  Aceitar em editais com preço.");
      return;
    }
    setIaLoading(true);
    setJustificativaIA(null);
    setValidacaoIA(null);
    try {
      // Inclui as referências reais usadas no quadro (órgão + valor) para a justificativa
      const refsQuadro = (usadosCalcularDireto.length > 0 ? usadosCalcularDireto : resultados.filter(r => r.status_avaliacao === "aceito"))
        .map(r => ({ orgao: r.orgao, valor: r.valor_unitario ?? r.valor_total }));
      const res = await fetch("/api/ia/justificativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatisticas: stats, metodo: config.metodo, quantidade, referenciasAceitas: nAceitas, referencias: refsQuadro }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (data.justificativa) setJustificativaIA(data.justificativa);
    } catch (err: any) {
      console.error("Erro no agente justificador:", err);
      setJustificativaIA(` Erro ao gerar justificativa: ${err?.message || "falha na rede"}. Tente novamente.`);
    }
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
      if (res2.ok) setValidacaoIA(await res2.json());
    } catch (err) { console.error("Erro no agente validador:", err); }
    setIaLoading(false);
  };

  const calcular = (): { stats: ReturnType<typeof calcularEstatisticas>; nAceitas: number } | null => {
    // Usa valor_unitario quando disponível; cai para valor_total como fallback (Opção A)
    const aceitosRaw = resultados.filter(r => r.status_avaliacao === "aceito" && (r.valor_unitario != null || r.valor_total != null));
    const aceitos = aceitosRaw.map(r => (r.valor_unitario ?? r.valor_total) as number);
    if (aceitos.length === 0) { setEstatisticas(null); setAlertaCv(null); setPrecoEstimado(null); setAnaliseCritica(null); return null; }
    const pesos = aceitosRaw.map(r => r.quantidade ?? 1);
    // Regra da reunião: CV > limite (20%)  alerta + menor preço automaticamente
    const { estatisticas: stats, alertaCv, cvExcedido, metodoEfetivo, preco } = calcularComRegraCv(
      aceitos, config.metodo, quantidade, config.cvLimite, pesos,
    );
    setEstatisticas(stats);
    setAlertaCv(alertaCv ? { cv: cvExcedido as number, limite: config.cvLimite, metodoEfetivo } : null);
    setMetodoEfetivo(metodoEfetivo);
    setPrecoEstimado(preco);

    // Análise crítica comparativa (melhoria): compara as contratações e aponta
    // outliers, diferenças de quantidade/unidade/região — sem inventar motivos.
    const analise = analisarReferencias(aceitosRaw.map(r => ({
      id: r.id,
      orgao: r.orgao,
      descricao: r.descricao,
      quantidade: r.quantidade,
      unidadeMedida: (r as any).unidade_medida ?? (r as any).unidade,
      dataContrato: r.data,
      valorUnitario: r.valor_unitario,
      valorTotal: r.valor_total,
      localizacao: r.localizacao,
      similaridade: r.similaridade,
      itemId: r.itemId,
    })));
    setAnaliseCritica(analise);

    // Histórico do próprio órgão (melhoria): valores já pagos em pesquisas anteriores
    historicoOrgao(objetoDesc).then(setHistoricoOrgaoRows).catch(() => setHistoricoOrgaoRows([]));

    return { stats, nAceitas: aceitosRaw.length };
  };

  // ── CALCULAR DIRETO: usa os resultados da pesquisa AUTOMATICAMENTE ──
  // Sem exigir aceite manual — pega os melhores resultados com valor
  // (maior similaridade primeiro), calcula e deixa notas explicativas.
  const [notasCalcularDireto, setNotasCalcularDireto] = useState<string[] | null>(null);
  const [usadosCalcularDireto, setUsadosCalcularDireto] = useState<ResultadoPNCP[]>([]);
  const [analisePrecificacaoIA, setAnalisePrecificacaoIA] = useState<any | null>(null);
  const [analisandoPrecificacaoIA, setAnalisandoPrecificacaoIA] = useState(false);
  const [erroPrecificacaoIA, setErroPrecificacaoIA] = useState<string | null>(null);
  // ── AGENTE AUDITOR: estados da análise de diferenças ──
  const [auditoriaIA, setAuditoriaIA] = useState<string | null>(null);
  const [auditoriaCarregando, setAuditoriaCarregando] = useState(false);
  // ── AGENTE AUDITOR: explica POR QUE os preços diferem (região, qtd, época) ──
  const explicarDiferencas = async () => {
    const fonte = usadosCalcularDireto.length > 0 ? usadosCalcularDireto : resultados.filter(r => (r.valor_unitario != null || r.valor_total != null));
    if (fonte.length < 2) return;
    setAuditoriaCarregando(true);
    setAuditoriaIA(null);
    try {
      const resp = await fetch("/api/ia/auditoria", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objeto: objetoDesc,
          quantidade,
          unidadeMedida,
          localEntrega,
          referencias: fonte.map(r => ({
            orgao: r.orgao,
            descricao: r.descricao?.slice(0, 80),
            valor: r.valor_unitario ?? r.valor_total,
            quantidade: r.quantidade,
            data: r.data?.slice(0, 10),
            localizacao: r.localizacao,
            similaridade: r.similaridade,
          })),
        }),
        signal: AbortSignal.timeout(45_000),
      });
      const data = await resp.json().catch(() => null);
      setAuditoriaIA(data?.analise || "Não consegui gerar a análise agora.");
    } catch {
      setAuditoriaIA("Não consegui gerar a análise agora. Tente novamente.");
    } finally {
      setAuditoriaCarregando(false);
    }
  };

  const analisarObjetoAntesDoCalculo = async () => {
    const comValor = resultados.filter(r => (r.valor_unitario != null || r.valor_total != null));
    setAnalisandoPrecificacaoIA(true);
    setErroPrecificacaoIA(null);
    setAnalisePrecificacaoIA(null);
    setPrecoEstimado(null);
    setUsadosCalcularDireto([]);
    try {
      const resp = await fetch("/api/ia/interpretar-precificacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objeto: objetoDesc,
          quantidade,
          unidadeMedida,
          localEntrega,
          referencias: comValor.slice(0, 20).map(r => ({
            id: r.id,
            descricao: r.descricao,
            orgao: r.orgao,
            quantidade: r.quantidade,
            unidade: (r as any).unidade_medida ?? (r as any).unidade ?? null,
            data: r.data,
            localizacao: r.localizacao,
            similaridade: r.similaridade,
            valor: r.valor_unitario ?? r.valor_total,
          })),
        }),
        signal: AbortSignal.timeout(50_000),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) throw new Error(data?.error || "Falha na análise inteligente do objeto.");
      setAnalisePrecificacaoIA(data);
    } catch (e: any) {
      setErroPrecificacaoIA(String(e?.message || "Não consegui analisar o objeto agora."));
    } finally {
      setAnalisandoPrecificacaoIA(false);
    }
  };

  const calcularDireto = () => {
    // 1. O cálculo direto só acontece DEPOIS da interpretação inteligente do objeto.
    const todosComValor = resultados.filter(r => (r.valor_unitario != null || r.valor_total != null));
    if (!analisePrecificacaoIA) {
      setNotasCalcularDireto(["Antes do cálculo direto, peça ao agente para entender o objeto e avaliar quais referências são realmente comparáveis."]);
      return;
    }
    const idsCompativeis = new Set((analisePrecificacaoIA.referencias || [])
      .filter((r: any) => r.classificacao === "compativel")
      .map((r: any) => String(r.id)));
    const comValor = todosComValor.filter(r => idsCompativeis.has(String(r.id)));
    if (comValor.length === 0) {
      setNotasCalcularDireto(["O agente não classificou nenhuma referência como compatível com segurança. Revise o objeto, complete as características faltantes ou refaça a pesquisa com uma das possibilidades sugeridas."]);
      setUsadosCalcularDireto([]);
      setPrecoEstimado(null);
      setEstatisticas(null);
      setAlertaCv(null);
      return;
    }

    // 2. Ordena por similaridade (melhores primeiro) e pega até 10
    const ordenados = [...comValor].sort((a, b) => (b.similaridade || 0) - (a.similaridade || 0));
    const top = ordenados.slice(0, 10);

    // 2b. IN 126 (art. 11 §2º): desconsidera preços inexequíveis/sobrepreços ANTES do cálculo
    // (remove os discrepantes da amostra para não distorcer a média)
    const valsBrutos = top.map(r => (r.valor_unitario ?? r.valor_total) as number);
    const limpos = top.filter(r => classificarPrecoIN126((r.valor_unitario ?? r.valor_total) as number, valsBrutos).tipo === "válido");
    const descartados = top.filter(r => classificarPrecoIN126((r.valor_unitario ?? r.valor_total) as number, valsBrutos).tipo !== "válido");
    const amostra = limpos.length >= 3 ? limpos : top; // se sobrar <3, usa todos (art. 11 §1º)

    // 3. Calcula com a amostra limpa (sem precisar aceitar)
    const vals = amostra.map(r => (r.valor_unitario ?? r.valor_total) as number);
    const pesos = amostra.map(r => r.quantidade ?? 1);
    const { estatisticas: stats, alertaCv, cvExcedido, metodoEfetivo, preco } = calcularComRegraCv(
      vals, config.metodo, quantidade, config.cvLimite, pesos,
    );
    setEstatisticas(stats);
    setAlertaCv(alertaCv ? { cv: cvExcedido as number, limite: config.cvLimite, metodoEfetivo } : null);
    setMetodoEfetivo(metodoEfetivo);
    setPrecoEstimado(preco);
    setUsadosCalcularDireto(amostra);

    // 4. Notas explicativas (transparência do que o agente fez)
    const notas: string[] = [];
    notas.push(` Usei ${amostra.length} referência(s) que o agente classificou como compatíveis com o objeto, antes da análise estatística.`);
    if (descartados.length > 0) {
      notas.push(` Desconsiderei ${descartados.length} preço(s) discrepante(s) — IN 126, art. 11, §2º (${descartados.map(r => formatarMoeda((r.valor_unitario ?? r.valor_total) as number)).join(", ")}) — por serem inexequíveis (< 50% da média) ou sobrepreços (> 150%).`);
    }
    notas.push(` Classificação IN 126/2023-TJRO: preços < 50% da média = inexequíveis · > 150% = sobrepreço (desconsiderados no cálculo).`);
    if (alertaCv) notas.push(` Dispersão alta (CV ${cvExcedido?.toFixed(1)}% > limite ${config.cvLimite}%)  apliquei automaticamente o MENOR PREÇO como referência (regra de segurança).`);
    notas.push(` Método aplicado: ${metodoEfetivo.replace(/_/g, " ")} — preço de referência unitário ${formatarMoeda(preco.unitario)} × ${quantidade} ${unidadeMedida}(s) = ${formatarMoeda(preco.total)}.`);
    notas.push(` Dica: você pode revisar/aceitar/descartar referências na etapa anterior e recalcular — o sistema respeita suas escolhas.`);
    setNotasCalcularDireto(notas);

    // 5. Gera a JUSTIFICATIVA automaticamente (ordem correta: quadro → justificativa → relatório)
    // Assim o relatório final já sai com a justificativa técnica, sem depender da etapa 10.
    gerarConteudoIA(stats, amostra.length);
  };

  const linksAceitos = resultados.filter(r => r.status_avaliacao === "aceito").map(r => ({ nome: r.documento_origem, url: r.link_origem, tipo: "link" as const }));

  // ── ME/EPP (LC 123/2006): exclusividade até R$ 80.000 ou reserva de 25% ────
  const calcularMeEpp = () => {
    const valorTotal = precoEstimado?.total || 0;
    const tipo: "exclusividade" | "reserva_25" = valorTotal <= 80_000 ? "exclusividade" : "reserva_25";
    const valorReservado = meEpp.aplicar ? (tipo === "exclusividade" ? valorTotal : valorTotal * 0.25) : 0;
    return {
      aplicar: meEpp.aplicar,
      tipo,
      valorTotal,
      valorReservado,
      limiteExclusividade: 80_000,
      pctReserva: 25,
      baseLegal: "LC nº 123/2006, art. 48",
    };
  };

  const catalogoSelecionadoResumo = itens.flatMap((item, idx) => {
    const alvos: { ref: ItemPesquisa | SubItem; rotulo: string }[] = formaParcelamento === "lote"
      ? (item.subitens || []).map((sub, si) => ({ ref: sub, rotulo: `Lote ${idx + 1} · Item ${si + 1}` }))
      : [{ ref: item, rotulo: `Item ${idx + 1}` }];
    return alvos.map(({ ref, rotulo }) => {
      const estadoCat = catalogoPorItem[ref.id];
      const opcao = estadoCat?.opcoes?.find(o => o.codigo === estadoCat.selecionado);
      return opcao ? {
        item: rotulo,
        itemId: ref.id,
        descricaoItem: ref.descricao,
        tipo: opcao.tipo,
        codigo: opcao.codigo,
        descricaoOficial: opcao.descricao,
        pdm: opcao.pdm || null,
        nomePdm: opcao.nomePdm || null,
        confianca: opcao.confianca,
        confirmadoNaPesquisa: true,
      } : null;
    }).filter(Boolean);
  });

  const premissas = {
    processo: processo.numero,
    orgao: processo.orgao,
    unidade: processo.unidade,
    responsavel: processo.responsavel,
    email: processo.email,
    objeto: objetoDesc,
    formaParcelamento: formaParcelamento || "item",
    itens,
    catalogoSelecionado: catalogoSelecionadoResumo,
    quantidade,
    unidadeMedida,
    localEntrega,
    periodoPesquisa: config.periodo,
    regiaoPesquisa: config.regiao,
    fontes: Array.from(new Set(resultados.map(r => r.fonte).filter(Boolean))) as string[],
    cvLimite: config.cvLimite,
    cv: estatisticas?.coeficienteVariacao ?? null,
    metodoEscolhido: config.metodo,
    metodoEfetivo: metodoEfetivo || config.metodo,
    alertaCv,
    parametrosRelatorio,
    meEpp: calcularMeEpp(),
    pesquisaMercado,
    decomposicaoCustos,
    dataGeracao: new Date().toISOString(),
  };

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
        formaParcelamento: formaParcelamento || "item",
        especificacoes: itens.map(i => ({ item: i.descricao, especificacao: i.especificacao, obrigatorio: i.obrigatorio ?? true })),
        itens,
        pesquisaMercado,
        cvLimite: config.cvLimite,
        parametrosRelatorio,
        meEpp: calcularMeEpp(),
        decomposicaoCustos,
        premissas,
        caracteristicasIA: caracteristicasIA.length ? caracteristicasIA : null,
        periodoPesquisa: config.periodo,
        regiaoPesquisa: config.regiao,
        metodoCalculo: (metodoEfetivo || config.metodo) as MetodoCalculo,
        fontesAtivas: Array.from(new Set(resultados.map(r => r.fonte).filter(Boolean) as string[])).length > 0 ? Array.from(new Set(resultados.map(r => r.fonte).filter(Boolean) as string[])) : ["precos_abertos"],
      });
      if (resultados.length > 0) {
        await salvarResultadosPesquisa(nova.id, resultados.map((r) => ({
          fonte: r.fonte || "precos_abertos",
          itemId: r.itemId || null,
          cnpj: r.cnpj || null,
          fonteDados: r.fonte_dados || null,
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
          dadosBrutos: { fornecedor: r.fornecedor || null, pesquisa_mercado: !!r.cnpj },
        })));
      }
      await atualizarPesquisa(nova.id, {
        precoUnitarioEstimado: precoEstimado?.unitario != null ? String(precoEstimado.unitario) : null,
        precoTotalEstimado: precoEstimado?.total != null ? String(precoEstimado.total) : null,
        estatisticas: estatisticas || null,
        justificativa: justificativaIA || null,
        premissas,
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
    processo, objeto: objetoDesc, quantidade, metodo: metodoEfetivo || config.metodo,
    estatisticas: estatisticas || { n: 0, media: 0, mediana: 0, minimo: 0, maximo: 0, desvioPadrao: 0, coeficienteVariacao: 0 },
    precoUnitario: precoEstimado?.unitario || 0, precoTotal: precoEstimado?.total || 0,
    justificativa: justificativaIA || (precoEstimado ? `O preço foi formado com base em ${estatisticas?.n} registros do PNCP, utilizando o método da ${config.metodo}.` : ""),
    referencias: resultados.filter(r => r.status_avaliacao === "aceito"),
    responsavel: processo.responsavel,
    email: processo.email,
    linksEvidencias: linksAceitos,
    premissas,
    itens,
    alertaCv,
  };

  // ─── Stepper helpers ────────────────────────────────────────────────────────
  const faseAtual = FASES.findIndex(f => f.steps.includes(step));
  const itensEfetivos: (ItemPesquisa | SubItem)[] = formaParcelamento === "lote" ? itens.flatMap(i => i.subitens || []) : itens;
  const nAceitos = resultados.filter(r => r.status_avaliacao === "aceito").length;
  const nRejeitados = resultados.filter(r => r.status_avaliacao === "rejeitado").length;

  const renderStep = () => {
    switch (step) {
      // ── Etapa 1: Objeto e parcelamento (2ª tela antiga  1ª posição) ────────
      case 1: return (
        <StepCard
          title="Vamos preparar sua pesquisa"
          desc="Comece do seu jeito. O LEX organiza o pedido, aponta o que falta e ajuda você a confirmar a classificação antes de buscar preços."
          footer={<><span /><Btn primary onClick={() => {
            if (!objetoDesc.trim()) {
              setErroStep1("Preencha a descrição do objeto antes de avançar.");
              return;
            }
            setErroStep1(null);
            nextStep();
          }} icon={<ChevronRight size={15}/>}>Revisar itens</Btn></>}
        >
          <div className="space-y-5">
            <div>
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-gold-400" aria-hidden>
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-ink-950">Conte para o LEX do seu jeito</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">Você pode escrever como falaria com uma pessoa. Eu identifico as variáveis da pesquisa e preencho somente o que estiver claro. O restante eu transformo em perguntas.</p>
                </div>
              </div>
              <div className="mb-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Exemplos para começar</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    "Preciso pesquisar 30 notebooks com 16 GB de RAM e SSD de 512 GB para entrega em Porto Velho/RO.",
                    "Quero contratar manutenção preventiva e corretiva de 40 aparelhos de ar-condicionado por 12 meses.",
                    "Precisamos comprar 500 resmas de papel A4 75 g/m² para o almoxarifado central.",
                  ].map((ex, i) => (
                    <button key={i} type="button" onClick={() => setPedidoGuiado(ex)} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-left text-[13px] leading-snug text-slate-600 transition-colors hover:border-ink-200 hover:bg-ink-50 hover:text-ink-900">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                value={pedidoGuiado}
                onChange={e => setPedidoGuiado(e.target.value)}
                placeholder="Ex.: Preciso pesquisar 30 notebooks para a Secretaria de Administração, entrega em Porto Velho. Cada um com 16 GB de RAM e SSD de 512 GB. Ainda não sei se faço por item ou lote."
                aria-label="Descreva o que você precisa pesquisar"
                className="inp min-h-[120px] px-4 py-3 leading-relaxed"
              />
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <button
                  type="button"
                  onClick={interpretarPedidoGuiado}
                  disabled={interpretandoGuiado || pedidoGuiado.trim().length < 8}
                  className="btn btn-primary px-5 disabled:opacity-40"
                >
                  {interpretandoGuiado ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                  {interpretandoGuiado ? "Analisando sua solicitação…" : "Organizar meu pedido"}
                </button>
                <p className="text-[13px] text-slate-500">Nada é apagado e nenhum dado ausente é inventado.</p>
              </div>

              {erroGuiado && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{erroGuiado}</div>
              )}

              {resultadoGuiado && (
                <div className="mt-4 rounded-xl border border-[#d5dce8] bg-white p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={15} className="text-green-600" />
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wide">O que o LEX entendeu</p>
                  </div>
                  <p className="text-sm text-slate-700 leading-relaxed">{resultadoGuiado.resumo}</p>
                  {Array.isArray(resultadoGuiado.perguntasFaltantes) && resultadoGuiado.perguntasFaltantes.length > 0 && (
                    <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                      <p className="text-xs font-bold text-amber-800 mb-1.5">Antes de pesquisar, ainda preciso confirmar:</p>
                      <ul className="space-y-1 text-xs text-amber-800">
                        {resultadoGuiado.perguntasFaltantes.map((q: string, i: number) => <li key={i}>• {q}</li>)}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(resultadoGuiado.alertas) && resultadoGuiado.alertas.length > 0 && (
                    <div className="mt-3 text-xs text-slate-500 space-y-1">
                      {resultadoGuiado.alertas.map((a: string, i: number) => <p key={i}>Atenção: {a}</p>)}
                    </div>
                  )}
                  {itens.length > 0 && Object.values(catalogoPorItem).some(c => c.carregando || c.opcoes?.length > 0) && (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <div className="mb-2">
                        <p className="text-xs font-bold text-slate-800">Classificação oficial sugerida</p>
                        <p className="text-[11px] text-slate-500">O LEX procura CATMATs compatíveis, mas você confirma a opção antes da pesquisa.</p>
                      </div>
                      <div className="space-y-2">
                        {itens.map((item, idx) => {
                          const cat = catalogoPorItem[item.id];
                          if (!cat) return null;
                          const escolhido = cat.opcoes?.find(o => o.codigo === cat.selecionado);
                          return (
                            <div key={item.id} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Item {idx + 1}</p>
                                  <p className="text-xs font-semibold text-slate-700 truncate">{item.descricao}</p>
                                </div>
                                {cat.carregando ? <Loader2 size={15} className="animate-spin text-[#032650]" /> : escolhido ? (
                                  <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-lg bg-[#032650] text-white">CATMAT {escolhido.codigo}</span>
                                ) : <span className="text-[11px] text-amber-700">Revisar classificação</span>}
                              </div>
                              {escolhido && cat.opcoes.length > 1 && <p className="text-[11px] text-amber-700 mt-1.5">Há {cat.opcoes.length} opções plausíveis. Compare na próxima etapa.</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <p className="text-xs font-bold text-slate-700">Prontidão para pesquisar</p>
                      <span className="text-[11px] font-bold text-[#032650]">{[!!objetoDesc.trim(), !!formaParcelamento, itens.length > 0, itens.length > 0 && itens.every(i => i.quantidade > 0 && !!i.unidadeMedida), !!localEntrega.trim()].filter(Boolean).length}/5 essenciais</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                      {[
                        ["Objeto", !!objetoDesc.trim()],
                        ["Divisão", !!formaParcelamento],
                        ["Itens", itens.length > 0],
                        ["Qtde./unidade", itens.length > 0 && itens.every(i => i.quantidade > 0 && !!i.unidadeMedida)],
                        ["Local", !!localEntrega.trim()],
                      ].map(([rotulo, ok]: any) => (
                        <div key={rotulo} className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold border ${ok ? "bg-green-50 text-green-700 border-green-100" : "bg-white text-slate-600 border-slate-200"}`}>
                          {ok ? "✓ " : "○ "}{rotulo}
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="mt-3 text-xs font-semibold text-[#032650]">Próximo passo: {resultadoGuiado.proximaAcao}</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px bg-slate-200 flex-1" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">confirme ou ajuste abaixo</span>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            <Field label="Descrição do objeto (visão geral) *">
              <textarea
                className="inp min-h-[110px] resize-y"
                placeholder="Ex: Aquisição de notebooks para uso nas atividades administrativas da Diretoria de Logística..."
                value={objetoDesc}
                onChange={e => { setObjetoDesc(e.target.value); if (erroStep1) setErroStep1(null); }}
              />
              {erroStep1 && <p className="text-xs text-red-600 mt-1">{erroStep1}</p>}
            </Field>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">Como você quer comparar os preços?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: "item", titulo: "Por item", texto: "Cada item recebe sua própria pesquisa e estimativa." },
                  { value: "lote", titulo: "Por lote", texto: "Agrupa itens que precisam ser avaliados em conjunto." },
                  { value: "global", titulo: "Preço global", texto: "Uma única estimativa para a solução completa." },
                ].map(op => (
                  <button key={op.value} type="button" onClick={() => setFormaParcelamento(op.value as FormaParcelamento)} className={`rounded-xl border-2 p-3 text-left transition-all ${formaParcelamento === op.value ? "border-[#032650] bg-[#eef2f8] shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formaParcelamento === op.value ? "border-[#032650]" : "border-slate-300"}`}>{formaParcelamento === op.value && <span className="w-2 h-2 rounded-full bg-[#032650]" />}</span>
                      <span className="text-xs font-bold text-slate-800">{op.titulo}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-500 mt-1.5">{op.texto}</p>
                  </button>
                ))}
              </div>
              {!formaParcelamento && <p className="mt-2 text-[11px] text-slate-600">Se ainda não souber, descreva a necessidade acima e deixe o LEX ajudar a identificar.</p>}
            </div>
            <Field label="Local de entrega ou execução">
              <input className="inp" placeholder="Ex: Porto Velho/RO" value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} />
              <p className="text-[11px] text-slate-600 mt-1">O local ajuda a avaliar frete, disponibilidade regional e comparabilidade das referências.</p>
            </Field>
            {formaParcelamento === "global" && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <strong>Atenção:</strong> No preço global, o valor total será calculado diretamente, sem divisão por unidade.
              </div>
            )}
            {formaParcelamento === "lote" && (
              <div className="p-3 rounded-lg bg-[#eef2f8] border border-[#d5dce8] text-sm text-[#042f5e]">
                <strong>Por lote:</strong> cada lote da próxima etapa terá quantidade e unidade próprias (ex.: Lote 1 — notebooks, Lote 2 — monitores).
              </div>
            )}
          </div>
        </StepCard>
      );

      // ── Etapa 2: Itens/lotes em acordeão (campos dinâmicos) ─────────────────
      case 2: return (
        <StepCard
          title={formaParcelamento === "lote" ? "Lotes da contratação" : formaParcelamento === "global" ? "Item da contratação" : "Itens da contratação"}
          desc={
            formaParcelamento === "lote"
              ? "Cadastre os lotes. Cada lote pode ser expandido para detalhar especificações minuciosas (tamanho, capacidade, potência etc.) e o nº do item no edital."
              : formaParcelamento === "global"
                ? "Cadastre o item com especificação minuciosa. A especificação detalhada evita falhas de precificação por definições genéricas."
                : "Revise cada item e confirme a classificação oficial sugerida. Se houver mais de um CATMAT plausível, o LEX mostra as opções para você comparar."
          }
          footer={<>
            <Btn onClick={prevStep}>Voltar</Btn>
            <Btn primary onClick={async () => {
              const validos = itensEfetivos.filter(i => i.descricao.trim() && i.quantidade > 0 && i.unidadeMedida);
              if (validos.length === 0) {
                await avisar(formaParcelamento === "lote" ? "Adicione pelo menos um item dentro do lote com descrição, quantidade e unidade." : "Adicione pelo menos um item com descrição, quantidade e unidade.", "Falta um item");
                return;
              }
              nextStep();
            }} icon={<ChevronRight size={15}/>}>Continuar para o processo</Btn>
          </>}
        >
          <div className="space-y-3">
            {itens.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-600">
                {formaParcelamento === "global"
                  ? "Adicione o item da contratação."
                  : "Nenhum item cadastrado. Clique em \"Adicionar item\" para começar."}
              </div>
            )}

            {itens.map((item, idx) => {
              const aberto = !!expandido[item.id];
              const rotulo = item.descricao || `Item ${idx + 1}`;
              return (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  {/* cabeçalho do acordeão */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setExpandido(e => ({ ...e, [item.id]: !aberto }))}
                      className="flex items-center gap-2 flex-1 text-left"
                    >
                      <span className={`transition-transform ${aberto ? "rotate-90" : ""}`}>
                        <ChevronRight size={15} className="text-slate-600" />
                      </span>
                      <span className="font-medium text-slate-700 text-sm">
                        {formaParcelamento === "lote" ? `Lote ${idx + 1}` : `Item ${idx + 1}`}: {rotulo}
                      </span>
                      {formaParcelamento === "lote" ? (
                        <span className="text-xs text-gold-700 font-medium bg-[#eef2f8] px-2 py-0.5 rounded-full">
                          {(item.subitens || []).length} {(item.subitens || []).length === 1 ? "item" : "itens"}
                        </span>
                      ) : (item.quantidade > 0 || item.unidadeMedida) && (
                        <span className="text-xs text-slate-600 font-normal">
                          {item.quantidade > 0 ? `${item.quantidade} ` : ""}{item.unidadeMedida || ""}
                        </span>
                      )}
                    </button>
                    <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  </div>

                  {/* corpo do acordeão — campos dinâmicos */}
                  {aberto && (
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-4">

                      {/* ── Modo LOTE: nome do lote + sub-itens ── */}
                      {formaParcelamento === "lote" ? (
                        <>
                          <Field label="Nome do lote *">
                            <input
                              className="inp"
                              placeholder={`Ex: Lote ${idx + 1} — Equipamentos de TI`}
                              value={item.descricao}
                              onChange={e => updateItem(idx, "descricao", e.target.value)}
                            />
                          </Field>

                          {/* Sub-itens */}
                          <div>
                            <p className="text-xs font-bold text-slate-600 mb-2">Itens do lote</p>
                            <div className="space-y-3">
                              {(item.subitens || []).length === 0 && (
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-5 text-center text-xs text-slate-600">
                                  Nenhum item adicionado a este lote ainda.
                                </div>
                              )}
                              {(item.subitens || []).map((sub, si) => (
                                <div key={sub.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-[#032650] bg-[#eef2f8] px-2 py-0.5 rounded-full">
                                      Item {si + 1}
                                    </span>
                                    <button type="button" onClick={() => removeSubItem(idx, si)}
                                      className="p-1 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors">
                                      <X size={13} />
                                    </button>
                                  </div>
                                  <Field label="Descrição do item *">
                                    <input
                                      className="inp bg-white"
                                      placeholder='Ex: Notebook 14" — 16GB RAM, SSD 512GB'
                                      value={sub.descricao}
                                      onChange={e => updateSubItem(idx, si, "descricao", e.target.value)}
                                    />
                                  </Field>
                                  <Field label="Especificação minuciosa">
                                    <textarea
                                      className="inp bg-white min-h-[60px] resize-y"
                                      placeholder="Processador, memória, dimensões, garantia..."
                                      value={sub.especificacao}
                                      onChange={e => updateSubItem(idx, si, "especificacao", e.target.value)}
                                    />
                                    <p className="text-[11px] text-slate-600 mt-1">Informe só características que mudam a comparação de preço; o LEX usa isso para eliminar CATMATs incompatíveis.</p>
                                  </Field>
                                  <div className="rounded-xl border border-[#d5dce8] bg-white p-3">
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <p className="text-[11px] font-bold text-[#032650]">Classificação oficial do item</p>
                                        <p className="text-[11px] text-slate-600 mt-0.5">Compare as opções CATMAT antes de pesquisar preços.</p>
                                      </div>
                                      <button type="button" onClick={() => buscarCatalogoParaItem(sub)} disabled={catalogoPorItem[sub.id]?.carregando || sub.descricao.trim().length < 3} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#032650] border border-[#d5dce8] rounded-lg px-2.5 py-1.5 hover:bg-[#eef2f8] disabled:opacity-40">
                                        {catalogoPorItem[sub.id]?.carregando ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                                        {catalogoPorItem[sub.id]?.opcoes?.length ? "Atualizar" : "Localizar"}
                                      </button>
                                    </div>
                                    {catalogoPorItem[sub.id]?.desatualizado && <p className="mt-2 text-[11px] text-amber-700">A descrição mudou. Atualize antes de continuar.</p>}
                                    {!!catalogoPorItem[sub.id]?.opcoes?.length && (
                                      <div className="mt-2 space-y-1.5">
                                        {catalogoPorItem[sub.id].opcoes.map(op => {
                                          const sel = catalogoPorItem[sub.id]?.selecionado === op.codigo;
                                          return <button key={op.codigo} type="button" onClick={() => selecionarCatalogo(sub.id, op.codigo)} className={`w-full text-left rounded-lg border px-2.5 py-2 ${sel ? "border-[#032650] bg-[#eef2f8]" : "border-slate-200 hover:border-slate-300"}`}>
                                            <div className="flex flex-wrap items-center gap-1.5"><span className="text-[11px] font-bold text-slate-800">{op.tipo} {op.codigo}</span>{op.principal && <span className="text-[8px] font-bold bg-[#032650] text-white rounded px-1.5 py-0.5">LEX</span>}{sel && <span className="text-[8px] font-bold bg-green-100 text-green-700 rounded px-1.5 py-0.5">Selecionado</span>}</div>
                                            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{op.descricao}</p>
                                            {!!op.diferencas?.length && <p className="text-[11px] text-[#032650] mt-1"><b>Diferenças:</b> {op.diferencas.join(" · ")}</p>}
                                          </button>;
                                        })}
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <Field label="Quantidade *">
                                      <input type="number" className="inp bg-white" min={0}
                                        value={sub.quantidade === 0 ? "" : sub.quantidade}
                                        onChange={e => updateSubItem(idx, si, "quantidade", e.target.value === "" ? 0 : Number(e.target.value))} />
                                    </Field>
                                    <Field label="Unidade">
                                      <select className="inp bg-white" value={sub.unidadeMedida}
                                        onChange={e => updateSubItem(idx, si, "unidadeMedida", e.target.value)}>
                                        <option value="">Selecione...</option>
                                        {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
                                      </select>
                                    </Field>
                                    <Field label="Nº edital">
                                      <input className="inp bg-white" placeholder="Ex: 1.1"
                                        value={sub.itemEdital || ""}
                                        onChange={e => updateSubItem(idx, si, "itemEdital", e.target.value)} />
                                    </Field>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button type="button" onClick={() => addSubItem(idx)}
                              className="mt-2 inline-flex items-center gap-1.5 text-xs text-[#032650] hover:text-[#042f5e] font-semibold">
                              <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[11px] font-bold leading-none">+</span>
                              Adicionar item ao lote
                            </button>
                          </div>
                        </>
                      ) : (
                        /* ── Modo ITEM / GLOBAL: campos simples ── */
                        <>
                          <Field label="Descrição do item *">
                            <input
                              className="inp"
                              placeholder='Ex: Notebook 14" — 16GB RAM, SSD 512GB (ou: Papel A4 75g 500 folhas)'
                              value={item.descricao}
                              onChange={e => updateItem(idx, "descricao", e.target.value)}
                            />
                          </Field>
                          <Field label="Especificação minuciosa (tamanho, capacidade, potência, modelo...)">
                            <textarea
                              className="inp min-h-[70px] resize-y"
                              placeholder={'Ex: Processador i5 ou superior, 16GB RAM, SSD 512GB, tela 14" Full HD, peso máx. 1,8kg, garantia 36 meses...'}
                              value={item.especificacao}
                              onChange={e => updateItem(idx, "especificacao", e.target.value)}
                            />
                            <p className="text-[11px] text-slate-600 mt-1"><b>O que ajuda o LEX:</b> capacidade, desempenho, dimensões, garantia, padrão de qualidade, frequência, prazo ou condição de execução que realmente altere o preço.</p>
                          </Field>
                          <div className="rounded-2xl border border-[#d5dce8] bg-[#f8fafc] p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-[#032650]">CATMAT / CATSER sugerido</p>
                                <p className="text-[11px] text-slate-500 mt-1">O código ajuda a encontrar referências comparáveis. O LEX sugere; a área técnica confirma.</p>
                              </div>
                              <button type="button" onClick={() => buscarCatalogoParaItem(item)} disabled={catalogoPorItem[item.id]?.carregando || item.descricao.trim().length < 3} className="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-[#d5dce8] bg-white text-[11px] font-bold text-[#032650] hover:bg-[#eef2f8] disabled:opacity-40">
                                {catalogoPorItem[item.id]?.carregando ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                {catalogoPorItem[item.id]?.desatualizado ? "Atualizar classificação" : catalogoPorItem[item.id]?.opcoes?.length ? "Refazer análise" : "Localizar classificação"}
                              </button>
                            </div>
                            {catalogoPorItem[item.id]?.desatualizado && (
                              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">A descrição mudou depois da última análise. Atualize a classificação antes de pesquisar.</div>
                            )}
                            {catalogoPorItem[item.id]?.erro && (
                              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{catalogoPorItem[item.id]?.erro}</div>
                            )}
                            {!!catalogoPorItem[item.id]?.opcoes?.length && (
                              <div className="mt-3 space-y-2">
                                {catalogoPorItem[item.id].alerta && <p className="text-[11px] text-amber-700">{catalogoPorItem[item.id].alerta}</p>}
                                {catalogoPorItem[item.id].opcoes.map(op => {
                                  const selecionado = catalogoPorItem[item.id]?.selecionado === op.codigo;
                                  return (
                                    <button key={op.codigo} type="button" onClick={() => selecionarCatalogo(item.id, op.codigo)} className={`w-full rounded-xl border-2 p-3 text-left transition-all ${selecionado ? "border-[#032650] bg-white shadow-sm" : "border-slate-200 bg-white/70 hover:border-slate-300"}`}>
                                      <div className="flex items-start gap-3">
                                        <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selecionado ? "border-[#032650]" : "border-slate-300"}`}>{selecionado && <span className="w-2 h-2 rounded-full bg-[#032650]" />}</span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="text-xs font-bold text-slate-900">{op.tipo} {op.codigo}</span>
                                            {op.principal && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-[#032650] text-white">Recomendado pelo LEX</span>}
                                            {selecionado && <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">Selecionado</span>}
                                            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${op.confianca === "alta" ? "bg-green-50 text-green-700" : op.confianca === "media" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>aderência {op.confianca}</span>
                                          </div>
                                          <p className="text-[11px] leading-relaxed text-slate-600 mt-1">{op.descricao}</p>
                                          <p className="text-[11px] leading-relaxed text-slate-600 mt-1">{op.nota}</p>
                                          {!!op.diferencas?.length && <p className="text-[11px] leading-relaxed text-[#032650] mt-1"><span className="font-bold">Diferenças:</span> {op.diferencas.join(" · ")}</p>}
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                            {catalogoPorItem[item.id]?.estimativaPreliminar && (
                              <div className="mt-3 rounded-xl border border-green-100 bg-green-50/60 px-3 py-2.5">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                                  <div>
                                    <p className="text-[11px] font-bold uppercase tracking-wide text-green-700">Referência preliminar de apoio</p>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{formatarMoeda(Number(catalogoPorItem[item.id].estimativaPreliminar.valorUnitario || 0))} por {item.unidadeMedida || "unidade"}</p>
                                  </div>
                                  <span className="text-[11px] text-green-700">{catalogoPorItem[item.id].estimativaPreliminar.referencias || 0} referências comparáveis</span>
                                </div>
                                <p className="text-[11px] text-slate-500 mt-1">É apenas um sinal de mercado para orientar você. A estimativa oficial será formada nas etapas de pesquisa, revisão e cálculo.</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Field label="Quantidade *">
                              <input
                                type="number" className="inp" min={0}
                                placeholder="Ex: 500"
                                value={item.quantidade === 0 ? "" : item.quantidade}
                                onChange={e => updateItem(idx, "quantidade", e.target.value === "" ? 0 : Number(e.target.value))}
                              />
                            </Field>
                            <Field label="Unidade de medida">
                              <select className="inp" value={item.unidadeMedida} onChange={e => updateItem(idx, "unidadeMedida", e.target.value)}>
                                <option value="">Selecione (ex: unidade, resma, kg, m²)...</option>
                                {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </Field>
                            <Field label="Nº do item no edital (PNCP)">
                              <input
                                className="inp"
                                placeholder="Ex: 1.1"
                                value={item.itemEdital || ""}
                                onChange={e => updateItem(idx, "itemEdital", e.target.value)}
                              />
                            </Field>
                            <div className="flex items-end pb-1">
                              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={item.obrigatorio ?? true}
                                  onChange={e => updateItem(idx, "obrigatorio", e.target.checked)}
                                  className="accent-[#032650]"
                                />
                                Obrigatório
                              </label>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {formaParcelamento === "global" && itens.length >= 1 ? null : (
            <button type="button" onClick={addItem} className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#032650] hover:text-[#042f5e] font-medium">
              <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-xs font-bold leading-none">+</span>
              {formaParcelamento === "lote" ? "Adicionar lote" : "Adicionar item"}
            </button>
          )}
        </StepCard>
      );

      // ── Etapa 3: Informações do processo ────────────────────────────────────
      case 3: return (
        <StepCard
          title="Informações do processo"
          desc="Preencha os dados de identificação do processo licitatório."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <Grid2>
            <Field label="Número do processo *">
              <input className="inp" placeholder="Ex: 2026/00123" value={processo.numero} onChange={e => setProcesso({ ...processo, numero: e.target.value })} />
              <p className="text-[11px] text-slate-600 mt-0.5">Ex.: 2026/00123 ou 0001/2026-PG — como consta no SEI/processo físico</p>
            </Field>
            <Field label="Órgão">
              <input className="inp inp-ro" value={processo.orgao} readOnly />
            </Field>
            <Field label="Unidade">
              <input className="inp" placeholder="Ex: SUPLAN/DILIC" value={processo.unidade} onChange={e => setProcesso({ ...processo, unidade: e.target.value })} />
              <p className="text-[11px] text-slate-600 mt-0.5">Ex.: DILOG/Diretoria de Logística ou SUPLAN/DILIC</p>
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

      // ── Etapa 4: Pesquisa de mercado ────────────────────────────────────────
      case 4: return (
        <StepCard
          title="Preços que você já tem"
          desc="Registre cotações que você já coletou com fornecedores. CNPJ e fonte são obrigatórios — é o que garante transparência à pesquisa."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <div className="mb-4">
            <Btn primary onClick={addRegistroMercado} icon={<FileSearch size={14}/>}>Adicionar cotação</Btn>
          </div>

          {pesquisaMercado.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-600">
              Nenhuma cotação registrada. Esta etapa é opcional — as referências do PNCP são buscadas automaticamente na etapa de pesquisa.
            </div>
          ) : (
            <div className="space-y-3">
              {pesquisaMercado.map((reg, idx) => {
                const invalido = !reg.cnpj.trim() || !reg.fonte.trim();
                return (
                  <div key={reg.id} className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Field label="Item relacionado">
                        <select className="inp" value={reg.itemId} onChange={e => updateRegistroMercado(idx, "itemId", e.target.value)}>
                          <option value="global">Objeto (global)</option>
                          {itens.map((i, ii) => (
                            <option key={i.id} value={i.id}>{i.descricao || `Item ${ii + 1}`}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Fornecedor *">
                        <input className="inp" placeholder="Ex: Tech Comércio Ltda" value={reg.fornecedor} onChange={e => updateRegistroMercado(idx, "fornecedor", e.target.value)} />
                      </Field>
                      <Field label="CNPJ *">
                        <input
                          className={`inp ${reg.cnpj && reg.cnpj.replace(/\D/g, "").length !== 14 ? "border-red-300" : ""}`}
                          placeholder="00.000.000/0000-00"
                          value={reg.cnpj}
                          onChange={e => updateRegistroMercado(idx, "cnpj", e.target.value)}
                        />
                        {reg.cnpj && reg.cnpj.replace(/\D/g, "").length !== 14 && (
                          <span className="text-[11px] text-red-500 mt-0.5">CNPJ incompleto (14 dígitos)</span>
                        )}
                      </Field>
                      <Field label="Fonte dos dados *">
                        <input className="inp" placeholder="Ex: cotação por e-mail, nota fiscal, site" value={reg.fonte} onChange={e => updateRegistroMercado(idx, "fonte", e.target.value)} />
                      </Field>
                      <Field label="Valor (R$)">
                        <input type="number" step="0.01" className="inp" placeholder="0,00" value={reg.valor === 0 ? "" : reg.valor} onChange={e => updateRegistroMercado(idx, "valor", e.target.value === "" ? 0 : Number(e.target.value))} />
                      </Field>
                      <Field label="Data">
                        <input type="date" className="inp" value={reg.data} onChange={e => updateRegistroMercado(idx, "data", e.target.value)} />
                      </Field>
                      <Field label="Observação">
                        <input className="inp" placeholder="Ex: válido até..." value={reg.observacao || ""} onChange={e => updateRegistroMercado(idx, "observacao", e.target.value)} />
                      </Field>
                      <div className="flex items-end">
                        <button type="button" onClick={() => removeRegistroMercado(idx)} className="p-1.5 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    {invalido && (
                      <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                         CNPJ e fonte são obrigatórios para validade documental desta cotação.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 leading-relaxed">
            <strong>Transparência documental:</strong> as cotações registradas entram como referências na análise,
            com CNPJ e fonte visíveis no relatório final. A busca automática no PNCP continua sendo executada por item na etapa de pesquisa.
          </div>
        </StepCard>
      );
      // ── Etapa 6 ─────────────────────────────────────────────────────────────
      case 5: return (
        <StepCard
          title="Buscar nas fontes oficiais"
          desc="O LEX consulta as bases públicas (PNCP, Compras.gov.br e Contratos.gov.br) ao mesmo tempo e traz os preços encontrados. Use os filtros para escolher o que interessa."
          footer={
            <div className="flex items-center gap-3">
              <Btn onClick={prevStep}> Voltar</Btn>
              <Btn primary onClick={pesquisarPNCP} icon={pesquisando ? <Loader2 size={14} className="animate-spin"/> : <Search size={14}/>}>
                {pesquisando ? "Buscando…" : "Realizar pesquisa"}
              </Btn>
            </div>
          }
        >
          <div className="space-y-5">
            {/* As 3 fontes que serão consultadas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { nome: "PNCP", sub: "Portal Nacional de Contratações Públicas", url: "pncp.gov.br/api/search", cor: "indigo", icon: <FileSearch size={18}/> },
                { nome: "Dados Abertos", sub: "dadosabertos.compras.gov.br — preços unitários", url: "dadosabertos.compras.gov.br", cor: "teal", icon: <TrendingUp size={18}/> },
                { nome: "Compras.gov", sub: "compras.dados.gov.br — licitações SIASG", url: "compras.dados.gov.br", cor: "orange", icon: <BarChart3 size={18}/> },
              ].map(f => (
                <div key={f.nome} className={`rounded-xl border-2 bg-white p-4 flex items-start gap-3 ${
                  f.cor === "indigo" ? "border-[#d5dce8] bg-[#eef2f8]/40" :
                  f.cor === "teal"   ? "border-slate-200 bg-slate-50/40" :
                  "border-orange-200 bg-orange-50/40"
                }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    f.cor === "indigo" ? "bg-[#eef2f8] text-[#032650]" :
                    f.cor === "teal"   ? "bg-slate-100 text-slate-700" :
                    "bg-orange-100 text-orange-600"
                  }`}>{f.icon}</div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{f.nome}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{f.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Objeto que será pesquisado */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 mb-1">Objeto que será pesquisado</p>
              <p className="text-sm text-slate-700 font-medium">{objetoDesc || <span className="text-slate-600 italic">Nenhum objeto informado</span>}</p>
              {itens.filter(i => i.descricao).length > 0 && (
                <p className="text-[11px] text-slate-600 mt-1">
                  {itens.length} {itens.length === 1 ? "item" : "itens"}: {itens.map(i => i.descricao).filter(Boolean).join(" · ").slice(0, 140)}
                </p>
              )}
            </div>

            {erroPesquisa && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{erroPesquisa}</div>
            )}
          </div>
        </StepCard>
      );

      // ── Etapa 7 ─────────────────────────────────────────────────────────────
      case 6: return (
        <StepCard
          title="Revisão e confirmação"
          desc="Verifique os dados extraídos pela IA e os itens antes de avançar para a pesquisa de preços."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Confirmar e prosseguir</Btn></>}
        >
          <div className="space-y-4">
            {caracteristicasIA.length > 0 ? (
              <div className="rounded-xl border border-[#d5dce8] bg-[#eef2f8] p-4">
                <p className="text-xs font-bold text-[#032650] uppercase tracking-wide mb-2">Características extraídas pela IA</p>
                <div className="flex flex-wrap gap-2">
                  {caracteristicasIA.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-white border border-[#d5dce8] text-[#032650] text-xs font-medium px-2.5 py-1 rounded-full">
                      <span className="text-gold-700 font-semibold">{c.caracteristica}:</span> {c.valor}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 text-center">
                Nenhuma característica extraída pela IA ainda.
              </div>
            )}

            {itens.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-3">
                  {formaParcelamento === "lote" ? "Lotes" : "Itens"} da contratação ({itens.length})
                </p>
                <div className="space-y-2">
                  {itens.map((e, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-[#eef2f8] text-[#032650] text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700">{e.descricao || `Item ${i + 1}`}</p>
                        {e.especificacao && <p className="text-xs text-slate-500 mt-0.5 leading-snug">{e.especificacao}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-600">
                          {(e.quantidade > 0 || e.unidadeMedida) && (
                            <span>{e.quantidade} {e.unidadeMedida || "un"}</span>
                          )}
                          {e.itemEdital && <span className="font-mono">edital: {e.itemEdital}</span>}
                          {formaParcelamento === "lote" && (e.subitens || []).length > 0 && (
                            <span className="text-gold-700 font-medium">{(e.subitens || []).length} {(e.subitens || []).length === 1 ? "item" : "itens"}</span>
                          )}
                        </div>
                        {formaParcelamento === "lote" && (e.subitens || []).length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {(e.subitens || []).map((sub, si) => (
                              <li key={si} className="flex items-start gap-2 text-xs text-slate-600 pl-2 border-l-2 border-[#d5dce8]">
                                <span className="font-medium shrink-0">{si + 1}.</span>
                                <span>{sub.descricao}{sub.quantidade > 0 ? ` · ${sub.quantidade} ${sub.unidadeMedida || "un"}` : ""}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </StepCard>
      );

      // ── Etapa 8 ─────────────────────────────────────────────────────────────
      case 7: return (
        <StepCard
          title="Configurações da pesquisa"
          desc="Defina os parâmetros que controlam a busca e o cálculo do preço estimado."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={pesquisarPNCP} icon={<Search size={14}/>}>Pesquisar preços</Btn></>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Período">
              <select className="inp" value={config.periodo} onChange={e => setConfig({ ...config, periodo: e.target.value as PeriodoPesquisa })}>
                <option value="90_dias">Últimos 90 dias (3 meses)</option>
                <option value="6_meses">Últimos 180 dias (6 meses)</option>
                <option value="12_meses">Último ano (365 dias)</option>
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
            <Field label="Limite de CV (alerta %)" title="Se o coeficiente de variação ultrapassar este limite, o sistema alerta e usa o menor preço">
              <input type="number" className="inp" min={1} max={100} value={config.cvLimite} onChange={e => setConfig({ ...config, cvLimite: Number(e.target.value) || 20 })} />
            </Field>
          </div>
          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            Regra de variação: se a dispersão dos preços pesquisados (coeficiente de variação) ultrapassar o limite acima,
            o sistema emite alerta e aplica automaticamente o <strong>menor preço</strong> como referência de cálculo.
          </p>
        </StepCard>
      );

      // ── Etapa 9 ─────────────────────────────────────────────────────────────
      case 8: return (
        <StepCard
          title="Configurações da pesquisa"
          desc="Ajuste os parâmetros antes de realizar a pesquisa."
          footer={<><Btn onClick={prevStep}> Voltar</Btn><Btn primary onClick={pesquisarPNCP} icon={<Search size={14}/>}>Realizar pesquisa</Btn></>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <Field label="Período da pesquisa">
              <select className="inp" value={config.periodo} onChange={e => setConfig({ ...config, periodo: e.target.value as PeriodoPesquisa })}>
                <option value="6_meses">Últimos 6 meses</option>
                <option value="12_meses">Últimos 12 meses</option>
                <option value="24_meses">Últimos 24 meses</option>
              </select>
            </Field>
            <Field label="Região">
              <select className="inp" value={config.regiao} onChange={e => setConfig({ ...config, regiao: e.target.value as RegiaoPesquisa })}>
                <option value="brasil">Brasil (todo o país)</option>
                <option value="sudeste">Sudeste</option>
                <option value="sul">Sul</option>
                <option value="centro_oeste">Centro-Oeste</option>
                <option value="nordeste">Nordeste</option>
                <option value="norte">Norte</option>
              </select>
            </Field>
          </div>
        </StepCard>
      );

      // ── Etapa 10 ────────────────────────────────────────────────────────────
      case 9: {
        const fmtData = (d: string) => {
          if (!d) return "—";
          try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
        };
        const badgeSit = (sit: string) => {
          if (!sit) return null;
          const l = sit.toLowerCase();
          if (l.includes("divulgada") || l.includes("aberta") || l.includes("recebendo"))
            return <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700 whitespace-nowrap"> {sit}</span>;
          if (l.includes("anulada") || l.includes("cancelada") || l.includes("revogada"))
            return <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700 whitespace-nowrap"> {sit}</span>;
          if (l.includes("encerrada") || l.includes("homologada") || l.includes("adjudicada"))
            return <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 whitespace-nowrap">{sit}</span>;
          return <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">{sit}</span>;
        };
        const rotuloItem = (itemId?: string) => {
          if (!itemId || itemId === "global") return objetoDesc.slice(0, 60) || "Objeto";
          const item = itens.find(i => i.id === itemId);
          return item ? (item.descricao || "Item") : "Item";
        };

        // Agrupa resultados por itemId
        const itemIds = Array.from(new Set(resultados.map(r => r.itemId || "global")));

        // Normaliza string para comparação (remove acentos, lowercase)
        const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Aplica filtro de situação/IA + busca textual sobre todos os resultados
        const aplicarFiltro = (res: ResultadoPNCP[]) => res.filter(r => {
          const db = r.dadosBrutos as any;
          // Filtro de situação
          if (situFiltro === "abertos") {
            const s = norm(db?._situacao || db?.situacao_nome || "");
            if (!(s.includes("divulgada") || s.includes("aberta") || s.includes("recebendo"))) return false;
          }
          if (situFiltro === "encerrados") {
            const s = norm(db?._situacao || db?.situacao_nome || "");
            if (!(s.includes("encerrada") || s.includes("homologada") || s.includes("adjudicada"))) return false;
          }
          if (situFiltro === "ia") {
            if (r.similaridade < 70) return false;
          }
          // Filtro de texto (busca em múltiplos campos)
          if (textoFiltro.trim()) {
            const q = norm(textoFiltro.trim());
            const campos = [
              r.descricao, r.orgao, r.documento_origem, r.localizacao || "",
              db?._modalidade || "", db?._unidade || "", db?._situacao || "",
            ].map(norm).join(" ");
            if (!campos.includes(q)) return false;
          }
          // Filtro por região (melhoria): inferida da localização (UF)
          if (regiaoFiltro !== "todas") {
            const loc = norm(r.localizacao || "");
            const regioes: Record<string, string[]> = {
              norte: ["ac", "am", "ap", "pa", "ro", "rr", "to"],
              nordeste: ["al", "ba", "ce", "ma", "pb", "pe", "pi", "rn", "se"],
              centro_oeste: ["df", "go", "mt", "ms"],
              sudeste: ["es", "mg", "rj", "sp"],
              sul: ["pr", "rs", "sc"],
            };
            const ufs = regioes[regiaoFiltro] || [];
            if (!ufs.some(uf => loc.includes(uf))) return false;
          }
          return true;
        });

        // Ordenação (melhoria): por relevância, valor (crescente/decrescente) ou data
        // PRIORIZAÇÃO (camada 2): quantidade/unidade/local entram como boost de
        // relevância — resultados da mesma região ou com unidade compatível sobem.
        const normTxt = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const boostPrioridade = (r: ResultadoPNCP, itemIdAtual: string): number => {
          let b = 0;
          const filtros = filtrosPorItem[itemIdAtual] || "";
          const local = normTxt(localEntrega);
          const localRes = normTxt(r.localizacao || "");
          if (local && localRes) {
            const cidadeLocal = local.split("/")[0].trim();
            const cidadeRes = localRes.split("/")[0].trim();
            const ufLocal = local.split("/")[1]?.trim() || "";
            const ufRes = localRes.split("/")[1]?.trim() || "";
            if (ufLocal && ufRes && ufLocal === ufRes) b += 30;
            else if (cidadeLocal && cidadeRes && cidadeLocal === cidadeRes) b += 25;
          }
          // Boost +10 se a unidade/quantidade do resultado coincide com a pedida
          const unidPedida = filtros.match(/(\d+\s+)?(resma|unidade|un|kg|m[²2]|caixa|pct|pacote|lote|serviço|servico|mês|mes|diária|diaria)/i);
          if (unidPedida) {
            const un = normTxt(unidPedida[0]);
            const unRes = normTxt(String(r.dadosBrutos?.unidade_medida || r.dadosBrutos?.unidade || ""));
            if (unRes && (unRes.includes(un) || un.includes(unRes))) b += 10;
          }
          return b;
        };
        const ordenar = (res: ResultadoPNCP[]) => {
          const lista = [...res];
          const valorDe = (r: ResultadoPNCP) => r.valor_unitario ?? r.valor_total ?? Infinity;
          switch (ordenacao) {
            case "valor_asc": return lista.sort((a, b) => valorDe(a) - valorDe(b));
            case "valor_desc": return lista.sort((a, b) => valorDe(b) - valorDe(a));
            case "data_desc": return lista.sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
            default: return lista.sort((a, b) => (b.similaridade + boostPrioridade(b, a.itemId || "global")) - (a.similaridade + boostPrioridade(a, a.itemId || "global")));
          }
        };

        const totalGeral = Object.values(totalPorItem).reduce((a, b) => a + b, 0);
        const comPreco = resultados.filter(r => (r.valor_unitario ?? 0) > 0).length;
        const precosValidos = resultados.map(r => r.valor_unitario).filter((v): v is number => typeof v === "number" && v > 0);
        const menorPreco = precosValidos.length ? Math.min(...precosValidos) : null;

        // Tabela de resultados de um item específico
        const TabelaItem = ({ itemId }: { itemId: string }) => {
          const todosDoItem = resultados.filter(r => (r.itemId || "global") === itemId);
          const filtrados   = ordenar(aplicarFiltro(todosDoItem));
          const pagAtual    = paginaPorItem[itemId] || 1;
          const totalItem   = totalPorItem[itemId] || todosDoItem.length;
          const totalPags   = totalPagsPorItem[itemId] || 1;

          return (
            <div className="mb-8">
              {/* Cabeçalho da tabela deste item */}
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#032650] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {itemIds.indexOf(itemId) + 1}
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm">{rotuloItem(itemId)}</h3>
                  <span className="text-xs text-slate-600">
                    {totalItem.toLocaleString("pt-BR")} editais · pág. {pagAtual}/{totalPags}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button disabled={pagAtual <= 1}
                    onClick={() => buscarPaginaItem(itemId, pagAtual - 1)}
                    className="px-3 py-1 text-xs border border-slate-300 rounded-lg font-semibold disabled:opacity-30 hover:bg-slate-50 transition-colors">
                     Anterior
                  </button>
                  <button disabled={pagAtual >= totalPags}
                    onClick={() => buscarPaginaItem(itemId, pagAtual + 1)}
                    className="px-3 py-1 text-xs border border-slate-300 rounded-lg font-semibold disabled:opacity-30 hover:bg-slate-50 transition-colors">
                    Próxima 
                  </button>
                </div>
              </div>

              {filtrados.length === 0 ? (
                <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 py-8 text-center text-slate-600 text-sm">
                  Nenhum edital encontrado com o filtro selecionado.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse" style={{minWidth: 960}}>
                      <thead>
                        <tr className="bg-slate-800 text-slate-200">
                          <th className="px-2 py-2.5 text-center w-8 border-r border-slate-700">
                            <input type="checkbox" className="rounded accent-[#032650] cursor-pointer"
                              checked={filtrados.length > 0 && filtrados.every(r => selecionados.has(r.id))}
                              onChange={e => {
                                setSelecionados(prev => {
                                  const next = new Set(prev);
                                  filtrados.forEach(r => e.target.checked ? next.add(r.id) : next.delete(r.id));
                                  return next;
                                });
                                setResultados(prev => prev.map(r =>
                                  filtrados.some(f => f.id === r.id)
                                    ? { ...r, status_avaliacao: e.target.checked ? "aceito" : "pendente" }
                                    : r
                                ));
                              }}
                            />
                          </th>
                          <th className="px-3 py-2.5 text-center w-10 border-r border-slate-700 text-[11px] uppercase tracking-wider">#</th>
                          <th className="px-3 py-2.5 text-left w-[160px] border-r border-slate-700 text-[11px] uppercase tracking-wider">Nº PNCP</th>
                          <th className="px-3 py-2.5 text-left w-[180px] border-r border-slate-700 text-[11px] uppercase tracking-wider">Órgão / Unidade</th>
                          <th className="px-3 py-2.5 text-left border-r border-slate-700 text-[11px] uppercase tracking-wider">Objeto da Contratação</th>
                          <th className="px-3 py-2.5 text-left w-[110px] border-r border-slate-700 text-[11px] uppercase tracking-wider">Modalidade</th>
                          <th className="px-3 py-2.5 text-left w-[100px] border-r border-slate-700 text-[11px] uppercase tracking-wider">Local</th>
                          <th className="px-3 py-2.5 text-left w-[72px] border-r border-slate-700 text-[11px] uppercase tracking-wider">Publicação</th>
                          <th className="px-3 py-2.5 text-right w-[100px] border-r border-slate-700 text-[11px] uppercase tracking-wider">Vlr. unit. (B)</th>
                          <th className="px-3 py-2.5 text-right w-[110px] border-r border-slate-700 text-[11px] uppercase tracking-wider">Vlr. total edital (A)</th>
                          <th className="px-3 py-2.5 text-left w-[110px] border-r border-slate-700 text-[11px] uppercase tracking-wider">Situação</th>
                          <th className="px-3 py-2.5 text-center w-[70px] text-[11px] uppercase tracking-wider">Edital</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrados.map((r, idx) => {
                          const db      = r.dadosBrutos as any;
                          const sit     = db?._situacao || db?.situacao_nome || "";
                          const modal   = db?._modalidade || db?.modalidade_licitacao_nome || "";
                          const unidade = db?._unidade || db?.unidade_nome || "";
                          const isAceito  = r.status_avaliacao === "aceito";
                          const isRejeit  = r.status_avaliacao === "rejeitado";
                          return (
                            <tr key={r.id} className={`border-b transition-colors ${
                              selecionados.has(r.id) ? "bg-[#eef2f8] border-[#d5dce8]" :
                              isAceito ? "bg-green-50 border-green-100" :
                              isRejeit ? "bg-red-50/50 opacity-60 border-red-100" :
                              idx % 2 === 0 ? "bg-white border-slate-100 hover:bg-[#eef2f8]/20" : "bg-slate-50/60 border-slate-100 hover:bg-[#eef2f8]/20"
                            }`}>
                              <td className="px-2 py-2 text-center border-r border-slate-100">
                                <input type="checkbox" className="rounded accent-[#032650] cursor-pointer"
                                  checked={selecionados.has(r.id)}
                                  onChange={e => {
                                    setSelecionados(prev => {
                                      const next = new Set(prev);
                                      e.target.checked ? next.add(r.id) : next.delete(r.id);
                                      return next;
                                    });
                                    setResultados(prev => prev.map(x =>
                                      x.id === r.id ? { ...x, status_avaliacao: e.target.checked ? "aceito" : "pendente" } : x
                                    ));
                                  }}
                                />
                              </td>
                              <td className="px-3 py-2 text-center text-slate-600 font-bold border-r border-slate-100">{idx + 1}</td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <span className="font-mono text-[11px] text-slate-500 leading-tight break-all">{r.documento_origem || "—"}</span>
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <div className="font-semibold text-[#032650] text-[11px] leading-tight" style={{maxWidth:176}} title={r.orgao}>
                                  {r.orgao.length > 45 ? r.orgao.slice(0, 45) + "…" : r.orgao}
                                </div>
                                {unidade && <div className="text-[11px] text-slate-600 mt-0.5" title={unidade}>{unidade.length > 40 ? unidade.slice(0,40)+"…" : unidade}</div>}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <span className="text-slate-700 leading-snug" title={r.descricao}>
                                  {r.descricao.length > 150 ? r.descricao.slice(0, 150) + "…" : r.descricao}
                                </span>
                                {r.similaridade > 0 && iaFiltroReady && (
                                  <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded text-[11px] font-bold ${r.similaridade >= 70 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"}`}>
                                    IA {r.similaridade}%
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100 text-slate-500 text-[11px]">
                                {modal ? (modal.length > 20 ? modal.slice(0,20)+"…" : modal) : "—"}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100 text-slate-500 whitespace-nowrap text-[11px]">{r.localizacao || "—"}</td>
                              <td className="px-3 py-2 border-r border-slate-100 text-slate-500 whitespace-nowrap text-[11px]">{fmtData(r.data)}</td>
                              <td className="px-3 py-2 border-r border-slate-100 text-right font-mono font-bold whitespace-nowrap">
                                {r.valor_unitario != null && r.valor_unitario > 0
                                  ? <span className="text-green-700">{formatarMoeda(r.valor_unitario)}</span>
                                  : <span className="text-slate-300 text-[11px]">buscando…</span>}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100 text-right font-mono text-slate-600 whitespace-nowrap text-[11px]">
                                {r.valor_total != null && r.valor_total > 0 ? formatarMoeda(r.valor_total) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">{sit ? badgeSit(sit) : <span className="text-slate-300">—</span>}</td>
                              <td className="px-3 py-2 text-center">
                                {r.link_origem
                                  ? <a href={r.link_origem} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#032650] hover:bg-[#032650] text-white text-[11px] font-bold transition-colors shadow-sm">
                                      <ExternalLink size={9}/> Abrir
                                    </a>
                                  : <span className="text-slate-200">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Paginação inferior */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500">
                      Página {pagAtual} de {totalPags} · {totalItem.toLocaleString("pt-BR")} editais no PNCP
                    </span>
                    <div className="flex gap-2">
                      <button disabled={pagAtual <= 1} onClick={() => buscarPaginaItem(itemId, pagAtual - 1)}
                        className="px-3 py-1 text-xs border rounded font-semibold disabled:opacity-30 hover:bg-white transition-colors"> Anterior</button>
                      <button disabled={pagAtual >= totalPags} onClick={() => buscarPaginaItem(itemId, pagAtual + 1)}
                        className="px-3 py-1 text-xs border rounded font-semibold disabled:opacity-30 hover:bg-white transition-colors">Próxima </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="flex flex-col">
            {/* Resumo do que foi encontrado — orienta antes de sair aceitando referências */}
            {resultados.length > 0 && (
              <div className="grid grid-cols-2 gap-3 px-6 pt-4 lg:grid-cols-4 lg:px-8">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Editais encontrados</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{totalGeral.toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Itens pesquisados</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{itemIds.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Com preço</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{comPreco.toLocaleString("pt-BR")}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{menorPreco != null ? `menor: ${formatarMoeda(menorPreco)}` : "buscando preços…"}</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-3.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Aceitas p/ o cálculo</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-green-800">{nAceitos}</p>
                  <p className="mt-0.5 text-[11px] text-green-700">marque nas tabelas abaixo</p>
                </div>
              </div>
            )}

            {/* Barra de filtros sticky */}
            <div className="sticky top-[56px] z-10 px-6 lg:px-8 pt-3 pb-3 bg-white border-b border-slate-200 shadow-sm">
              {/* Linha 1: busca inteligente */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none"/>
                  <input
                    type="text"
                    value={textoFiltro}
                    onChange={e => setTextoFiltro(e.target.value)}
                    placeholder="Buscar por descrição, órgão, nº PNCP, modalidade, localização…"
                    className="w-full pl-8 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-[#0a3a6e] focus:ring-4 focus:ring-[#0a3a6e]/20 transition-colors bg-slate-50 placeholder:text-slate-600"
                  />
                  {textoFiltro && (
                    <button onClick={() => setTextoFiltro("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-600 transition-colors">
                      <X size={14}/>
                    </button>
                  )}
                </div>
                <button onClick={() => pesquisarPNCP()}
                  title="Refazer pesquisa no PNCP"
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-slate-200 text-slate-600 text-xs font-semibold hover:border-slate-300 hover:bg-slate-50 transition-colors">
                  <RefreshCw size={13}/> Refazer
                </button>
              </div>

              {/* Linha 2: pills de situação + badges */}
              <div className="flex items-center gap-2 flex-wrap">
                {([
                  { id: "todos",      label: "Todos",         cor: "slate" },
                  { id: "abertos",    label: "◉ Abertos",     cor: "green" },
                  { id: "encerrados", label: "◎ Encerrados",  cor: "gray" },
                ] as const).map(f => (
                  <button key={f.id} type="button" onClick={() => setSituFiltro(f.id as any)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      situFiltro === f.id
                        ? f.cor === "green" ? "bg-green-600 text-white border-green-600"
                          : f.cor === "gray" ? "bg-slate-500 text-white border-slate-500"
                          : "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-slate-600 border-slate-300 hover:border-slate-400"
                    }`}>
                    {f.label}
                  </button>
                ))}
                <button type="button" onClick={() => setSituFiltro("ia")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                    situFiltro === "ia"
                      ? "bg-[#032650] text-white border-[#032650]"
                      : iaAnalisando
                        ? "bg-white text-gold-700 border-[#d5dce8] cursor-wait"
                        : "bg-white text-[#032650] border-[#C9A227] hover:border-[#032650]"
                  }`}>
                  {iaAnalisando
                    ? <><Loader2 size={10} className="animate-spin"/> Analisando…</>
                    : <><Sparkles size={10}/> Alta relevância (≥70%)</>}
                </button>
                {/* Filtro por região (melhoria) */}
                <select
                  value={regiaoFiltro}
                  onChange={e => setRegiaoFiltro(e.target.value)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-600 focus:outline-none focus:border-[#0a3a6e] cursor-pointer"
                  title="Filtrar por região (inferida da localização do edital)"
                >
                  <option value="todas"> Todas as regiões</option>
                  <option value="norte">Norte</option>
                  <option value="nordeste">Nordeste</option>
                  <option value="centro_oeste">Centro-Oeste</option>
                  <option value="sudeste">Sudeste</option>
                  <option value="sul">Sul</option>
                </select>
                {/* Ordenação (melhoria) */}
                <select
                  value={ordenacao}
                  onChange={e => setOrdenacao(e.target.value as any)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-600 focus:outline-none focus:border-[#0a3a6e] cursor-pointer"
                  title="Ordenar resultados"
                >
                  <option value="relevancia">Relevância</option>
                  <option value="valor_asc">Menor valor </option>
                  <option value="valor_desc">Maior valor </option>
                  <option value="data_desc">Mais recentes</option>
                </select>
                {/* Separador + badges de contagem */}
                <span className="text-slate-300 text-xs">|</span>
                {totalGeral > 0 && (
                  <span className="inline-flex items-center gap-1 bg-[#eef2f8] text-[#032650] px-2 py-0.5 rounded-full text-xs font-semibold">
                    <FileSearch size={9}/> {totalGeral.toLocaleString("pt-BR")} editais
                  </span>
                )}
                {selecionados.size > 0 && (
                  <span className="inline-flex items-center gap-1 bg-green-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                    <Check size={9}/> {selecionados.size} aceito{selecionados.size !== 1 ? "s" : ""} (usados no cálculo)
                    <button onClick={() => {
                      const ids = new Set(selecionados);
                      setSelecionados(new Set());
                      setResultados(prev => prev.map(r => ids.has(r.id) ? { ...r, status_avaliacao: "pendente" } : r));
                    }} className="ml-0.5 hover:opacity-70 transition-opacity"><X size={9}/></button>
                  </span>
                )}
                {nAceitos > 0 && (
                  <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                    <Check size={9}/> {nAceitos} aceitas
                  </span>
                )}
              </div>
            </div>

            {/* Conteúdo */}
            <div className="px-6 lg:px-8 py-6">
              {/* AGENTE PESQUISADOR: progresso dos itens pesquisados em paralelo */}
              {Object.keys(progressoItens).length > 0 && (
                <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      Agente Pesquisador — itens em andamento
                    </p>
                    {Object.values(progressoItens).some(p => p.status === "buscando") && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#032650]">
                        <Loader2 size={11} className="animate-spin" /> pesquisando em paralelo…
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {Object.entries(progressoItens).map(([itemId, prog]) => {
                      const rotulo = parametrosBusca?.find(p => p.rotulo === (itemId === "global" ? objetoDesc.slice(0, 60) : itens.find(i => i.id === itemId)?.descricao?.slice(0, 60)))?.rotulo
                        || itens.find(i => i.id === itemId)?.descricao?.slice(0, 60)
                        || (itemId === "global" ? objetoDesc.slice(0, 60) : itemId);
                      return (
                        <div key={itemId} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {prog.status === "buscando" ? (
                              <Loader2 size={13} className="animate-spin text-gold-700 shrink-0" />
                            ) : prog.status === "ok" ? (
                              <CheckCircle2 size={13} className="text-green-600 shrink-0" />
                            ) : (
                              <AlertCircle size={13} className="text-red-500 shrink-0" />
                            )}
                            <span className="text-xs font-semibold text-slate-700 truncate">{rotulo}</span>
                            {prog.status === "ok" && (
                              <span className="text-[11px] text-slate-500 shrink-0">— {prog.total?.toLocaleString("pt-BR")} editais</span>
                            )}
                            {prog.status === "falha" && (
                              <span className="text-[11px] text-red-500 shrink-0">— {prog.erro || "falhou"}</span>
                            )}
                          </div>
                          {prog.status === "falha" && (
                            <button
                              onClick={() => refazerItem(itemId)}
                              disabled={refazendoItem === itemId}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50 shrink-0"
                            >
                              {refazendoItem === itemId ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                              Refazer item
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Parâmetros que o agente juntou na busca */}
              {parametrosBusca && parametrosBusca.length > 0 && (
                <div className="mb-4 rounded-lg border border-[#d5dce8] bg-[#eef2f8]/40 px-4 py-3">
                  <p className="text-[11px] font-bold text-[#032650] uppercase tracking-wide mb-1.5">
                     Como o agente buscou
                  </p>
                  <div className="space-y-1">
                    {parametrosBusca.map((p, i) => (
                      <div key={i} className="text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700">{p.rotulo}:</span>{" "}
                        <span className="font-mono text-[#042f5e]">{p.termo}</span>
                        {p.filtros && <span className="text-slate-600"> · priorizando: {p.filtros}</span>}
                        {p.parametros && <span className="text-slate-300"> — {p.parametros}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {erroPaginacao && (
                <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <span>{erroPaginacao}</span>
                  <button onClick={() => setErroPaginacao(null)} className="shrink-0 hover:opacity-70 transition-opacity"><X size={13}/></button>
                </div>
              )}
              {pesquisando ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-gold-700" />
                  <p className="text-sm text-slate-500">Consultando o PNCP…</p>
                </div>
              ) : erroPesquisa ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <AlertCircle className="w-10 h-10 text-amber-500" />
                  <p className="text-sm text-slate-600">{erroPesquisa}</p>
                  <Btn primary onClick={pesquisarPNCP} icon={<Search size={14}/>}>Tentar novamente</Btn>
                </div>
              ) : resultados.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <FileSearch className="w-10 h-10 text-slate-300" />
                  <p className="text-sm text-slate-600">Nenhum resultado. Clique em "Refazer pesquisa" ou volte para ajustar os termos.</p>
                </div>
              ) : (
                itemIds.map(itemId => <TabelaItem key={itemId} itemId={itemId} />)
              )}

              {/* Ações */}
              {resultados.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-3 flex-wrap">
                  <Btn onClick={() => goToStep(8)}> Configurações</Btn>
                  <button
                    onClick={() => { calcular(); goToStep(12); }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold cursor-pointer"
                    title="Calcula com as referências aceitas e abre o quadro comparativo com o valor estimado"
                  >
                    <Calculator size={13} />  Calcular direto (quadro comparativo)
                  </button>
                  <Btn primary onClick={() => { const r = calcular(); nextStep(); if (r) gerarConteudoIA(r.stats, r.nAceitas); }} icon={<BarChart3 size={14}/>}>
                    Calcular e analisar
                  </Btn>
                </div>
              )}
            </div>
          </div>
        );
      }

      // ── Etapa 11 ────────────────────────────────────────────────────────────
      case 10: return (
        <StepCard
          title="Justificativa do preço (automática)"
          desc="Gera o texto que explica como o preço foi formado, com base nas referências aceitas. Esta etapa é opcional — você pode pular."
          footer={
            <div className="flex items-center gap-3 flex-wrap">
              <Btn onClick={() => goToStep(9)}> Revisar referências</Btn>
              <Btn icon={iaLoading ? <Loader2 size={13} className="animate-spin"/> : <RefreshCw size={13}/>}
                disabled={iaLoading}
                onClick={() => {
                  setJustificativaIA(null);
                  setValidacaoIA(null);
                  const r = calcular();
                  const stats = r?.stats ?? estatisticas;
                  const nAce  = r?.nAceitas ?? resultados.filter(r => r.status_avaliacao === "aceito").length;
                  if (!stats) {
                    setJustificativaIA(" Nenhuma referência aceita com valor disponível. Na tabela de resultados (etapa anterior), clique em  Aceitar em pelo menos 3 editais que tenham valor na coluna **Vlr. total edital (A)** ou **Vlr. unit. (B)**.");
                    return;
                  }
                  gerarConteudoIA(stats, nAce);
                }}>
                {iaLoading ? "Gerando…" : "Gerar justificativa"}
              </Btn>
              <Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo </Btn>
            </div>
          }
        >
          {justificativaIA ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Justificativa gerada pela IA</p>
              {justificativaIA}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-600 rounded-xl bg-slate-50 border border-dashed border-slate-200">
              <Sparkles size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Justificativa não gerada ainda.</p>
              <p className="text-xs mt-1">Clique em &quot;Gerar justificativa&quot; para acionar o agente IA, ou pule esta etapa.</p>
            </div>
          )}
          {validacaoIA && (
            <div className={`mt-4 rounded-xl border p-4 ${validacaoIA.valido ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center gap-2 mb-2">
                {validacaoIA.valido
                  ? <CheckCircle2 size={16} className="text-green-600" />
                  : <AlertCircle size={16} className="text-amber-600" />}
                <p className={`text-sm font-semibold ${validacaoIA.valido ? "text-green-800" : "text-amber-800"}`}>
                  {validacaoIA.valido
                    ? `Validação aprovada — score: ${validacaoIA.score_confianca}/100`
                    : `Score de confiança: ${validacaoIA.score_confianca}/100`}
                </p>
              </div>
              {(validacaoIA.alertas || []).map((a: any, i: number) => (
                <div key={i} className={`mt-1.5 text-xs px-3 py-2 rounded-lg ${a.tipo === "erro" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  <span className="font-semibold">{a.campo}:</span> {a.mensagem}
                  {a.sugestao && <span className="block mt-0.5 opacity-80"> {a.sugestao}</span>}
                </div>
              ))}
            </div>
          )}

          {analiseCritica && (
            <div className="mt-6 rounded-xl border border-[#d5dce8] bg-[#eef2f8]/50 p-5">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={16} className="text-[#032650]" />
                <p className="text-sm font-semibold text-[#032650]">Análise crítica das referências</p>
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  analiseCritica.forcaDispersao === "baixa" ? "bg-green-100 text-green-700"
                  : analiseCritica.forcaDispersao === "media" ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"}`}>
                  dispersão {analiseCritica.forcaDispersao}
                </span>
              </div>
              <p className="text-xs text-[#032650]/80 mb-3">{analiseCritica.resumo}</p>
              <div className="space-y-2">
                {analiseCritica.pontos.map((p, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${
                    p.severidade === "alerta" ? "border-red-200 bg-red-50 text-red-800"
                    : p.severidade === "atencao" ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-700"}`}>
                    <p className="font-semibold">
                      {p.severidade === "alerta" ? " " : p.severidade === "atencao" ? "• " : "ℹ "}{p.titulo}
                    </p>
                    <p className="mt-0.5 opacity-90">{p.detalhe}</p>
                  </div>
                ))}
              </div>
              {analiseCritica.sugestaoJustificativa && (
                <div className="mt-3 rounded-lg bg-white border border-[#d5dce8] p-3">
                  <p className="text-[11px] font-semibold text-gold-700 uppercase tracking-wide mb-1">Sugestão para a justificativa</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{analiseCritica.sugestaoJustificativa}</p>
                  <button
                    onClick={async () => { await navigator.clipboard.writeText(analiseCritica.sugestaoJustificativa); await avisar("Sugestão copiada para a área de transferência.", "Copiado"); }}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-[#032650] hover:text-[#042f5e] font-medium cursor-pointer"
                  >
                    <ClipboardList size={12} /> Copiar sugestão
                  </button>
                </div>
              )}
            </div>
          )}

          {historicoOrgaoRows && historicoOrgaoRows.length > 0 && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-slate-600" />
                <p className="text-sm font-semibold text-slate-800">Histórico do seu órgão (referência defensável)</p>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Valores já estimados pelo seu órgão em pesquisas anteriores para objetos semelhantes — a comparação mais valorizada em auditoria.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      {["Processo", "Objeto", "Unit.", "Total", "Qtd", "Data", "Método"].map(h => (
                        <th key={h} className="text-left py-2 px-3 font-medium text-slate-500 text-xs uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historicoOrgaoRows.map((h) => (
                      <tr key={h.id} className="border-b border-slate-100">
                        <td className="py-2 px-3 text-xs font-mono text-slate-500">{h.processoNumero || "—"}</td>
                        <td className="py-2 px-3 max-w-[240px] truncate" title={h.objeto}>{h.objeto}</td>
                        <td className="py-2 px-3">{h.precoUnitario != null ? `R$ ${h.precoUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</td>
                        <td className="py-2 px-3">{h.precoTotal != null ? `R$ ${h.precoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</td>
                        <td className="py-2 px-3">{h.quantidade ?? "—"} {h.unidadeMedida || ""}</td>
                        <td className="py-2 px-3 text-xs text-slate-500">{h.data ? new Date(h.data).toLocaleDateString("pt-BR") : "—"}</td>
                        <td className="py-2 px-3 text-xs text-slate-500">{String(h.metodo || "").replace("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 12 ────────────────────────────────────────────────────────────
      case 11: return (
        <StepCard
          title="Resumo dos preços"
          desc="Como os preços aceitos se distribuem. Os detalhes técnicos ficam guardados — abra só se precisar."
          footer={<><Btn onClick={() => goToStep(9)}>Voltar</Btn><Btn primary onClick={nextStep} icon={<TrendingUp size={14}/>}>Gerar preço estimado</Btn></>}
        >
          {estatisticas ? (
            <>
              {alertaCv && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 leading-relaxed">
                  <strong> Regra de variação aplicada (CV &gt; {alertaCv.limite}%):</strong> a dispersão das referências
                  ({alertaCv.cv.toFixed(1).replace(".", ",")}%) ultrapassou o limite. O cálculo usou automaticamente o
                  <strong> menor preço</strong> como referência, evitando média distorcida. Método efetivo: <strong>{alertaCv.metodoEfetivo.replace(/_/g, " ")}</strong>.
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
                <StatBox label="Preços aceitos" value={estatisticas.n.toString()} />
                <StatBox label="Média" value={formatarMoeda(estatisticas.media)} />
                <StatBox label="Mediana" value={formatarMoeda(estatisticas.mediana)} />
                <StatBox label="Menor" value={formatarMoeda(estatisticas.minimo)} />
                <StatBox label="Maior" value={formatarMoeda(estatisticas.maximo)} />
              </div>
              <Detalhes titulo="Ver detalhes técnicos (variação, desvio padrão e memória de cálculo)">
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <StatBox label="Desvio padrão" value={estatisticas.desvioPadrao.toFixed(2).replace(".", ",")} />
                  <StatBox label="Variação (CV)" value={`${estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%`}
                    badge={estatisticas.coeficienteVariacao <= 15 ? "ok" : estatisticas.coeficienteVariacao <= config.cvLimite ? "warn" : "err"} />
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Memória de cálculo</p>
                  <div className="font-mono text-xs text-slate-600 space-y-1">
                    <p>Referências aceitas: {estatisticas.n}</p>
                    <p>Valores: {resultados.filter(r => r.status_avaliacao === "aceito").map(r => formatarMoeda(r.valor_unitario ?? 0)).join(" | ")}</p>
                    <p>Média = {formatarMoeda(estatisticas.media)} · Mediana = {formatarMoeda(estatisticas.mediana)}</p>
                    <p>Mínimo = {formatarMoeda(estatisticas.minimo)} · Máximo = {formatarMoeda(estatisticas.maximo)}</p>
                    <p>Desvio padrão = {estatisticas.desvioPadrao.toFixed(2).replace(".", ",")} · CV = {estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%</p>
                    <p>Limite de CV: {config.cvLimite}% · Método efetivo: {(metodoEfetivo || config.metodo).replace(/_/g, " ")}</p>
                  </div>
                </div>
              </Detalhes>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-600">
              Nenhum resultado aceito. Volte e aceite pelo menos um registro.
            </div>
          )}
        </StepCard>
      );

      // ── Etapa 13 ────────────────────────────────────────────────────────────
      case 12: return (
        <StepCard
          title="Preço estimado"
          desc="Resultado final do cálculo com base nas referências aceitas."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={async () => { await salvarPesquisa(); nextStep(); }} icon={salvandoPesquisa ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle2 size={14}/>}>{salvandoPesquisa ? "Salvando..." : "Salvar e avançar"}</Btn></>}
        >
          {precoEstimado ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border-2 border-[#d5dce8] bg-[#eef2f8] p-4 text-center">
                  <p className="text-xs font-semibold text-gold-700 uppercase tracking-wide mb-1">Valor unitário estimado</p>
                  <p className="text-2xl font-bold text-[#032650] tabular-nums">{formatarMoeda(precoEstimado.unitario)}</p>
                </div>
                <div className="rounded-xl border-2 border-[#d5dce8] bg-[#eef2f8] p-4 text-center">
                  <p className="text-xs font-semibold text-gold-700 uppercase tracking-wide mb-1">Valor total estimado</p>
                  <p className="text-2xl font-bold text-[#032650] tabular-nums">{formatarMoeda(precoEstimado.total)}</p>
                  <p className="text-xs text-gold-700 mt-1">{quantidade} {unidadeMedida}(s)</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">Método aplicado</p>
                  <p className="text-base font-semibold text-slate-700">{(metodoEfetivo || config.metodo).replace(/_/g, " ")}</p>
                  {alertaCv && <p className="text-[11px] text-red-500 mt-1 font-medium">CV acima do limite  menor preço</p>}
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
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 px-4 text-center">
              <Sparkles size={20} className="mx-auto mb-2 text-gold-700" />
              <p className="text-sm font-semibold text-slate-700">Antes de calcular, o LEX precisa entender o objeto.</p>
              <p className="mt-1 text-xs text-slate-500">O agente identifica equivalências, possibilidades de busca e quais referências parecem realmente comparáveis. Você não precisa aceitar um resultado qualquer só para destravar o cálculo.</p>
            </div>
          )}

          {/* ── CALCULAR DIRETO: SEMPRE visível — botão calcula na hora ── */}
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-green-600 text-white flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calculator size={15} />
                <p className="text-sm font-bold"> Calcular direto — quadro comparativo</p>
              </div>
              <span className="text-[11px] font-medium bg-white/20 px-2 py-0.5 rounded-full">agente automático</span>
            </div>
            <div className="p-4">
              {(() => {
                // CALCULAR DIRETO: usa os resultados da pesquisa automaticamente
                const fonte = usadosCalcularDireto.length > 0 ? usadosCalcularDireto : resultados.filter(r => (r.valor_unitario != null || r.valor_total != null));
                if (fonte.length === 0) {
                  return (
                    <div className="text-center py-4">
                      <p className="text-xs text-slate-500 mb-3">Pesquise primeiro (aba Pesquisa  Realizar pesquisa) para buscar os preços. Depois clique abaixo:</p>
                      <button
                        onClick={() => goToStep(5)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg cursor-pointer"
                      >
                        <Search size={13} /> Ir para a pesquisa
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="space-y-4">
                    {/* Referência legal IN 126/2023-TJRO — disponível, mas não na cara */}
                    <Detalhes titulo="Ver base legal (IN 126/2023-TJRO)">
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        <strong>Base legal:</strong> Instrução nº 126/2023-TJRO (art. 3º, III e VII; art. 8º; art. 11) — pesquisa de preços para bens e serviços de qualquer natureza no TJRO.
                      </p>
                    </Detalhes>

                    {/* Inteligência antes do cálculo direto */}
                    {!precoEstimado && (
                      <div className="space-y-4 py-2">
                        {!analisePrecificacaoIA ? (
                          <div className="rounded-xl border border-[#d5dce8] bg-white p-4">
                            <div className="flex items-start gap-3">
                              <Sparkles size={18} className="mt-0.5 text-gold-700 shrink-0" />
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-[#032650]">Primeiro, entender o produto</p>
                                <p className="mt-1 text-xs text-slate-500 leading-relaxed">O agente vai ler o objeto, identificar o que realmente define comparabilidade, criar variações úteis de busca e separar referências compatíveis das que precisam de revisão.</p>
                                {erroPrecificacaoIA && <p className="mt-2 text-xs text-red-600">{erroPrecificacaoIA}</p>}
                                <button
                                  onClick={() => analisarObjetoAntesDoCalculo()}
                                  disabled={analisandoPrecificacaoIA}
                                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#032650] hover:bg-[#0b376b] disabled:opacity-60 px-4 py-2 rounded-lg cursor-pointer"
                                >
                                  {analisandoPrecificacaoIA ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                                  {analisandoPrecificacaoIA ? "Entendendo o objeto..." : "Analisar objeto e criar possibilidades"}
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-[#d5dce8] bg-white p-4 space-y-4">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-700">O que o agente entendeu</p>
                              <p className="mt-1 text-sm text-slate-700 leading-relaxed">{analisePrecificacaoIA.entendimento}</p>
                            </div>

                            {(analisePrecificacaoIA.pontosQueDefinemComparabilidade || []).length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-700 mb-2">O que precisa bater para comparar</p>
                                <div className="flex flex-wrap gap-2">
                                  {analisePrecificacaoIA.pontosQueDefinemComparabilidade.map((p: string, i: number) => <span key={i} className="text-[11px] rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-slate-600">{p}</span>)}
                                </div>
                              </div>
                            )}

                            {(analisePrecificacaoIA.possibilidadesBusca || []).length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-slate-700 mb-2">Possibilidades que o agente criou para pesquisar</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {analisePrecificacaoIA.possibilidadesBusca.map((p: any, i: number) => (
                                    <div key={i} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                      <p className="text-xs font-semibold text-slate-800">{p.termo}</p>
                                      <p className="mt-1 text-[11px] text-slate-500">{p.justificativa}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {(analisePrecificacaoIA.perguntasFaltantes || []).length > 0 && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                <p className="text-xs font-semibold text-amber-800">Antes de confiar totalmente na comparação</p>
                                {analisePrecificacaoIA.perguntasFaltantes.map((p: string, i: number) => <p key={i} className="mt-1 text-[11px] text-amber-700">• {p}</p>)}
                              </div>
                            )}

                            <div className="grid grid-cols-3 gap-2 text-center">
                              {[
                                ["Compatíveis", (analisePrecificacaoIA.referencias || []).filter((r: any) => r.classificacao === "compativel").length, "text-green-700"],
                                ["Revisar", (analisePrecificacaoIA.referencias || []).filter((r: any) => r.classificacao === "revisar").length, "text-amber-700"],
                                ["Incompatíveis", (analisePrecificacaoIA.referencias || []).filter((r: any) => r.classificacao === "incompativel").length, "text-red-700"],
                              ].map(([label, valor, cor]: any) => (
                                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                  <p className={`text-lg font-bold ${cor}`}>{valor}</p>
                                  <p className="text-[11px] text-slate-500">{label}</p>
                                </div>
                              ))}
                            </div>

                            <div className="flex flex-wrap gap-2 justify-center">
                              <button
                                onClick={() => analisarObjetoAntesDoCalculo()}
                                disabled={analisandoPrecificacaoIA}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-lg cursor-pointer"
                              >
                                <RefreshCw size={13} className={analisandoPrecificacaoIA ? "animate-spin" : ""} /> Reanalisar
                              </button>
                              <button
                                onClick={() => calcularDireto()}
                                disabled={(analisePrecificacaoIA.referencias || []).filter((r: any) => r.classificacao === "compativel").length === 0}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-40 px-4 py-2 rounded-lg cursor-pointer"
                              >
                                <Calculator size={13} /> Calcular com referências compatíveis
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quadro comparativo — com classificação IN 126 */}
                    {precoEstimado && (
                      <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-green-100 text-green-900">
                            <th className="px-3 py-2 text-left font-semibold rounded-tl-lg">Nº</th>
                            <th className="px-3 py-2 text-left font-semibold">Órgão / Fonte</th>
                            <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                            <th className="px-3 py-2 text-right font-semibold">Valor unitário</th>
                            <th className="px-3 py-2 text-right font-semibold">Qtd</th>
                            <th className="px-3 py-2 text-left font-semibold rounded-tr-lg">Classificação (IN 126)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-100">
                          {fonte.map((r, i) => {
                            const v = (r.valor_unitario ?? r.valor_total) as number;
                            const q = r.quantidade ?? 1;
                            const classif = classificarPrecoIN126(v, fonte.map(a => (a.valor_unitario ?? a.valor_total) as number));
                            return (
                              <tr key={r.id || i} className={`bg-white hover:bg-green-50/50 ${classif.tipo !== "válido" ? "opacity-60" : ""}`}>
                                <td className="px-3 py-2 font-mono text-slate-500">{i + 1}</td>
                                <td className="px-3 py-2 text-slate-700">{r.orgao || "—"}</td>
                                <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate" title={r.descricao}>{r.descricao?.slice(0, 40) || "—"}</td>
                                <td className="px-3 py-2 text-right font-semibold text-slate-800 tabular-nums">{formatarMoeda(v)}</td>
                                <td className="px-3 py-2 text-right text-slate-500 tabular-nums">{q}</td>
                                <td className="px-3 py-2">
                                  {classif.tipo === "válido" ? (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-700"> válido</span>
                                  ) : (
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${classif.tipo === "inexequível" ? "bg-red-100 text-red-700" : classif.tipo === "sobrepreço" ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700"}`}>
                                       {classif.tipo} ({classif.pct}% da média)
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Preços desconsiderados (art. 11 §2º) */}
                    {(() => {
                      const vals = fonte.map(r => (r.valor_unitario ?? r.valor_total) as number);
                      const desconsiderados = fonte.filter(r => classificarPrecoIN126((r.valor_unitario ?? r.valor_total) as number, vals).tipo !== "válido");
                      if (desconsiderados.length > 0) {
                        return (
                          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800 leading-relaxed">
                            <p className="font-bold mb-1"> Preços desconsiderados (art. 11, §2º da IN 126/2023-TJRO)</p>
                            {desconsiderados.map((r, i) => {
                              const v = (r.valor_unitario ?? r.valor_total) as number;
                              const c = classificarPrecoIN126(v, vals);
                              return (
                                <p key={i} className="ml-2">• {formatarMoeda(v)} — {r.orgao || "—"}: <strong>{c.tipo === "inexequível" ? "preço inexequível (muito abaixo da média de mercado)" : "sobrepreço (expressivamente superior ao mercado)"}</strong> — art. 3º, {c.tipo === "inexequível" ? "IV" : "VII"}.</p>
                              );
                            })}
                            <p className="mt-1 text-red-700/80 italic">Justificativa automática gerada — validar com a autoridade competente antes de usar.</p>
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Menos de 3 preços válidos (art. 11 §1º) */}
                    {(() => {
                      const vals = fonte.map(r => (r.valor_unitario ?? r.valor_total) as number);
                      const validos = vals.filter(v => classificarPrecoIN126(v, vals).tipo === "válido");
                      if (validos.length > 0 && validos.length < 3) {
                        return (
                          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 leading-relaxed">
                             <strong>Atenção (art. 11, §1º da IN 126/2023-TJRO):</strong> o cálculo exige <strong>3 ou mais preços válidos</strong>. Atualmente há <strong>{validos.length}</strong>. O mapa de formação de preços pode conter menos de 3, <strong>desde que justificado e ratificado pela autoridade competente</strong>.
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Explicação da média conforme IN 126 */}
                    <div className="rounded-lg bg-white border border-green-100 p-3 text-xs text-slate-700 leading-relaxed">
                      <p className="font-bold text-green-700 mb-1.5"> Como cheguei ao preço de referência (art. 11 da IN 126/2023-TJRO)</p>
                      {(() => {
                        const vals = fonte.map(r => (r.valor_unitario ?? r.valor_total) as number);
                        const validos = vals.filter(v => classificarPrecoIN126(v, vals).tipo === "válido");
                        const desconsiderados = vals.filter(v => classificarPrecoIN126(v, vals).tipo !== "válido");
                        const base = validos.length >= 3 ? validos : vals;
                        const soma = base.reduce((a, b) => a + b, 0);
                        const mediaValor = soma / base.length;
                        const linhaValores = base.map(v => formatarMoeda(v)).join(" + ");
                        return (
                          <>
                            {desconsiderados.length > 0 && (
                              <p><strong>1.</strong> Desconsiderei os preços inexequíveis/sobrepreços ({desconsiderados.map(formatarMoeda).join(", ")}) — art. 11, §2º.</p>
                            )}
                            <p><strong>{desconsiderados.length > 0 ? "2" : "1"}.</strong> Somei os preços válidos: {linhaValores} = <strong>{formatarMoeda(soma)}</strong></p>
                            <p><strong>{desconsiderados.length > 0 ? "3" : "2"}.</strong> Dividi pelo nº de referências válidas ({base.length}): {formatarMoeda(soma)} ÷ {base.length} = <strong>{formatarMoeda(mediaValor)}</strong></p>
                            <p className="mt-1 text-slate-500">
                              Método aplicado: <strong>{(metodoEfetivo || config.metodo).replace(/_/g, " ")}</strong> · Mediana: {formatarMoeda(estatisticas?.mediana || mediaValor)} · CV: {estatisticas?.coeficienteVariacao.toFixed(1).replace(".", ",") || "—"}%
                            </p>
                          </>
                        );
                      })()}
                    </div>

                    {/* Sugestão de valor estimado */}
                    {precoEstimado && (
                      <div className="rounded-lg bg-green-600 text-white p-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-green-100"> Valor estimado sugerido da contratação (art. 11 IN 126)</p>
                          <p className="text-xl font-bold tabular-nums">{formatarMoeda(precoEstimado.total)}</p>
                          <p className="text-[11px] text-green-100">({precoEstimado.unitario ? formatarMoeda(precoEstimado.unitario) : ""} × {quantidade} {unidadeMedida}(s) · método {config.metodo.replace(/_/g, " ")})</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] text-green-100">Preços válidos</p>
                          <p className="text-lg font-bold tabular-nums">{fonte.filter(r => classificarPrecoIN126((r.valor_unitario ?? r.valor_total) as number, fonte.map(a => (a.valor_unitario ?? a.valor_total) as number)).tipo === "válido").length}</p>
                        </div>
                      </div>
                    )}
                      </>
                    )}

                    {/* AGENTE AUDITOR: explica as diferenças de preço */}
                    {precoEstimado && (
                      <div className="rounded-lg border border-ink-100 bg-ink-50/50 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-ink-800 text-white flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <BarChart3 size={13} />
                            <p className="text-xs font-bold">Agente Auditor — por que os preços diferem</p>
                          </div>
                          <button
                            onClick={explicarDiferencas}
                            disabled={auditoriaCarregando}
                            className="inline-flex items-center gap-1 text-[11px] font-bold bg-white text-ink-800 hover:bg-ink-50 px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            {auditoriaCarregando ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            {auditoriaCarregando ? "Analisando…" : auditoriaIA ? "Reanalisar" : "Explicar diferenças"}
                          </button>
                        </div>
                        {auditoriaIA ? (
                          <div className="p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{auditoriaIA}</div>
                        ) : (
                          <div className="p-3 text-[11px] text-slate-500">
                            Clique em <strong>Explicar diferenças</strong> para o agente analisar por que os preços variam (região, quantidade, época) — sempre com base nos dados reais das referências.
                          </div>
                        )}
                      </div>
                    )}

                    {/* JUSTIFICATIVA TÉCNICA — gerada automaticamente após o quadro (ordem correta) */}
                    {precoEstimado && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-[#032650] text-white flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <FileText size={13} />
                            <p className="text-xs font-bold">Justificativa técnica do preço estimado</p>
                          </div>
                          <button
                            onClick={() => gerarConteudoIA(estatisticas, usadosCalcularDireto.length || nAceitos)}
                            disabled={iaLoading}
                            className="inline-flex items-center gap-1 text-[11px] font-bold bg-white text-[#032650] hover:bg-slate-100 px-2.5 py-1 rounded-lg cursor-pointer disabled:opacity-50"
                          >
                            {iaLoading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                            {iaLoading ? "Gerando…" : justificativaIA ? "Regenerar" : "Gerar justificativa"}
                          </button>
                        </div>
                        {justificativaIA ? (
                          <div className="p-3 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{justificativaIA}</div>
                        ) : (
                          <div className="p-3 text-[11px] text-slate-500">
                            {iaLoading ? "Gerando justificativa com base no quadro comparativo…" : "A justificativa e gerada automaticamente apos o quadro e sai no relatorio final."}
                          </div>
                        )}
                      </div>
                    )}

                    {/* NOTAS EXPLICATIVAS — escondidas atrás de "ver notas" */}
                    {notasCalcularDireto && notasCalcularDireto.length > 0 && (
                      <Detalhes titulo={`Ver notas do cálculo (${notasCalcularDireto.length})`}>
                        <div className="space-y-1.5">
                          {notasCalcularDireto.map((n, i) => (
                            <p key={i} className="text-xs text-slate-600 leading-relaxed">{n}</p>
                          ))}
                        </div>
                      </Detalhes>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </StepCard>
      );

      // ── Etapa 14: Metodologia estatística + ME/EPP ──────────────────────────
      case 13: return (
        <StepCard
          title="Como o relatório explica o cálculo"
          desc="Escolha como a média foi calculada e o que entra no relatório final. A reserva para ME/EPP é sugerida automaticamente."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={14}/>}>Próximo</Btn></>}
        >
          {alertaCv && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 leading-relaxed">
              <strong> Alerta — dispersão acima do limite ({alertaCv.limite}%):</strong> o coeficiente de variação das
              referências aceitas é <strong>{alertaCv.cv.toFixed(1).replace(".", ",")}%</strong>. Conforme a regra de negócio,
              o sistema aplicou automaticamente o <strong>menor preço</strong> como referência de cálculo para evitar
              média distorcida. Você pode optar por outra metodologia abaixo, assumindo o risco da dispersão.
            </div>
          )}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">1. Tendência central aplicada no cálculo</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ["media_aritmetica", "Média aritmética", "Soma dos valores dividida pelo nº de referências"],
                ["mediana", "Mediana", "Valor central da amostra ordenada"],
                ["menor_preco", "Menor preço", "Menor valor encontrado (recomendado quando o CV estoura o limite)"],
                ["media_ponderada", "Média ponderada", "Média com peso pela quantidade de cada referência"],
              ] as [MetodoCalculo, string, string][]).map(([valor, rotulo, ajuda]) => (
                <label key={valor} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  config.metodo === valor ? "border-[#C9A227] bg-[#eef2f8]" : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <input
                    type="radio" name="metodo-relatorio" className="mt-0.5 accent-[#032650]"
                    checked={config.metodo === valor}
                    onChange={() => setConfig({ ...config, metodo: valor })}
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-700">{rotulo}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{ajuda}</span>
                  </span>
                </label>
              ))}
            </div>
            {alertaCv && config.metodo !== "menor_preco" && (
              <p className="mt-2 text-xs text-amber-600">
                 Com CV de {alertaCv.cv.toFixed(1).replace(".", ",")}% (acima de {alertaCv.limite}%), o menor preço é a recomendação padrão.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">2. Parâmetros que constarão no relatório</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                ["exibirMedia", "Média"],
                ["exibirDesvio", "Desvio padrão"],
                ["exibirMaximo", "Valor máximo"],
                ["exibirMinimo", "Valor mínimo"],
              ] as [keyof typeof parametrosRelatorio, string][]).map(([campo, rotulo]) => (
                <label key={campo} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors">
                  <input
                    type="checkbox" className="accent-[#032650]"
                    checked={parametrosRelatorio[campo]}
                    onChange={e => setParametrosRelatorio({ ...parametrosRelatorio, [campo]: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">{rotulo}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">3. Reserva ME/EPP (LC nº 123/2006)</p>
            {precoEstimado ? (
              <>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                  <input
                    type="checkbox" className="mt-0.5 accent-[#032650]"
                    checked={meEpp.aplicar}
                    onChange={e => setMeEpp({ ...meEpp, aplicar: e.target.checked })}
                  />
                  <div className="text-sm">
                    <p className="font-medium text-slate-700">Aplicar regra de ME/EPP à estimativa</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {calcularMeEpp().tipo === "exclusividade"
                        ? <>Valor total estimado de <strong>{formatarMoeda(precoEstimado.total)}</strong> (≤ R$ 80.000)  <strong>exclusividade ME/EPP</strong> na licitação (100% do item).</>
                        : <>Valor total estimado de <strong>{formatarMoeda(precoEstimado.total)}</strong> ({">"} R$ 80.000)  <strong>reserva de 25%</strong> do valor para ME/EPP em itens divisíveis.</>}
                    </p>
                    {meEpp.aplicar && (
                      <p className="text-xs text-[#032650] mt-2 font-medium">
                        Valor reservado: {formatarMoeda(calcularMeEpp().valorReservado)} · base legal: LC 123/2006, art. 48
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 mt-2 leading-relaxed">
                  Item indivisível e acima de R$ 80.000 fica fora da reserva — a regra não é aplicável. A decisão constará nas premissas do relatório.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-600">Calcule o preço estimado na etapa anterior para ver a sugestão automática de ME/EPP.</p>
            )}
          </div>
        </StepCard>
      );

      // ── Etapa 15: Decomposição de custos (diferencial competitivo) ──────────
      case 14: return (
        <StepCard
          title="Detalhamento de custos"
          desc="Quando for o caso, detalhe os custos do item (materiais, mão de obra, encargos e BDI) e compare a composição com o preço de mercado."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={14}/>}>Próximo</Btn></>}
        >
          {(formaParcelamento === "global" ? (itens[0] ? [{ id: "global", descricao: objetoDesc || "Objeto (global)" }] : []) : itens).length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-600">
              Cadastre itens na etapa 2 para decompor custos.
            </div>
          )}

          {(formaParcelamento === "global" ? (itens[0] ? [{ id: "global", descricao: objetoDesc || "Objeto (global)" }] : []) : itens).map((itemRef) => {
            const comps = decomposicaoCustos.filter(c => c.itemId === itemRef.id);
            return (
              <div key={itemRef.id} className="mb-5 rounded-lg border border-slate-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700 truncate">{itemRef.descricao || "Item"}</p>
                  <Btn onClick={() => addComposicao(itemRef.id)} icon={<span className="text-sm leading-none">+</span>}>Composição</Btn>
                </div>

                {comps.length === 0 && (
                  <div className="px-4 py-6 text-center text-xs text-slate-600">
                    Nenhuma composição de custo para este item. Clique em "Composição" para montar a decomposição (ex.: mão de obra dedicada + insumos + BDI).
                  </div>
                )}

                {comps.map((comp, compIdx) => {
                  const calc = calcularComposicao(comp);
                  const precoMercado = precoEstimado?.unitario || 0;
                  const dif = precoMercado > 0 ? ((calc.total - precoMercado) / precoMercado) * 100 : 0;
                  return (
                    <div key={comp.id} className="border-t border-slate-100 px-4 py-4">
                      <div className="flex items-center gap-3 mb-3">
                        <input
                          className="inp text-sm flex-1"
                          placeholder="Nome da composição (ex: Notebook com mão de obra dedicada)"
                          value={comp.nome}
                          onChange={e => updateComposicao(compIdx, "nome", e.target.value)}
                        />
                        <button type="button" onClick={() => removerComposicao(compIdx)} className="p-1.5 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors">
                          <X size={14} />
                        </button>
                      </div>

                      <table className="w-full text-xs border-collapse mb-3">
                        <thead>
                          <tr className="bg-slate-700 text-white">
                            <th className="px-2 py-2 text-left font-semibold w-[130px]">Tipo</th>
                            <th className="px-2 py-2 text-left font-semibold">Descrição</th>
                            <th className="px-2 py-2 text-left font-semibold w-[80px]">Un.</th>
                            <th className="px-2 py-2 text-left font-semibold w-[90px]">Qtd.</th>
                            <th className="px-2 py-2 text-left font-semibold w-[120px]">Custo unit. (R$)</th>
                            <th className="px-2 py-2 text-left font-semibold w-[90px]">% (encargos/BDI)</th>
                            <th className="px-2 py-2 text-center font-semibold w-[90px]">Subtotal</th>
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {comp.custos.map((custo, custoIdx) => {
                            const sub = custo.tipo === "encargo" || custo.tipo === "bdi"
                              ? (custo.percentual || 0) * (custo.tipo === "bdi" ? 0 : 0) // % é aplicado no total
                              : (custo.custoUnitario || 0) * (custo.quantidade || 1);
                            return (
                              <tr key={custo.id} className="border-b border-slate-100">
                                <td className="px-2 py-1.5">
                                  <select className="inp text-xs" value={custo.tipo} onChange={e => updateCusto(compIdx, custoIdx, "tipo", e.target.value)}>
                                    <option value="insumo">Insumo</option>
                                    <option value="mao_de_obra">Mão de obra dedicada</option>
                                    <option value="encargo">Encargo</option>
                                    <option value="bdi">BDI</option>
                                    <option value="outro">Outro</option>
                                  </select>
                                </td>
                                <td className="px-2 py-1.5">
                                  <input className="inp text-xs" placeholder={custo.tipo === "mao_de_obra" ? "Ex: Técnico em dedicação exclusiva" : "Ex: Material, frete, salário..."} value={custo.descricao} onChange={e => updateCusto(compIdx, custoIdx, "descricao", e.target.value)} />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input className="inp text-xs" value={custo.unidade || ""} onChange={e => updateCusto(compIdx, custoIdx, "unidade", e.target.value)} />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="number" className="inp text-xs" value={custo.quantidade ?? ""} onChange={e => updateCusto(compIdx, custoIdx, "quantidade", e.target.value === "" ? 0 : Number(e.target.value))} />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="number" step="0.01" className="inp text-xs" value={custo.custoUnitario ?? ""} onChange={e => updateCusto(compIdx, custoIdx, "custoUnitario", e.target.value === "" ? 0 : Number(e.target.value))} />
                                </td>
                                <td className="px-2 py-1.5">
                                  <input type="number" step="0.1" className="inp text-xs" placeholder="0,0" value={custo.percentual ?? ""} onChange={e => updateCusto(compIdx, custoIdx, "percentual", e.target.value === "" ? 0 : Number(e.target.value))} />
                                </td>
                                <td className="px-2 py-1.5 text-right font-mono tabular-nums text-slate-700">
                                  {(custo.tipo === "encargo" || custo.tipo === "bdi")
                                    ? <span className="text-slate-600">—</span>
                                    : formatarMoeda(sub)}
                                </td>
                                <td className="px-1 py-1.5 text-center">
                                  <button type="button" onClick={() => removeCusto(compIdx, custoIdx)} className="p-1 rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors">
                                    <X size={12} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <Btn onClick={() => addCusto(compIdx)} icon={<span className="text-sm leading-none">+</span>}>Adicionar custo</Btn>
                        <div className="text-xs font-mono text-slate-600 space-y-0.5 text-right">
                          <p>Insumos: {formatarMoeda(calc.insumos)} · Mão de obra: {formatarMoeda(calc.maoObra)} (encargos {calc.encargos}%)</p>
                          <p>BDI: {calc.bdi}% · <strong className="text-slate-800">Custo total: {formatarMoeda(calc.total)}</strong></p>
                          {precoMercado > 0 && (
                            <p className={dif <= 0 ? "text-green-600" : "text-amber-600"}>
                              vs. preço estimado de mercado {formatarMoeda(precoMercado)}  {dif >= 0 ? "+" : ""}{dif.toFixed(1).replace(".", ",")}%
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="p-3 rounded-lg bg-[#eef2f8] border border-[#d5dce8] text-xs text-[#042f5e] leading-relaxed">
            <strong>Diferencial:</strong> a decomposição de custos com mão de obra de dedicação exclusiva permite justificar o
            preço frente ao mercado e embasar a negociação — recurso que concorrentes como o Banco de Preços não oferecem.
            Tudo é incluído no relatório final.
          </div>
        </StepCard>
      );
      // ── Etapa 16 ────────────────────────────────────────────────────────────
      case 15: return (
        <StepCard
          title="Comprovações e documentos"
          desc="Registros e links das referências usadas na pesquisa."
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
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">Links das referências aceitas</p>
            {linksAceitos.length > 0 ? (
              <ul className="space-y-2">
                {linksAceitos.map((link, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <ExternalLink className="w-3.5 h-3.5 text-gold-700 shrink-0" />
                    {link.url
                      ? <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[#032650] hover:text-[#042f5e] font-medium truncate">{link.nome}</a>
                      : <span className="text-slate-500">{link.nome}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Nenhuma referência aceita com link disponível.</p>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Evidências registradas automaticamente</p>
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

      // ── Etapa 17 ────────────────────────────────────────────────────────────
      case 16: return (
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

          {/* Premissas estruturadas */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-6 text-sm">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Premissas e justificativas do processo (incluídas no relatório)</p>
            <ul className="text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                Fontes: {Array.from(new Set(resultados.filter(r => r.status_avaliacao === "aceito").map(r => r.fonte))).join(", ") || "—"}
              </li>
              <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                Quantitativos: {quantidade} {unidadeMedida || "un"} · {itens.length} {itens.length === 1 ? "item/lote" : "itens/lotes"}
              </li>
              <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                Local de entrega: {localEntrega || "não informado"}
              </li>
              <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                Coeficiente de variação: {estatisticas ? `${estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}% (limite ${config.cvLimite}%)` : "—"}
                {alertaCv && <span className="text-red-600 font-medium"> — regra aplicada: menor preço</span>}
              </li>
              <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                Métrica de tendência central: {(metodoEfetivo || config.metodo).replace(/_/g, " ")}
                {metodoEfetivo && metodoEfetivo !== config.metodo && (
                  <span className="text-slate-600"> (escolhido: {config.metodo.replace(/_/g, " ")})</span>
                )}
              </li>
              <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                Parâmetros no relatório: {[
                  parametrosRelatorio.exibirMedia && "média",
                  parametrosRelatorio.exibirDesvio && "desvio padrão",
                  parametrosRelatorio.exibirMaximo && "máximo",
                  parametrosRelatorio.exibirMinimo && "mínimo",
                ].filter(Boolean).join(", ") || "nenhum"}
              </li>
              <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                ME/EPP (LC 123/2006): {meEpp.aplicar
                  ? `${calcularMeEpp().tipo === "exclusividade" ? "exclusividade" : "reserva de 25%"} — ${formatarMoeda(calcularMeEpp().valorReservado)}`
                  : "não aplicado"}
              </li>
              <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                Decomposição de custos: {decomposicaoCustos.length} {decomposicaoCustos.length === 1 ? "composição" : "composições"} registrada(s)
              </li>
              {pesquisaMercado.length > 0 && (
                <li className="flex items-start gap-2"><Check size={12} className="text-green-500 shrink-0 mt-0.5" />
                  Pesquisa de mercado: {pesquisaMercado.length} cotação(ões) manual(is) com CNPJ e fonte registrados
                </li>
              )}
            </ul>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-6 text-sm">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Metadados incluídos no documento</p>
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
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => { const bytes = gerarXLSX(relatorioData); downloadXLSX(bytes, `estimativa_${processo.numero.replace("/", "_")}.xlsx`); }}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors w-full sm:w-auto"
            >
              Baixar XLSX
            </button>
            <PDFDownloadLink
              document={<RelatorioPDFDocument {...relatorioData} />}
              fileName={`estimativa_${processo.numero.replace("/", "_")}.pdf`}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#032650] text-white text-sm font-semibold hover:bg-[#042f5e] transition-colors w-full sm:w-auto"
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
  // Quebra o padding do layout pai (-mx -mt) e usa sticky para wizard + footers
  return (
    <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8">
      <h1 className="sr-only">Precificação</h1>

      {/* ── Wizard sticky no topo ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex items-stretch">
          {/* Fases: número sempre visível; no celular, só a fase atual mostra o nome */}
          <ol className="flex min-w-0 flex-1" aria-label="Fases da pesquisa">
            {FASES.map((fase, fi) => {
              const isAtual = fi === faseAtual;
              const isConcluida = fi < faseAtual;
              return (
                <li key={fi} className={`min-w-0 ${isAtual ? "flex-[2_1_0%] sm:flex-1" : "flex-1"}`}>
                  <button
                    type="button"
                    onClick={() => goToStep(fase.steps[0])}
                    aria-current={isAtual ? "step" : undefined}
                    title={fase.nome}
                    className={`flex h-full min-h-[52px] w-full items-center justify-center gap-2 px-2 text-[13px] font-semibold transition-colors sm:px-3 ${
                      isAtual
                        ? "text-ink-950"
                        : isConcluida
                        ? "text-ink-700 hover:bg-slate-50"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-medium ${
                        isAtual ? "bg-ink-900 text-white" : isConcluida ? "bg-ink-100 text-ink-800" : "border border-slate-300 text-slate-500"
                      }`}
                      aria-hidden
                    >
                      {isConcluida ? <Check size={13} /> : fi + 1}
                    </span>
                    <span className={`${isAtual ? "inline" : "sr-only sm:not-sr-only sm:inline"} truncate`}>{fase.nome}</span>
                    {isAtual && <span className="hidden font-mono text-xs font-normal text-slate-500 lg:inline">{step}/{totalSteps}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          {/* contadores à direita */}
          {(nAceitos > 0 || nRejeitados > 0) && (
            <div className="hidden shrink-0 items-center gap-2 border-l border-slate-100 px-4 sm:flex">
              {nAceitos > 0 && (
                <span className="pill pill-success" title="Referências aceitas">{nAceitos} aceitas</span>
              )}
              {nRejeitados > 0 && (
                <span className="pill pill-danger" title="Referências rejeitadas">{nRejeitados} rejeitadas</span>
              )}
            </div>
          )}
        </div>
        {/* Barra de progresso */}
        <div className="h-[3px] bg-slate-100" role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step} aria-label="Progresso da pesquisa">
          <div
            className="h-full bg-ink-800 transition-[width] duration-500"
            style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Guia conversacional do LEX ─────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-3xl px-4 pt-6 md:px-10">
        <div className="flex items-start gap-3.5 rounded-xl border border-ink-100 bg-white px-4 py-4 shadow-card sm:px-5">
          <span className="icon-tile h-9 w-9" aria-hidden>
            <Sparkles size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span className="font-semibold uppercase tracking-[0.12em] text-ink-700">LEX te guia</span>
              <span className="text-slate-500">Etapa {step} de {totalSteps} · {STEP_NAMES[step]}</span>
            </p>
            <p className="mt-1.5 text-[15px] font-semibold text-ink-950">{GUIA_STEP[step]?.pergunta}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{GUIA_STEP[step]?.orientacao}</p>
            {(objetoDesc || itens.length > 0 || localEntrega || resultados.length > 0 || nAceitos > 0 || precoEstimado) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {objetoDesc && <span className="pill pill-success">Objeto entendido</span>}
                {itens.length > 0 && <span className="pill pill-success">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>}
                {itensEfetivos.some(i => catalogoPorItem[i.id]?.selecionado) && <span className="pill pill-info">Catálogo conferido: {itensEfetivos.filter(i => catalogoPorItem[i.id]?.selecionado).length}/{itensEfetivos.length}</span>}
                {localEntrega && <span className="pill pill-neutral">Local: {localEntrega}</span>}
                {resultados.length > 0 && <span className="pill pill-info">{resultados.length} preços encontrados</span>}
                {nAceitos > 0 && <span className="pill pill-success">{nAceitos} aceitas</span>}
                {precoEstimado && <span className="pill pill-gold">Estimativa calculada</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Conteúdo ───────────────────────────────────────────────────────── */}
      {renderStep()}
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
        <div className="w-20 h-20 rounded-full bg-[#eef2f8] flex items-center justify-center">
          <Loader2 className="w-9 h-9 animate-spin text-[#032650]" />
        </div>
        <div className="absolute inset-0 rounded-full border-2 border-[#d5dce8] animate-ping opacity-30" />
      </div>

      {/* Mensagem rotativa */}
      <div className="text-center min-h-[48px] flex flex-col items-center justify-center gap-1">
        <p
          className="text-sm font-medium text-slate-700 transition-opacity duration-300"
          style={{ opacity: fade ? 1 : 0 }}
        >
          {MENSAGENS_BUSCA[idx]}
        </p>
        <p className="text-xs text-slate-600 font-mono">{regiao} · {periodo} · mín. {qtdMin} refs.</p>
      </div>

      {/* Barra de progresso */}
      <div className="w-72">
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#032650] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="text-center text-xs text-slate-600 mt-2">Pesquisa em andamento — não feche a página</p>
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
    <div className="flex min-h-[calc(100vh-140px)] flex-col">
      {/* Conteúdo centralizado */}
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-7 md:px-10">
        <div className="mb-5">
          <h2 className="text-[22px] font-semibold tracking-[-0.018em] text-ink-950">{title}</h2>
          {desc && <p className="mt-1.5 text-[15px] leading-relaxed text-slate-600">{desc}</p>}
        </div>
        <div className="card px-4 py-5 sm:px-7 sm:py-6">
          {children}
        </div>
      </div>
      {/* Rodapé SEMPRE visível — fixo na base da área de trabalho */}
      {footer && (
        <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-6px_16px_-12px_rgb(3_38_80/0.18)] md:px-10">
          <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-2.5 [&>button]:w-full sm:[&>button]:w-auto [&>div]:w-full sm:[&>div]:w-auto [&>div]:flex-wrap">
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, title }: { label: string; children: React.ReactNode; title?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-slate-700" title={title}>{label}</label>
      {children}
    </div>
  );
}

function Grid2({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>{children}</div>;
}

function Btn({
  children, onClick, primary, icon, disabled,
}: {
  children: React.ReactNode; onClick?: () => void; primary?: boolean; icon?: React.ReactNode; disabled?: boolean;
}) {
  const base = "btn whitespace-normal text-center motion-safe:active:scale-[0.98] sm:whitespace-nowrap";
  const style = primary ? "btn-primary" : "btn-outline";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style} disabled:opacity-40`}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

function StatBox({ label, value, badge }: { label: string; value: string; badge?: "ok" | "warn" | "err" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-center">
      <span className="block text-xl font-bold tabular-nums text-slate-800 tracking-tight">{value}</span>
      <span className="text-xs text-slate-600 mt-0.5 block">{label}</span>
      {badge && (
        <span className={`inline-block mt-2 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          badge === "ok" ? "bg-green-100 text-green-700" :
          badge === "warn" ? "bg-amber-100 text-amber-700" :
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
    indigo: "bg-[#eef2f8] border-[#d5dce8] text-[#042f5e]",
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

/**
 * Progressive disclosure: o essencial fica à vista, o técnico atrás de um clique.
 * Usa <details> nativo (acessível, funciona sem JS).
 */
function Detalhes({ titulo = "Ver detalhes técnicos", children }: { titulo?: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-slate-50/70">
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:text-[#032650] [&::-webkit-details-marker]:hidden">
        <ChevronRight size={15} className="shrink-0 transition-transform group-open:rotate-90" />
        {titulo}
      </summary>
      <div className="border-t border-slate-200 px-4 py-3">{children}</div>
    </details>
  );
}

/**
 * Classifica um preço conforme a IN 126/2023-TJRO:
 *  - art. 3º, IV: preço inexequível = muito abaixo da média praticada no mercado
 *  - art. 3º, VII: sobrepreço = expressivamente superior aos preços de referência
 *  - art. 11, §2º: preços inconsistentes/inexequíveis/sobrepreços devem ser desprezados
 *
 * Regra determinística (base de cálculo): inexequível < 50% da média;
 * sobrepreço > 150% da média. Limites conservadores — a validação final
 * é da autoridade competente.
 */
function classificarPrecoIN126(valor: number, todos: number[]): { tipo: "válido" | "inexequível" | "sobrepreço"; pct: number } {
  if (todos.length === 0) return { tipo: "válido", pct: 100 };
  const media = todos.reduce((a, b) => a + b, 0) / todos.length;
  if (media === 0) return { tipo: "válido", pct: 100 };
  const pct = (valor / media) * 100;
  if (pct < 50) return { tipo: "inexequível", pct: Math.round(pct) };
  if (pct > 150) return { tipo: "sobrepreço", pct: Math.round(pct) };
  return { tipo: "válido", pct: Math.round(pct) };
}
