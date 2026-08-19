"use client";

import React, { useState, useCallback } from "react";
import {
  Loader2, AlertCircle, Check, X, ExternalLink, MapPin,
  FileSearch, ChevronRight, Sparkles, BarChart3, FileText,
  ClipboardList, Settings, Search, CheckCircle2, TrendingUp, RefreshCw,
} from "lucide-react";
import { calcularEstatisticas, calcularPrecoEstimado, formatarMoeda } from "@/lib/math";
import { gerarXLSX, downloadXLSX } from "@/lib/xlsx-generator";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPDFDocument } from "@/lib/pdf-generator";
import { criarProcesso, criarPesquisa, salvarResultadosPesquisa, atualizarPesquisa } from "@/lib/actions";
import { calcularComRegraCv } from "@/lib/math";

type MetodoCalculo = "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
type PeriodoPesquisa = "6_meses" | "12_meses" | "24_meses";
type RegiaoPesquisa = "brasil" | "centro_oeste" | "sudeste" | "sul" | "nordeste" | "norte";
type StatusAvaliacao = "pendente" | "aceito" | "rejeitado";
type FormaParcelamento = "item" | "lote" | "global";

interface ItemPesquisa {
  id: string;
  descricao: string;
  especificacao: string;
  quantidade: number;
  unidadeMedida: string;
  itemEdital?: string;
  obrigatorio?: boolean;
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
  { nome: "Processo",   icon: Settings,      steps: [3, 4] },
  { nome: "Pesquisa",   icon: Search,        steps: [5, 6, 7, 8, 9] },
  { nome: "Análise",    icon: BarChart3,     steps: [10, 11, 12, 13] },
  { nome: "Relatório",  icon: FileText,      steps: [14, 15, 16, 17] },
];

const STEP_NAMES: Record<number, string> = {
  1: "Objeto e parcelamento", 2: "Itens da contratação", 3: "Informações do processo",
  4: "Quantidade e local", 5: "Pesquisa de mercado", 6: "Extração IA",
  7: "Revisão", 8: "Configurações", 9: "Pesquisa PNCP",
  10: "Resultados", 11: "Análise IA", 12: "Estatísticas",
  13: "Preço estimado", 14: "Metodologia e ME/EPP", 15: "Decomposição de custos",
  16: "Evidências", 17: "Relatório final",
};

