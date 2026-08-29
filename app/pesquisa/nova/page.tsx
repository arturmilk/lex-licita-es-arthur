"use client";

import React, { useState, useCallback } from "react";
import {
  Loader2, AlertCircle, Check, X, ExternalLink, MapPin,
  FileSearch, ChevronRight, ChevronDown, Sparkles, BarChart3, FileText,
  ClipboardList, Settings, Search, CheckCircle2, TrendingUp, RefreshCw,
} from "lucide-react";
import { calcularEstatisticas, calcularPrecoEstimado, formatarMoeda, calcularComRegraCv } from "@/lib/math";
import { analisarReferencias, type ResultadoAnaliseCritica } from "@/lib/analise-critica";
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
  { nome: "Objeto",     icon: ClipboardList, steps: [1, 2] },
  { nome: "Processo",   icon: Settings,      steps: [3] },
  { nome: "Pesquisa",   icon: Search,        steps: [4, 5, 6, 7, 8] },
  { nome: "Análise",    icon: BarChart3,     steps: [9, 10, 11, 12] },
  { nome: "Relatório",  icon: FileText,      steps: [13, 14, 15, 16] },
];

const STEP_NAMES: Record<number, string> = {
  1: "Objeto e parcelamento", 2: "Itens da contratação", 3: "Informações do processo",
  4: "Pesquisa de mercado", 5: "Realizar pesquisa",
  6: "Revisão", 7: "Configurações", 8: "Pesquisa PNCP",
  9: "Resultados", 10: "Análise IA", 11: "Estatísticas",
  12: "Preço estimado", 13: "Metodologia e ME/EPP", 14: "Decomposição de custos",
  15: "Evidências", 16: "Relatório final",
};