export default function NovaPesquisaPage() {
  const [step, setStep] = useState(1);
  const totalSteps = 17;
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
  const [itemFiltro, setItemFiltro] = useState<string>("todos");

  const nextStep = useCallback(() => setStep(s => Math.min(s + 1, totalSteps)), []);
  const prevStep = useCallback(() => setStep(s => Math.max(s - 1, 1)), []);
  const goToStep = useCallback((s: number) => { if (s >= 1 && s <= totalSteps) setStep(s); }, []);

  // ── Itens (acordeão) ────────────────────────────────────────────────────────
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

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
    nextStep();
  };

  const pesquisarPNCP = async () => {
    setPesquisando(true); setResultados([]); setErroPesquisa(null);
    goToStep(9);

    // Remove "CÓDIGO: X", "APLICAÇÃO: X", códigos alfanuméricos (78C0W00) do texto
    function limparTermo(t: string): string {
      return t
        .replace(/\b(c[oó]digo|cod|ref|referencia|aplica[cç][aã]o|modelo|pn|sku)\s*[:\-\.]\s*\S+/gi, " ")
        .replace(/\b[A-Z]{1,3}[0-9]{2,}[A-Z0-9]*\b/g, " ")
        .replace(/,\s*/g, " ")
        .replace(/\s+/g, " ").trim();
    }

    // Monta termos de busca: usa o PRIMEIRO keyword da IA (mais específico) como
    // termo principal, e o objetoDesc limpo como secundário.
    const palavrasChave = caracteristicasIA
      .filter(c => c.caracteristica.startsWith("palavra_chave_"))
      .map(c => c.valor)
      .filter((v, i, arr) => arr.indexOf(v) === i); // deduplica
    // termoIA: primeiro keyword IA ou, se ausente, objetoDesc limpo
    const termoIA = palavrasChave[0] || limparTermo(objetoDesc);
    // termoSecundario: segundo keyword IA ou objetoDesc limpo (só chama se diferente)
    const objetoLimpo = limparTermo(objetoDesc);
    const termoSecundario = (palavrasChave[1] && palavrasChave[1] !== termoIA)
      ? palavrasChave[1]
      : objetoLimpo !== termoIA ? objetoLimpo : null;

    const uf = (localEntrega.split("/").pop() || "").trim().toUpperCase().slice(0, 2);

    // Busca SEGREGADA POR ITEM: cada item com descrição gera um alvo de busca.
    // No modo global, um único alvo (objeto + keywords da IA).
    const alvos: { itemId: string; rotulo: string; termo: string }[] = [];
    if (formaParcelamento === "global" || itens.length === 0) {
      alvos.push({ itemId: "global", rotulo: "Objeto", termo: termoIA });
    } else {
      const itensComDescricao = itens.filter(i => (i.descricao || "").trim().length > 0);
      const base = itensComDescricao.length > 0 ? itensComDescricao : itens;
      for (const item of base) {
        const espec = limparTermo(`${item.descricao} ${item.especificacao}`.trim());
        alvos.push({ itemId: item.id, rotulo: item.descricao.slice(0, 60), termo: espec || termoIA });
      }
    }

    // Busca em paralelo (até 6 alvos para não estourar a API)
    const buscas = alvos.slice(0, 6).map(alvo =>
      fetch(`/api/pncp?termo=${encodeURIComponent(alvo.termo)}&fontes=pncp,precos_abertos&tamanhoPagina=15${uf ? `&uf=${encodeURIComponent(uf)}` : ""}`, { signal: AbortSignal.timeout(120_000) })
        .then(async (resp) => ({ alvo, data: await resp.json().catch(() => null) }))
    );

    try {
      const respostas = await Promise.allSettled(buscas);
      const todasItems: { itemId: string; it: any }[] = [];
      const rotulos = new Map(alvos.map(a => [a.itemId, a.rotulo]));

      for (const resp of respostas) {
        if (resp.status !== "fulfilled" || !resp.value?.data?.items?.length) continue;
        for (const it of resp.value.data.items) {
          todasItems.push({ itemId: resp.value.alvo.itemId, it });
        }
      }

      // Deduplica por item + descrição + orgão e ordena por similaridade
      const vistos = new Set<string>();
      const unicos = todasItems.filter(({ itemId, it }) => {
        const chave = `${itemId}|${(it.descricao || "").slice(0, 60)}|${it.orgao}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave); return true;
      }).sort((a, b) => (b.it.similaridade ?? 0) - (a.it.similaridade ?? 0));

      if (unicos.length > 0) {
        const novos = unicos.map(({ itemId, it }, idx: number) => ({
          id: String(idx + 1),
          fonte: it.fonte || "precos_abertos",
          itemId,
          orgao: it.orgao || "Órgão público",
          descricao: it.descricao || "",
          quantidade: it.quantidade,
          data: it.dataContrato || "",
          valor_unitario: it.valorUnitario,
          valor_total: it.valorTotal,
          localizacao: it.localizacao || "",
          similaridade: it.similaridade ?? 0,
          documento_origem: it.documentoOrigem || "",
          link_origem: it.linkEdital || (it.descricao
            ? `https://pncp.gov.br/app/editais?q=${encodeURIComponent((it.descricao as string).slice(0, 60))}`
            : ""),
          fornecedor: it.dadosBrutos?.nomeFornecedor || "",
          status_avaliacao: "pendente" as const,
          dadosBrutos: it.dadosBrutos || {},
        }));
        // resultados de pesquisa de mercado manual entram como fonte "manual"
        const manuais: ResultadoPNCP[] = pesquisaMercado
          .filter(r => r.valor > 0)
          .map((r, idx) => ({
            id: `manual-${idx}`,
            fonte: "manual" as const,
            itemId: r.itemId,
            cnpj: r.cnpj,
            fonte_dados: r.fonte,
            orgao: r.fornecedor || "Fornecedor (cotação)",
            descricao: `Cotação manual — ${r.observacao || r.fonte || "pesquisa de mercado"}`,
            quantidade: null,
            data: r.data,
            valor_unitario: r.valor,
            valor_total: null,
            localizacao: "",
            similaridade: 100,
            documento_origem: r.cnpj || r.fornecedor,
            link_origem: "",
            fornecedor: r.fornecedor,
            status_avaliacao: "pendente" as const,
            dadosBrutos: { pesquisa_mercado: true, rotulo: rotulos.get(r.itemId) || "" },
          }));
        setResultados([...manuais, ...novos]);
        setPesquisando(false);
        goToStep(10);
        return;
      } else {
        setErroPesquisa(`Nenhuma referência encontrada para os termos pesquisados. Tente ampliar o período de pesquisa (ex.: 24 meses) ou edite os termos na etapa de revisão.`);
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
    const aceitosRaw = resultados.filter(r => r.status_avaliacao === "aceito" && r.valor_unitario != null);
    const aceitos = aceitosRaw.map(r => r.valor_unitario as number);
    if (aceitos.length === 0) { setEstatisticas(null); setAlertaCv(null); setPrecoEstimado(null); return; }
    const pesos = aceitosRaw.map(r => r.quantidade ?? 1);
    // Regra da reunião: CV > limite (20%) → alerta + menor preço automaticamente
    const { estatisticas: stats, alertaCv, cvExcedido, metodoEfetivo, preco } = calcularComRegraCv(
      aceitos, config.metodo, quantidade, config.cvLimite, pesos,
    );
    setEstatisticas(stats);
    setAlertaCv(alertaCv ? { cv: cvExcedido as number, limite: config.cvLimite, metodoEfetivo } : null);
    setMetodoEfetivo(metodoEfetivo);
    setPrecoEstimado(preco);
    gerarConteudoIA(stats, aceitos.length);
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
          footer={<><span /><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          <div className="space-y-5">
            <Field label="Descrição do objeto (visão geral) *">
              <textarea
                className="inp min-h-[110px] resize-y"
                placeholder="Ex: Aquisição de notebooks para uso nas atividades administrativas da Diretoria de Logística..."
                value={objetoDesc}
                onChange={e => setObjetoDesc(e.target.value)}
              />
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
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
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
                      {(item.quantidade > 0 || item.unidadeMedida) && (
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
                    <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                      <Field label="Descrição do item *">
                        <input
                          className="inp"
                          placeholder={formaParcelamento === "lote" ? "Ex: Lote 1 — Notebooks 14\"" : "Ex: Notebook 14\" — 16GB RAM, SSD 512GB"}
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

      // ── Etapa 4: Quantidade e local ─────────────────────────────────────────
      case 4: return (
        <StepCard
          title="Quantidade e local de entrega"
          desc="Confirme as quantidades totais e o local de entrega. Esses dados afetam o cálculo do preço total."
          footer={<><Btn onClick={prevStep}>Voltar</Btn><Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn></>}
        >
          {formaParcelamento !== "global" && itens.length > 0 && (
            <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Resumo dos itens</p>
              <ul className="space-y-1.5 text-slate-600">
                {itens.map((i, idx) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <ChevronRight size={13} className="text-slate-400 shrink-0" />
                    <span className="font-medium">{i.descricao || `Item ${idx + 1}`}</span>
                    {i.itemEdital && <span className="text-xs text-slate-400 font-mono">(edital: {i.itemEdital})</span>}
                    <span className="text-xs text-slate-500 ml-auto tabular-nums">
                      {i.quantidade} {i.unidadeMedida || "un"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={formaParcelamento === "global" ? "Quantidade total *" : "Quantidade (referência p/ cálculo)"}>
              <input type="number" className="inp" placeholder="Ex: 50" value={quantidade === 0 ? "" : quantidade} onChange={e => setQuantidade(e.target.value === "" ? 0 : Number(e.target.value))} />
            </Field>
            <Field label="Unidade de medida (referência)">
              <select className="inp" value={unidadeMedida} onChange={e => setUnidadeMedida(e.target.value)}>
                <option value="">Selecione...</option>
                {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
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

      // ── Etapa 5: Pesquisa de mercado (substitui busca de fornecedores) ──────
      case 5: return (
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
            <Field label="Objeto"><input className="inp inp-ro" value={objetoDesc} readOnly /></Field>
            <Field label="Parcelamento"><input className="inp inp-ro" value={formaParcelamento} readOnly /></Field>
          </Grid2>
          {caracteristicasIA.length > 0 && (
            <InfoBox color="indigo" className="mt-4">
              <strong>Características extraídas pela IA:</strong> {caracteristicasIA.map(c => c.valor).join(" · ")}
            </InfoBox>
          )}
          {itens.length > 0 && (
            <div className="mt-3 p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm">
              <strong className="text-slate-700">{formaParcelamento === "lote" ? "Lotes" : "Itens"} da contratação ({itens.length}):</strong>
              <ul className="mt-2 space-y-1 text-slate-600">
                {itens.map((e, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ChevronRight size={14} className="mt-0.5 text-slate-400 shrink-0" />
                    <span>
                      <strong>{e.descricao || `Item ${i + 1}`}:</strong> {e.especificacao}
                      {e.itemEdital && <span className="text-slate-400 font-mono text-xs"> (edital: {e.itemEdital})</span>}
                      <span className="text-slate-400"> · {e.quantidade} {e.unidadeMedida || "un"}</span>
                    </span>
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
      case 10: {
        const fmtData = (d: string) => {
          if (!d) return "—";
          try { return new Date(d).toLocaleDateString("pt-BR"); } catch { return d; }
        };
        const badgeSit = (sit: string) => {
          if (!sit) return null;
          const l = sit.toLowerCase();
          if (l.includes("divulgada") || l.includes("aberta") || l.includes("recebendo"))
            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 whitespace-nowrap">{sit}</span>;
          if (l.includes("anulada") || l.includes("cancelada") || l.includes("revogada"))
            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 whitespace-nowrap">{sit}</span>;
          if (l.includes("encerrada") || l.includes("homologada") || l.includes("adjudicada"))
            return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 whitespace-nowrap">{sit}</span>;
          return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">{sit}</span>;
        };
        const rotuloItem = (itemId?: string) => {
          if (!itemId || itemId === "global") return "Objeto (global)";
          const item = itens.find(i => i.id === itemId);
          return item ? (item.descricao || "Item") : "Item";
        };
        const numeroEdital = (itemId?: string) => {
          if (!itemId) return "";
          const item = itens.find(i => i.id === itemId);
          return item?.itemEdital || "";
        };
        const resultadosFiltrados = itemFiltro === "todos"
          ? resultados
          : resultados.filter(r => r.itemId === itemFiltro);
        const itensFiltro = Array.from(new Set(resultados.map(r => r.itemId).filter(Boolean))) as string[];
        return (
        <div className="flex flex-col h-full">
          {/* cabeçalho da etapa */}
          <div className="px-6 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-slate-800">Resultados da pesquisa</h2>
              <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                  <FileSearch size={11}/> {resultados.length} referências encontradas
                </span>
                <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 px-3 py-1 rounded-full font-semibold">
                  <Check size={11}/> {nAceitos} aceitas
                </span>
                {nRejeitados > 0 && (
                  <span className="inline-flex items-center gap-1.5 bg-red-100 text-red-600 px-3 py-1 rounded-full font-semibold">
                    <X size={11}/> {nRejeitados} rejeitadas
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                  Fonte: PNCP / Dados Abertos
                </span>
                <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1 rounded-full">
                  IN nº 65/2021 · Lei 14.133/2021
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-400">Clique em ✓ para aceitar ou ✗ para rejeitar cada referência antes de calcular.</p>
          </div>

          {/* filtro por item — pesquisa segregada */}
          {itensFiltro.length > 1 && (
            <div className="px-6 pt-3 pb-1 flex items-center gap-3 flex-wrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Resultados por item:</span>
              <select className="inp text-xs w-auto" value={itemFiltro} onChange={e => setItemFiltro(e.target.value)}>
                <option value="todos">Todos os itens</option>
                {itensFiltro.map(id => (
                  <option key={id} value={id}>{rotuloItem(id)}</option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400">
                Exibindo {resultadosFiltrados.length} de {resultados.length} referências
              </span>
            </div>
          )}

          {/* tabela */}
          <div className="flex-1 overflow-auto">
            {resultadosFiltrados.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <FileSearch size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum resultado. Volte e refaça a pesquisa.</p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse" style={{minWidth: 900}}>
                <thead>
                  <tr className="bg-slate-700 text-white">
                    <th className="px-3 py-2.5 text-center font-semibold w-8 border-r border-slate-600">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-[160px]">Órgão / Unidade</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600">Objeto da Contratação</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 whitespace-nowrap w-[120px]">Item / Edital</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 whitespace-nowrap w-[100px]">Modalidade</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-[90px]">Local</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 whitespace-nowrap w-[76px]">Publicação</th>
                    <th className="px-3 py-2.5 text-left font-semibold border-r border-slate-600 w-[90px]">Valor unit.</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-[50px]">Sim.</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-[70px]">Situação</th>
                    <th className="px-3 py-2.5 text-center font-semibold border-r border-slate-600 w-[70px]">Edital</th>
                    <th className="px-3 py-2.5 text-center font-semibold w-[80px]">Avaliação</th>
                  </tr>
                </thead>
                <tbody>
                  {resultadosFiltrados.map((r, idx) => {
                    const sit = (r as any).dadosBrutos?.situacao_nome as string | undefined;
                    const modal = (r as any).dadosBrutos?.modalidade_licitacao_nome as string | undefined;
                    const isAceito = r.status_avaliacao === "aceito";
                    const isRejeit = r.status_avaliacao === "rejeitado";
                    return (
                      <React.Fragment key={r.id}>
                        <tr className={`border-b border-slate-100 transition-colors ${
                          isAceito ? "bg-green-50 hover:bg-green-100" :
                          isRejeit ? "bg-red-50 opacity-60 hover:bg-red-100" :
                          idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/60 hover:bg-slate-100"
                        }`}>
                          <td className="px-3 py-2.5 text-center text-slate-400 font-bold border-r border-slate-100">{idx + 1}</td>
                          <td className="px-3 py-2.5 border-r border-slate-100">
                            <div className="font-semibold text-slate-700 leading-tight" style={{maxWidth:156}} title={r.orgao}>
                              {r.orgao.length > 40 ? r.orgao.slice(0, 40) + "…" : r.orgao}
                            </div>
                            {r.fonte && <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{r.fonte}</div>}
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-100">
                            <div className="text-slate-700 leading-snug" title={r.descricao} style={{maxWidth: 340}}>
                              {r.descricao.length > 120 ? r.descricao.slice(0, 120) + "…" : r.descricao}
                            </div>
                            {r.documento_origem && (
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5 truncate" style={{maxWidth:340}}>{r.documento_origem}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-100">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded px-1.5 py-0.5 inline-block w-fit max-w-[110px] truncate" title={rotuloItem(r.itemId)}>
                                {rotuloItem(r.itemId)}
                              </span>
                              {numeroEdital(r.itemId) ? (
                                <a
                                  href={`https://pncp.gov.br/app/editais?q=${encodeURIComponent(numeroEdital(r.itemId))}`}
                                  target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] font-mono text-slate-500 hover:text-indigo-600 underline underline-offset-2 inline-block w-fit"
                                  title="Conferir item no PNCP"
                                >
                                  Edital: {numeroEdital(r.itemId)} ↗
                                </a>
                              ) : r.fonte === "manual" ? (
                                <span className="text-[10px] font-mono text-amber-600">cotação manual</span>
                              ) : (
                                <span className="text-[10px] text-slate-300">—</span>
                              )}
                              {r.cnpj && (
                                <span className="text-[10px] font-mono text-slate-400" title="CNPJ do fornecedor">{r.cnpj}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-100 text-slate-500">
                            {modal ? <span title={modal}>{modal.length > 18 ? modal.slice(0,18)+"…" : modal}</span> : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-100 text-slate-500 whitespace-nowrap">{r.localizacao || "—"}</td>
                          <td className="px-3 py-2.5 border-r border-slate-100 text-slate-500 whitespace-nowrap">{fmtData(r.data)}</td>
                          <td className="px-3 py-2.5 border-r border-slate-100 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {r.valor_unitario != null && r.valor_unitario > 0
                              ? formatarMoeda(r.valor_unitario)
                              : r.valor_total != null && r.valor_total > 0
                                ? <span className="text-slate-500">{formatarMoeda(r.valor_total)} <span className="font-normal text-[10px]">(total)</span></span>
                                : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-100 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              r.similaridade >= 80 ? "bg-green-100 text-green-700" :
                              r.similaridade >= 60 ? "bg-amber-100 text-amber-700" :
                              "bg-slate-100 text-slate-400"
                            }`}>{r.similaridade}%</span>
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-100 text-center">
                            {sit ? badgeSit(sit) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 border-r border-slate-100 text-center">
                            {r.link_origem
                              ? <a href={r.link_origem} target="_blank" rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-700 hover:bg-indigo-600 text-white text-[11px] font-bold transition-colors whitespace-nowrap shadow-sm">
                                  <ExternalLink size={10}/> Abrir
                                </a>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button type="button" onClick={() => avaliarResultado(r.id, "aceito")} title="Aceitar"
                                className={`p-1.5 rounded transition-colors ${isAceito ? "bg-green-600 text-white" : "border border-green-400 text-green-600 hover:bg-green-50"}`}>
                                <Check size={12}/>
                              </button>
                              <button type="button" onClick={() => avaliarResultado(r.id, "rejeitado")} title="Rejeitar"
                                className={`p-1.5 rounded transition-colors ${isRejeit ? "bg-red-600 text-white" : "border border-red-400 text-red-600 hover:bg-red-50"}`}>
                                <X size={12}/>
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isRejeit && (
                          <tr className="bg-red-50 border-b border-slate-100">
                            <td colSpan={11} className="px-4 py-1.5">
                              <input className="w-full text-xs px-2 py-1 rounded border border-red-200 bg-white text-red-700 placeholder-red-300"
                                placeholder="Justificativa da rejeição (opcional)..."
                                value={r.justificativa_rejeicao || ""}
                                onChange={e => avaliarResultado(r.id, "rejeitado", e.target.value)} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* rodapé */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <Btn onClick={() => goToStep(8)}>← Refazer busca</Btn>
            <Btn primary onClick={() => { calcular(); setJustificativaIA(null); setValidacaoIA(null); nextStep(); }} icon={<BarChart3 size={14}/>}>
              Calcular e analisar ({nAceitos} aceitas)
            </Btn>
          </div>
        </div>
      );}

      // ── Etapa 11 ────────────────────────────────────────────────────────────
      case 11: return (
        <StepCard
          title="Análise da pesquisa (IA)"
          desc="O agente IA gera a justificativa técnica e valida a robustez estatística da amostra."
          footer={
            <div className="flex items-center gap-3 flex-wrap">
              <Btn onClick={() => goToStep(10)}>Voltar e revisar referências</Btn>
              {validacaoIA && !validacaoIA.valido && (
                <Btn onClick={() => { calcular(); gerarConteudoIA(estatisticas, resultados.filter(r => r.status_avaliacao === "aceito").length); }} icon={<RefreshCw size={14}/>}>
                  Recalcular após ajuste
                </Btn>
              )}
              <Btn primary onClick={nextStep} icon={<ChevronRight size={15}/>}>Próximo</Btn>
            </div>
          }
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
            <div className={`mt-4 rounded-lg border p-4 ${validacaoIA.valido ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
              <div className="flex items-center gap-2 mb-3">
                {validacaoIA.valido
                  ? <CheckCircle2 size={16} className="text-green-600" />
                  : <AlertCircle size={16} className="text-amber-600" />}
                <p className={`text-sm font-semibold ${validacaoIA.valido ? "text-green-800" : "text-amber-800"}`}>
                  {validacaoIA.valido
                    ? `Validação aprovada — score de confiança: ${validacaoIA.score_confianca}/100`
                    : `Atenção: score de confiança ${validacaoIA.score_confianca}/100 (abaixo de 70)`}
                </p>
              </div>
              {!validacaoIA.valido && (
                <p className="text-xs text-amber-700 mb-3 leading-relaxed">
                  O score baixo <strong>não impede</strong> a conclusão da pesquisa. Significa que a amostra tem
                  alta dispersão ou poucas referências aceitas. Para melhorar: volte à etapa de resultados e aceite
                  mais referências (✓), ou prossiga mesmo assim — a pesquisa continua válida.
                </p>
              )}
              {(validacaoIA.alertas || []).map((a: any, i: number) => (
                <div key={i} className={`mt-1.5 text-xs px-3 py-2 rounded-lg ${a.tipo === "erro" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  <span className="font-semibold">{a.campo}:</span> {a.mensagem}
                  {a.sugestao && <span className="block mt-0.5 opacity-80">→ {a.sugestao}</span>}
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
      case 14: return (
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
      case 15: return (
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
      case 16: return (
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
      case 17: return (
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

function Field({ label, children, title }: { label: string; children: React.ReactNode; title?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide" title={title}>{label}</label>
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