export default function NovaPesquisaPage() {
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
  const [ordenacao, setOrdenacao] = useState<"relevancia" | "valor_asc" | "valor_desc" | "data_desc">("relevancia");

  // Período → dias (usado tanto na 1ª busca quanto na paginação)
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
  };
  const removeItem = (idx: number) => {
    const removido = itens[idx];
    setItens(itens.filter((_, i) => i !== idx));
    if (removido) setExpandido(e => { const n = { ...e }; delete n[removido.id]; return n; });
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
  };
  const removeSubItem = (loteIdx: number, subIdx: number) => {
    const novo = [...itens];
    novo[loteIdx] = { ...novo[loteIdx], subitens: (novo[loteIdx].subitens || []).filter((_, i) => i !== subIdx) };
    setItens(novo);
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

  const pesquisarPNCP = async () => {
    setPesquisando(true); setResultados([]); setErroPesquisa(null);
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

    // Um alvo por item (busca separada para cada item/lote)
    const alvos: { itemId: string; rotulo: string; termo: string }[] = [];
    if (formaParcelamento === "global" || itens.length === 0) {
      alvos.push({ itemId: "global", rotulo: objetoDesc.slice(0, 60) || "Objeto", termo: objetoLimpo || objetoDesc });
    } else {
      const base = itens.filter(i => (i.descricao || "").trim().length > 0);
      for (const item of (base.length ? base : itens)) {
        const termo = limparTermo(`${item.descricao} ${item.especificacao}`.trim()) || objetoLimpo || objetoDesc;
        alvos.push({ itemId: item.id, rotulo: item.descricao.slice(0, 60), termo });
      }
    }

    // Salva os termos para paginação posterior
    const novosTermos: Record<string, string> = {};
    for (const a of alvos) novosTermos[a.itemId] = a.termo;
    setTermoPorItem(novosTermos);

    // Busca multi-fonte — PNCP principal (rápido) + Compras.gov como reserva.
    // NOTA: precos_abertos leva ~30s (excluído); painel_precos exige auth (403).
    // Se o PNCP falhar, o fallback Firecrawl entra automaticamente (pncp-search.ts).
    const TAM = 50;
    const fontesMulti = "pncp,compras_gov";
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
        if (resp.status !== "fulfilled" || !resp.value?.data) continue;
        const { alvo, data } = resp.value;
        const items: any[] = data.items || [];
        const total: number = data.total ?? items.length;

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
            fonte: "pncp",
            itemId: alvo.itemId,
            orgao: it.orgao || "Órgão público",
            descricao: it.descricao || "",
            quantidade: null,
            data: it.dataContrato || "",
            valor_unitario: null,           // PNCP search não retorna preço unitário (Opção B preenche depois)
            valor_total: it.valorTotal ?? null, // valor_total_estimado do edital (Opção A)
            localizacao: it.localizacao || "",
            similaridade: it.similaridade ?? 0,
            documento_origem: it.documentoOrigem || "",
            link_origem: it.linkEdital || "",
            status_avaliacao: "pendente" as const,
            dadosBrutos: it.dadosBrutos || {},
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
      setJustificativaIA("⚠️ Nenhuma referência aceita com valor. Volte à tabela de resultados e clique em ✓ Aceitar em editais com preço.");
      return;
    }
    setIaLoading(true);
    setJustificativaIA(null);
    setValidacaoIA(null);
    try {
      const res = await fetch("/api/ia/justificativa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatisticas: stats, metodo: config.metodo, quantidade, referenciasAceitas: nAceitas }),
      });
      if (!res.ok) throw new Error(`Erro ${res.status}: ${await res.text()}`);
      const data = await res.json();
      if (data.justificativa) setJustificativaIA(data.justificativa);
    } catch (err: any) {
      console.error("Erro no agente justificador:", err);
      setJustificativaIA(`⚠️ Erro ao gerar justificativa: ${err?.message || "falha na rede"}. Tente novamente.`);
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
    // Regra da reunião: CV > limite (20%) → alerta + menor preço automaticamente
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

  const premissas = {
    processo: processo.numero,
    orgao: processo.orgao,
    unidade: processo.unidade,
    responsavel: processo.responsavel,
    email: processo.email,
    objeto: objetoDesc,
    formaParcelamento: formaParcelamento || "item",
    itens,
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
  const nAceitos = resultados.filter(r => r.status_avaliacao === "aceito").length;
  const nRejeitados = resultados.filter(r => r.status_avaliacao === "rejeitado").length;

  const renderStep = () => {
    switch (step) {
      // ── Etapa 1: Objeto e parcelamento (2ª tela antiga → 1ª posição) ────────
      case 1: return (
        <StepCard
          title="Objeto da contratação e parcelamento"
          desc="Primeiro, diga o que será contratado e como o fornecimento será dividido (por item, por lote ou preço global). Isso define os campos da próxima etapa."
          footer={<><span /><Btn primary onClick={() => {
            if (!objetoDesc.trim()) {
              setErroStep1("Preencha a descrição do objeto antes de avançar.");
              return;
            }
            setErroStep1(null);
            nextStep();
          }} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <div className="space-y-5">
            <Field label="Descrição do objeto (visão geral) *">
              <textarea
                className="inp min-h-[110px] resize-y"
                placeholder="Ex: Aquisição de notebooks para uso nas atividades administrativas da Diretoria de Logística..."
                value={objetoDesc}
                onChange={e => { setObjetoDesc(e.target.value); if (erroStep1) setErroStep1(null); }}
              />
              {erroStep1 && <p className="text-xs text-red-600 mt-1">{erroStep1}</p>}
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Forma de parcelamento *">
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
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                <strong>Atenção:</strong> No preço global, o valor total será calculado diretamente, sem divisão por unidade.
              </div>
            )}
            {formaParcelamento === "lote" && (
              <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-sm text-indigo-800">
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
                : "Cadastre os itens. Use o acordeão para expandir e detalhar cada item com especificação minuciosa, quantidade, unidade e nº do item no edital (PNCP)."
          }
          footer={<>
            <Btn onClick={prevStep}>Voltar</Btn>
            <Btn primary onClick={() => {
              const validos = itens.filter(i => i.descricao.trim() && i.quantidade > 0);
              if (validos.length === 0) {
                alert("Adicione pelo menos um item com descrição e quantidade maior que zero.");
                return;
              }
              nextStep();
            }} icon={<ChevronRight size={15}/>}>Próximo</Btn>
          </>}
        >
          <div className="space-y-3">
            {itens.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
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
                        <ChevronRight size={15} className="text-slate-400" />
                      </span>
                      <span className="font-medium text-slate-700 text-sm">
                        {formaParcelamento === "lote" ? `Lote ${idx + 1}` : `Item ${idx + 1}`}: {rotulo}
                      </span>
                      {formaParcelamento === "lote" ? (
                        <span className="text-xs text-indigo-500 font-medium bg-indigo-50 px-2 py-0.5 rounded-full">
                          {(item.subitens || []).length} {(item.subitens || []).length === 1 ? "item" : "itens"}
                        </span>
                      ) : (item.quantidade > 0 || item.unidadeMedida) && (
                        <span className="text-xs text-slate-400 font-normal">
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
                                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-5 text-center text-xs text-slate-400">
                                  Nenhum item adicionado a este lote ainda.
                                </div>
                              )}
                              {(item.subitens || []).map((sub, si) => (
                                <div key={sub.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
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
                                  </Field>
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
                              className="mt-2 inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold">
                              <span className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center text-[10px] font-bold leading-none">+</span>
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
                              placeholder='Ex: Notebook 14" — 16GB RAM, SSD 512GB'
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
                          </Field>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <Field label="Quantidade *">
                              <input
                                type="number" className="inp" min={0}
                                value={item.quantidade === 0 ? "" : item.quantidade}
                                onChange={e => updateItem(idx, "quantidade", e.target.value === "" ? 0 : Number(e.target.value))}
                              />
                            </Field>
                            <Field label="Unidade de medida">
                              <select className="inp" value={item.unidadeMedida} onChange={e => updateItem(idx, "unidadeMedida", e.target.value)}>
                                <option value="">Selecione...</option>
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
                                  className="accent-indigo-600"
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
            <button type="button" onClick={addItem} className="mt-3 inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
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

      // ── Etapa 4: Pesquisa de mercado ────────────────────────────────────────
      case 4: return (
        <StepCard
          title="Pesquisa de mercado"
          desc="Registre cotações manuais junto a fornecedores. CNPJ e fonte dos dados são OBRIGATÓRIOS — garantem a transparência documental da pesquisa."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <div className="mb-4">
            <Btn primary onClick={addRegistroMercado} icon={<FileSearch size={14}/>}>Adicionar cotação</Btn>
          </div>

          {pesquisaMercado.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
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
                          <span className="text-[10px] text-red-500 mt-0.5">CNPJ incompleto (14 dígitos)</span>
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
                        ⚠ CNPJ e fonte são obrigatórios para validade documental desta cotação.
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
          title="Realizar pesquisa"
          desc="O sistema busca simultaneamente no PNCP, Dados Abertos e Compras.gov e traz todos os resultados. Use os filtros na tabela para selecionar o que interessa."
          footer={
            <div className="flex items-center gap-3">
              <Btn onClick={prevStep}>← Voltar</Btn>
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
                  f.cor === "indigo" ? "border-indigo-200 bg-indigo-50/40" :
                  f.cor === "teal"   ? "border-teal-200 bg-teal-50/40" :
                  "border-orange-200 bg-orange-50/40"
                }`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    f.cor === "indigo" ? "bg-indigo-100 text-indigo-600" :
                    f.cor === "teal"   ? "bg-teal-100 text-teal-600" :
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
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Objeto que será pesquisado</p>
              <p className="text-sm text-slate-700 font-medium">{objetoDesc || <span className="text-slate-400 italic">Nenhum objeto informado</span>}</p>
              {itens.filter(i => i.descricao).length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
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
              <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wide mb-2">Características extraídas pela IA</p>
                <div className="flex flex-wrap gap-2">
                  {caracteristicasIA.map((c, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-white border border-indigo-200 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                      <span className="text-indigo-400 font-semibold">{c.caracteristica}:</span> {c.valor}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400 text-center">
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
                      <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700">{e.descricao || `Item ${i + 1}`}</p>
                        {e.especificacao && <p className="text-xs text-slate-500 mt-0.5 leading-snug">{e.especificacao}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
                          {(e.quantidade > 0 || e.unidadeMedida) && (
                            <span>{e.quantidade} {e.unidadeMedida || "un"}</span>
                          )}
                          {e.itemEdital && <span className="font-mono">edital: {e.itemEdital}</span>}
                          {formaParcelamento === "lote" && (e.subitens || []).length > 0 && (
                            <span className="text-indigo-500 font-medium">{(e.subitens || []).length} {(e.subitens || []).length === 1 ? "item" : "itens"}</span>
                          )}
                        </div>
                        {formaParcelamento === "lote" && (e.subitens || []).length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {(e.subitens || []).map((sub, si) => (
                              <li key={si} className="flex items-start gap-2 text-xs text-slate-600 pl-2 border-l-2 border-indigo-100">
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
          <p className="mt-3 text-xs text-slate-400 leading-relaxed">
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
          footer={<><Btn onClick={prevStep}>← Voltar</Btn><Btn primary onClick={pesquisarPNCP} icon={<Search size={14}/>}>Realizar pesquisa</Btn></>}
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
            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 whitespace-nowrap">✔ {sit}</span>;
          if (l.includes("anulada") || l.includes("cancelada") || l.includes("revogada"))
            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 whitespace-nowrap">✖ {sit}</span>;
          if (l.includes("encerrada") || l.includes("homologada") || l.includes("adjudicada"))
            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 whitespace-nowrap">{sit}</span>;
          return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">{sit}</span>;
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
        const ordenar = (res: ResultadoPNCP[]) => {
          const lista = [...res];
          const valorDe = (r: ResultadoPNCP) => r.valor_unitario ?? r.valor_total ?? Infinity;
          switch (ordenacao) {
            case "valor_asc": return lista.sort((a, b) => valorDe(a) - valorDe(b));
            case "valor_desc": return lista.sort((a, b) => valorDe(b) - valorDe(a));
            case "data_desc": return lista.sort((a, b) => new Date(b.data || 0).getTime() - new Date(a.data || 0).getTime());
            default: return lista.sort((a, b) => b.similaridade - a.similaridade);
          }
        };

        const totalGeral = Object.values(totalPorItem).reduce((a, b) => a + b, 0);

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
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {itemIds.indexOf(itemId) + 1}
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm">{rotuloItem(itemId)}</h3>
                  <span className="text-xs text-slate-400">
                    {totalItem.toLocaleString("pt-BR")} editais · pág. {pagAtual}/{totalPags}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button disabled={pagAtual <= 1}
                    onClick={() => buscarPaginaItem(itemId, pagAtual - 1)}
                    className="px-3 py-1 text-xs border border-slate-300 rounded-lg font-semibold disabled:opacity-30 hover:bg-slate-50 transition-colors">
                    ← Anterior
                  </button>
                  <button disabled={pagAtual >= totalPags}
                    onClick={() => buscarPaginaItem(itemId, pagAtual + 1)}
                    className="px-3 py-1 text-xs border border-slate-300 rounded-lg font-semibold disabled:opacity-30 hover:bg-slate-50 transition-colors">
                    Próxima →
                  </button>
                </div>
              </div>

              {filtrados.length === 0 ? (
                <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 py-8 text-center text-slate-400 text-sm">
                  Nenhum edital encontrado com o filtro selecionado.
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse" style={{minWidth: 960}}>
                      <thead>
                        <tr className="bg-slate-800 text-slate-200">
                          <th className="px-2 py-2.5 text-center w-8 border-r border-slate-700">
                            <input type="checkbox" className="rounded accent-indigo-500 cursor-pointer"
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
                              selecionados.has(r.id) ? "bg-indigo-50 border-indigo-100" :
                              isAceito ? "bg-green-50 border-green-100" :
                              isRejeit ? "bg-red-50/50 opacity-60 border-red-100" :
                              idx % 2 === 0 ? "bg-white border-slate-100 hover:bg-indigo-50/20" : "bg-slate-50/60 border-slate-100 hover:bg-indigo-50/20"
                            }`}>
                              <td className="px-2 py-2 text-center border-r border-slate-100">
                                <input type="checkbox" className="rounded accent-indigo-500 cursor-pointer"
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
                              <td className="px-3 py-2 text-center text-slate-400 font-bold border-r border-slate-100">{idx + 1}</td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <span className="font-mono text-[10px] text-slate-500 leading-tight break-all">{r.documento_origem || "—"}</span>
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <div className="font-semibold text-indigo-700 text-[11px] leading-tight" style={{maxWidth:176}} title={r.orgao}>
                                  {r.orgao.length > 45 ? r.orgao.slice(0, 45) + "…" : r.orgao}
                                </div>
                                {unidade && <div className="text-[10px] text-slate-400 mt-0.5" title={unidade}>{unidade.length > 40 ? unidade.slice(0,40)+"…" : unidade}</div>}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">
                                <span className="text-slate-700 leading-snug" title={r.descricao}>
                                  {r.descricao.length > 150 ? r.descricao.slice(0, 150) + "…" : r.descricao}
                                </span>
                                {r.similaridade > 0 && iaFiltroReady && (
                                  <span className={`ml-1.5 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${r.similaridade >= 70 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"}`}>
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
                                  : <span className="text-slate-300 text-[10px]">buscando…</span>}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100 text-right font-mono text-slate-600 whitespace-nowrap text-[11px]">
                                {r.valor_total != null && r.valor_total > 0 ? formatarMoeda(r.valor_total) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2 border-r border-slate-100">{sit ? badgeSit(sit) : <span className="text-slate-300">—</span>}</td>
                              <td className="px-3 py-2 text-center">
                                {r.link_origem
                                  ? <a href={r.link_origem} target="_blank" rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold transition-colors shadow-sm">
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
                        className="px-3 py-1 text-xs border rounded font-semibold disabled:opacity-30 hover:bg-white transition-colors">← Anterior</button>
                      <button disabled={pagAtual >= totalPags} onClick={() => buscarPaginaItem(itemId, pagAtual + 1)}
                        className="px-3 py-1 text-xs border rounded font-semibold disabled:opacity-30 hover:bg-white transition-colors">Próxima →</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        };

        return (
          <div className="flex flex-col">
            {/* Barra de filtros sticky */}
            <div className="sticky top-[54px] z-10 px-6 lg:px-8 pt-3 pb-3 bg-white border-b border-slate-200 shadow-sm">
              {/* Linha 1: busca inteligente */}
              <div className="flex items-center gap-2 mb-2.5">
                <div className="relative flex-1">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                  <input
                    type="text"
                    value={textoFiltro}
                    onChange={e => setTextoFiltro(e.target.value)}
                    placeholder="Buscar por descrição, órgão, nº PNCP, modalidade, localização…"
                    className="w-full pl-8 pr-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-colors bg-slate-50 placeholder:text-slate-400"
                  />
                  {textoFiltro && (
                    <button onClick={() => setTextoFiltro("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
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
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : iaAnalisando
                        ? "bg-white text-indigo-400 border-indigo-200 cursor-wait"
                        : "bg-white text-indigo-600 border-indigo-300 hover:border-indigo-500"
                  }`}>
                  {iaAnalisando
                    ? <><Loader2 size={10} className="animate-spin"/> Analisando…</>
                    : <><Sparkles size={10}/> Alta relevância (≥70%)</>}
                </button>
                {/* Filtro por região (melhoria) */}
                <select
                  value={regiaoFiltro}
                  onChange={e => setRegiaoFiltro(e.target.value)}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-600 focus:outline-none focus:border-indigo-400 cursor-pointer"
                  title="Filtrar por região (inferida da localização do edital)"
                >
                  <option value="todas">🌎 Todas as regiões</option>
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
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-slate-300 bg-white text-slate-600 focus:outline-none focus:border-indigo-400 cursor-pointer"
                  title="Ordenar resultados"
                >
                  <option value="relevancia">Relevância</option>
                  <option value="valor_asc">Menor valor ↑</option>
                  <option value="valor_desc">Maior valor ↓</option>
                  <option value="data_desc">Mais recentes</option>
                </select>
                {/* Separador + badges de contagem */}
                <span className="text-slate-300 text-xs">|</span>
                {totalGeral > 0 && (
                  <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-semibold">
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
              {erroPaginacao && (
                <div className="flex items-center justify-between gap-3 mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <span>{erroPaginacao}</span>
                  <button onClick={() => setErroPaginacao(null)} className="shrink-0 hover:opacity-70 transition-opacity"><X size={13}/></button>
                </div>
              )}
              {pesquisando ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                  <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
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
                  <p className="text-sm text-slate-400">Nenhum resultado. Clique em "Refazer pesquisa" ou volte para ajustar os termos.</p>
                </div>
              ) : (
                itemIds.map(itemId => <TabelaItem key={itemId} itemId={itemId} />)
              )}

              {/* Ações */}
              {resultados.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-3">
                  <Btn onClick={() => goToStep(8)}>← Configurações</Btn>
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
          title="Justificativa técnica (IA) — opcional"
          desc="Gere uma justificativa técnica automatizada com base nas referências aceitas e nas estatísticas calculadas. Esta etapa é opcional — você pode pular e prosseguir."
          footer={
            <div className="flex items-center gap-3 flex-wrap">
              <Btn onClick={() => goToStep(9)}>← Revisar referências</Btn>
              <Btn icon={iaLoading ? <Loader2 size={13} className="animate-spin"/> : <RefreshCw size={13}/>}
                disabled={iaLoading}
                onClick={() => {
                  setJustificativaIA(null);
                  setValidacaoIA(null);
                  const r = calcular();
                  const stats = r?.stats ?? estatisticas;
                  const nAce  = r?.nAceitas ?? resultados.filter(r => r.status_avaliacao === "aceito").length;
                  if (!stats) {
                    setJustificativaIA("⚠️ Nenhuma referência aceita com valor disponível. Na tabela de resultados (etapa anterior), clique em ✓ Aceitar em pelo menos 3 editais que tenham valor na coluna **Vlr. total edital (A)** ou **Vlr. unit. (B)**.");
                    return;
                  }
                  gerarConteudoIA(stats, nAce);
                }}>
                {iaLoading ? "Gerando…" : "Gerar justificativa"}
              </Btn>
              <Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo →</Btn>
            </div>
          }
        >
          {justificativaIA ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Justificativa gerada pela IA</p>
              {justificativaIA}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 rounded-xl bg-slate-50 border border-dashed border-slate-200">
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
                  {a.sugestao && <span className="block mt-0.5 opacity-80">→ {a.sugestao}</span>}
                </div>
              ))}
            </div>
          )}

          {analiseCritica && (
            <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/50 p-5">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={16} className="text-indigo-600" />
                <p className="text-sm font-semibold text-indigo-900">Análise crítica das referências</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  analiseCritica.forcaDispersao === "baixa" ? "bg-green-100 text-green-700"
                  : analiseCritica.forcaDispersao === "media" ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"}`}>
                  dispersão {analiseCritica.forcaDispersao}
                </span>
              </div>
              <p className="text-xs text-indigo-700/80 mb-3">{analiseCritica.resumo}</p>
              <div className="space-y-2">
                {analiseCritica.pontos.map((p, i) => (
                  <div key={i} className={`rounded-lg border px-3 py-2 text-xs ${
                    p.severidade === "alerta" ? "border-red-200 bg-red-50 text-red-800"
                    : p.severidade === "atencao" ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-white text-slate-700"}`}>
                    <p className="font-semibold">
                      {p.severidade === "alerta" ? "⚠️ " : p.severidade === "atencao" ? "• " : "ℹ️ "}{p.titulo}
                    </p>
                    <p className="mt-0.5 opacity-90">{p.detalhe}</p>
                  </div>
                ))}
              </div>
              {analiseCritica.sugestaoJustificativa && (
                <div className="mt-3 rounded-lg bg-white border border-indigo-200 p-3">
                  <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-1">Sugestão para a justificativa</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{analiseCritica.sugestaoJustificativa}</p>
                  <button
                    onClick={() => { navigator.clipboard.writeText(analiseCritica.sugestaoJustificativa); alert("Sugestão copiada para a área de transferência."); }}
                    className="mt-2 inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
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
          title="Análise estatística"
          desc="Estatísticas calculadas com base nas referências aceitas."
          footer={<><Btn onClick={() => goToStep(9)}>Voltar</Btn><Btn primary onClick={nextStep} icon={<TrendingUp size={14}/>}>Gerar preço estimado</Btn></>}
        >
          {estatisticas ? (
            <>
              {alertaCv && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 leading-relaxed">
                  <strong>⚠ Regra de variação aplicada (CV &gt; {alertaCv.limite}%):</strong> a dispersão das referências
                  ({alertaCv.cv.toFixed(1).replace(".", ",")}%) ultrapassou o limite. O cálculo usou automaticamente o
                  <strong> menor preço</strong> como referência, evitando média distorcida. Método efetivo: <strong>{alertaCv.metodoEfetivo.replace(/_/g, " ")}</strong>.
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <StatBox label="Referências" value={estatisticas.n.toString()} />
                <StatBox label="Média" value={formatarMoeda(estatisticas.media)} />
                <StatBox label="Mediana" value={formatarMoeda(estatisticas.mediana)} />
                <StatBox label="Mínimo" value={formatarMoeda(estatisticas.minimo)} />
                <StatBox label="Máximo" value={formatarMoeda(estatisticas.maximo)} />
                <StatBox label="Desvio padrão" value={estatisticas.desvioPadrao.toFixed(2).replace(".", ",")} />
                <StatBox label="CV" value={`${estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%`}
                  badge={estatisticas.coeficienteVariacao <= 15 ? "ok" : estatisticas.coeficienteVariacao <= config.cvLimite ? "warn" : "err"} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Memória de cálculo</p>
                <div className="font-mono text-xs text-slate-600 space-y-1">
                  <p>Referências aceitas: {estatisticas.n}</p>
                  <p>Valores: {resultados.filter(r => r.status_avaliacao === "aceito").map(r => formatarMoeda(r.valor_unitario ?? 0)).join(" | ")}</p>
                  <p>Média = {formatarMoeda(estatisticas.media)} · Mediana = {formatarMoeda(estatisticas.mediana)}</p>
                  <p>Mínimo = {formatarMoeda(estatisticas.minimo)} · Máximo = {formatarMoeda(estatisticas.maximo)}</p>
                  <p>Desvio padrão = {estatisticas.desvioPadrao.toFixed(2).replace(".", ",")} · CV = {estatisticas.coeficienteVariacao.toFixed(1).replace(".", ",")}%</p>
                  <p>Limite de CV: {config.cvLimite}% · Método efetivo: {(metodoEfetivo || config.metodo).replace(/_/g, " ")}</p>
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
      case 12: return (
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
                  <p className="text-base font-semibold text-slate-700">{(metodoEfetivo || config.metodo).replace(/_/g, " ")}</p>
                  {alertaCv && <p className="text-[10px] text-red-500 mt-1 font-medium">CV acima do limite → menor preço</p>}
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

      // ── Etapa 14: Metodologia estatística + ME/EPP ──────────────────────────
      case 13: return (
        <StepCard
          title="Metodologia do relatório e ME/EPP"
          desc="Escolha a tendência central do cálculo e os parâmetros que constarão no relatório final. A regra de ME/EPP (LC 123/2006) é calculada automaticamente."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={14}/>}>Próximo</Btn></>}
        >
          {alertaCv && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 leading-relaxed">
              <strong>⚠ Alerta — dispersão acima do limite ({alertaCv.limite}%):</strong> o coeficiente de variação das
              referências aceitas é <strong>{alertaCv.cv.toFixed(1).replace(".", ",")}%</strong>. Conforme a regra de negócio,
              o sistema aplicou automaticamente o <strong>menor preço</strong> como referência de cálculo para evitar
              média distorcida. Você pode optar por outra metodologia abaixo, assumindo o risco da dispersão.
            </div>
          )}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">1. Tendência central aplicada no cálculo</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {([
                ["media_aritmetica", "Média aritmética", "Soma dos valores dividida pelo nº de referências"],
                ["mediana", "Mediana", "Valor central da amostra ordenada"],
                ["menor_preco", "Menor preço", "Menor valor encontrado (recomendado quando o CV estoura o limite)"],
                ["media_ponderada", "Média ponderada", "Média com peso pela quantidade de cada referência"],
              ] as [MetodoCalculo, string, string][]).map(([valor, rotulo, ajuda]) => (
                <label key={valor} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  config.metodo === valor ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                  <input
                    type="radio" name="metodo-relatorio" className="mt-0.5 accent-indigo-600"
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
                ⚠ Com CV de {alertaCv.cv.toFixed(1).replace(".", ",")}% (acima de {alertaCv.limite}%), o menor preço é a recomendação padrão.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 mb-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">2. Parâmetros que constarão no relatório</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                ["exibirMedia", "Média"],
                ["exibirDesvio", "Desvio padrão"],
                ["exibirMaximo", "Valor máximo"],
                ["exibirMinimo", "Valor mínimo"],
              ] as [keyof typeof parametrosRelatorio, string][]).map(([campo, rotulo]) => (
                <label key={campo} className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300 transition-colors">
                  <input
                    type="checkbox" className="accent-indigo-600"
                    checked={parametrosRelatorio[campo]}
                    onChange={e => setParametrosRelatorio({ ...parametrosRelatorio, [campo]: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">{rotulo}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">3. Reserva ME/EPP (LC nº 123/2006)</p>
            {precoEstimado ? (
              <>
                <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white">
                  <input
                    type="checkbox" className="mt-0.5 accent-indigo-600"
                    checked={meEpp.aplicar}
                    onChange={e => setMeEpp({ ...meEpp, aplicar: e.target.checked })}
                  />
                  <div className="text-sm">
                    <p className="font-medium text-slate-700">Aplicar regra de ME/EPP à estimativa</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {calcularMeEpp().tipo === "exclusividade"
                        ? <>Valor total estimado de <strong>{formatarMoeda(precoEstimado.total)}</strong> (≤ R$ 80.000) → <strong>exclusividade ME/EPP</strong> na licitação (100% do item).</>
                        : <>Valor total estimado de <strong>{formatarMoeda(precoEstimado.total)}</strong> ({">"} R$ 80.000) → <strong>reserva de 25%</strong> do valor para ME/EPP em itens divisíveis.</>}
                    </p>
                    {meEpp.aplicar && (
                      <p className="text-xs text-indigo-600 mt-2 font-medium">
                        Valor reservado: {formatarMoeda(calcularMeEpp().valorReservado)} · base legal: LC 123/2006, art. 48
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                  Item indivisível e acima de R$ 80.000 fica fora da reserva — a regra não é aplicável. A decisão constará nas premissas do relatório.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-400">Calcule o preço estimado na etapa anterior para ver a sugestão automática de ME/EPP.</p>
            )}
          </div>
        </StepCard>
      );

      // ── Etapa 15: Decomposição de custos (diferencial competitivo) ──────────
      case 14: return (
        <StepCard
          title="Decomposição de custos"
          desc="Módulo exclusivo: monte a composição de custos por item (insumos, mão de obra de dedicação exclusiva, encargos e BDI) e compare com o preço estimado de mercado."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={14}/>}>Próximo</Btn></>}
        >
          {(formaParcelamento === "global" ? (itens[0] ? [{ id: "global", descricao: objetoDesc || "Objeto (global)" }] : []) : itens).length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-sm text-slate-400">
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
                  <div className="px-4 py-6 text-center text-xs text-slate-400">
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
                                    ? <span className="text-slate-400">—</span>
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
                              vs. preço estimado de mercado {formatarMoeda(precoMercado)} → {dif >= 0 ? "+" : ""}{dif.toFixed(1).replace(".", ",")}%
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

          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-xs text-indigo-800 leading-relaxed">
            <strong>Diferencial:</strong> a decomposição de custos com mão de obra de dedicação exclusiva permite justificar o
            preço frente ao mercado e embasar a negociação — recurso que concorrentes como o Banco de Preços não oferecem.
            Tudo é incluído no relatório final.
          </div>
        </StepCard>
      );
      // ── Etapa 16 ────────────────────────────────────────────────────────────
      case 15: return (
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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Premissas e justificativas do processo (incluídas no relatório)</p>
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
                  <span className="text-slate-400"> (escolhido: {config.metodo.replace(/_/g, " ")})</span>
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
  // Quebra o padding do layout pai (-mx -mt) e usa sticky para wizard + footers
  return (
    <div className="-mx-4 md:-mx-8 -mt-4 md:-mt-8">

      {/* ── Wizard sticky no topo ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        {/* Fases */}
        <div className="flex items-stretch border-b border-slate-100">
          {FASES.map((fase, fi) => {
            const isAtual = fi === faseAtual;
            const isConcluida = fi < faseAtual;
            const Icon = fase.icon;
            return (
              <button
                key={fi}
                type="button"
                onClick={() => goToStep(fase.steps[0])}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3 text-xs font-semibold transition-colors border-r border-slate-100 last:border-r-0 ${
                  isAtual
                    ? "bg-indigo-600 text-white"
                    : isConcluida
                    ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                    : "text-slate-400 hover:bg-slate-50"
                }`}
              >
                <Icon size={13} />
                <span>{fase.nome}</span>
                {isConcluida && <Check size={10} />}
                {isAtual && <span className="text-[10px] opacity-75 font-normal">({step}/{totalSteps})</span>}
              </button>
            );
          })}
          {/* contadores à direita */}
          <div className="flex items-center gap-2 px-4 border-l border-slate-100 shrink-0">
            {nAceitos > 0 && (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <Check size={9}/>{nAceitos}
              </span>
            )}
            {nRejeitados > 0 && (
              <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                <X size={9}/>{nRejeitados}
              </span>
            )}
          </div>
        </div>
        {/* Barra de progresso */}
        <div className="h-[3px] bg-slate-100">
          <div
            className="h-full bg-indigo-500 transition-all duration-500"
            style={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
          />
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
    <div className="flex flex-col min-h-[calc(100vh-140px)]">
      {/* Conteúdo centralizado */}
      <div className="flex-1 px-6 md:px-10 py-7 max-w-3xl w-full mx-auto">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-800">{title}</h2>
          {desc && <p className="text-sm text-slate-500 mt-1 leading-relaxed">{desc}</p>}
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-7 py-6">
          {children}
        </div>
      </div>
      {/* Footer SEMPRE visível — sticky na base da viewport */}
      {footer && (
        <div className="sticky bottom-0 z-10 bg-white border-t border-slate-200 px-6 md:px-10 py-3.5 flex items-center justify-between gap-3 shadow-[0_-2px_12px_rgba(0,0,0,0.07)]">
          {footer}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, title }: { label: string; children: React.ReactNode; title?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-bold text-slate-600 tracking-wide" title={title}>{label}</label>
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
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border shadow-sm active:scale-[0.98]";
  const style = primary
    ? "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-700 shadow-indigo-200"
    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300";
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`${base} ${style} disabled:opacity-40 disabled:cursor-not-allowed`}>
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
}

function StatBox({ label, value, badge }: { label: string; value: string; badge?: "ok" | "warn" | "err" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 text-center">
      <span className="block text-xl font-bold tabular-nums text-slate-800 tracking-tight">{value}</span>
      <span className="text-xs text-slate-400 mt-0.5 block">{label}</span>
      {badge && (
        <span className={`inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
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
