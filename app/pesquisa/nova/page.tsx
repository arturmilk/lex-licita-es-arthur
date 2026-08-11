"use client";

import React, { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Check, X, ExternalLink, MapPin, FileSearch, ChevronRight } from "lucide-react";
import { calcularEstatisticas, calcularPrecoEstimado, formatarMoeda } from "@/lib/math";
import { gerarXLSX, downloadXLSX } from "@/lib/xlsx-generator";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { RelatorioPDFDocument } from "@/lib/pdf-generator";
import AgentStatusPanel from "@/components/AgentStatusPanel";

type MetodoCalculo = "media_aritmetica" | "mediana" | "media_ponderada" | "menor_preco";
type PeriodoPesquisa = "6_meses" | "12_meses" | "24_meses";
type RegiaoPesquisa = "brasil" | "centro_oeste" | "sudeste" | "sul" | "nordeste" | "norte";
type StatusAvaliacao = "pendente" | "aceito" | "rejeitado";
type FormaParcelamento = "item" | "lote" | "global";

interface ResultadoDB {
  id: string;
  orgao: string;
  descricao: string;
  quantidade: number | null;
  dataContrato: string | null;
  valorUnitario: number | null;
  valorTotal: number | null;
  localizacao: string | null;
  similaridade: number;
  documentoOrigem: string | null;
  linkEdital: string | null;
  avaliacao: StatusAvaliacao;
  justificativaRejeicao: string | null;
  fonte: string;
}

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
  const router = useRouter();
  const [step, setStep] = useState(1);
  const totalSteps = 14;

  // Dados do processo e pesquisa
  const [processo, setProcesso] = useState({ numero: "", orgao: "", unidade: "", responsavel: "", email: "" });
  const [objetoDesc, setObjetoDesc] = useState("");
  const [especificacao, setEspecificacao] = useState<{ item: string; especificacao: string; obrigatorio: boolean }[]>([
    { item: "", especificacao: "", obrigatorio: true },
  ]);
  const [quantidade, setQuantidade] = useState(1);
  const [unidadeMedida, setUnidadeMedida] = useState("unidade");
  const [formaParcelamento, setFormaParcelamento] = useState<FormaParcelamento>("item");
  const [localEntrega, setLocalEntrega] = useState("");

  // IDs no banco
  const [processoId, setProcessoId] = useState<string | null>(null);
  const [pesquisaId, setPesquisaId] = useState<string | null>(null);

  // Config de busca
  const [config, setConfig] = useState({
    periodo: "12_meses" as PeriodoPesquisa,
    regiao: "brasil" as RegiaoPesquisa,
    qtdMin: 3,
    metodo: "media_aritmetica" as MetodoCalculo,
  });

  // Resultados
  const [resultados, setResultados] = useState<ResultadoDB[]>([]);
  const [carregandoResultados, setCarregandoResultados] = useState(false);
  const [avaliandoId, setAvaliandoId] = useState<string | null>(null);
  const [totalResultadosBusca, setTotalResultadosBusca] = useState(0);

  // Cálculos
  const [estatisticas, setEstatisticas] = useState<ReturnType<typeof calcularEstatisticas> | null>(null);
  const [precoEstimado, setPrecoEstimado] = useState<{ unitario: number; total: number } | null>(null);

  // Estados de loading e erro
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaIniciada, setBuscaIniciada] = useState(false);

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

  // Confirmar e criar no banco (step 7 → 8)
  const confirmarECriar = async () => {
    setLoading(true);
    setErro(null);
    try {
      // Criar processo
      const resProcesso = await fetch("/api/processos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numero: processo.numero,
          objeto: objetoDesc,
          unidade: processo.unidade,
        }),
      });
      if (!resProcesso.ok) {
        const err = await resProcesso.json();
        throw new Error(err.error || "Erro ao criar processo");
      }
      const processoData = await resProcesso.json();
      setProcessoId(processoData.id);

      // Criar pesquisa
      const resPesquisa = await fetch("/api/pesquisas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          processoId: processoData.id,
          objeto: objetoDesc,
          especificacoes: especificacao,
          quantidade,
          unidadeMedida,
          localEntrega,
          formaParcelamento,
          periodoPesquisa: config.periodo,
          regiaoPesquisa: config.regiao,
          metodoCalculo: config.metodo,
          qtdMinReferencias: config.qtdMin,
        }),
      });
      if (!resPesquisa.ok) {
        const err = await resPesquisa.json();
        throw new Error(err.error || "Erro ao criar pesquisa");
      }
      const pesquisaData = await resPesquisa.json();
      setPesquisaId(pesquisaData.id);

      nextStep();
    } catch (e: any) {
      setErro(e.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  // Iniciar busca multi-agente (step 8 → 9)
  const iniciarBusca = async () => {
    if (!pesquisaId) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await fetch(`/api/pesquisas/${pesquisaId}/iniciar-busca`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termoBusca: objetoDesc }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erro ao iniciar busca");
      }
      setBuscaIniciada(true);
      nextStep(); // vai para step 9 (agentes em tempo real)
    } catch (e: any) {
      setErro(e.message || "Erro inesperado");
    } finally {
      setLoading(false);
    }
  };

  // Chamado pelo AgentStatusPanel quando todos os agentes concluem
  const onBuscaConcluida = useCallback(async (total: number) => {
    setTotalResultadosBusca(total);
    // Carregar resultados do banco
    if (!pesquisaId) return;
    setCarregandoResultados(true);
    try {
      const res = await fetch(`/api/pesquisas/${pesquisaId}/resultados`);
      if (res.ok) {
        const data = await res.json();
        setResultados(data);
      }
    } finally {
      setCarregandoResultados(false);
      nextStep(); // avança para step 10 (resultados)
    }
  }, [pesquisaId]);

  // Avaliar resultado no banco
  const avaliarResultado = async (id: string, avaliacao: StatusAvaliacao, justificativa?: string) => {
    if (!pesquisaId) return;
    setAvaliandoId(id);
    // Otimista
    setResultados(prev => prev.map(r => r.id === id ? { ...r, avaliacao, justificativaRejeicao: justificativa || null } : r));
    try {
      await fetch(`/api/pesquisas/${pesquisaId}/resultados/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avaliacao, justificativaRejeicao: justificativa }),
      });
    } catch {
      // se falhar, reverte UI
      setResultados(prev => prev.map(r => r.id === id ? { ...r, avaliacao: "pendente", justificativaRejeicao: null } : r));
    } finally {
      setAvaliandoId(null);
    }
  };

  const calcular = () => {
    const aceitos = resultados
      .filter(r => r.avaliacao === "aceito" && r.valorUnitario != null)
      .map(r => r.valorUnitario as number);
    if (aceitos.length === 0) { setEstatisticas(null); return; }
    const stats = calcularEstatisticas(aceitos);
    setEstatisticas(stats);
    const preco = calcularPrecoEstimado(aceitos, config.metodo, quantidade);
    setPrecoEstimado(preco);
  };

  // Salvar evidências dos links aceitos no banco antes de gerar relatório
  const salvarEvidencias = async () => {
    if (!pesquisaId) return;
    const linksAceitos = resultados.filter(r => r.avaliacao === "aceito" && r.linkEdital);
    for (const r of linksAceitos) {
      try {
        await fetch("/api/evidencias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pesquisaId,
            nome: r.documentoOrigem || r.descricao,
            tipo: "link",
            url: r.linkEdital,
            origem: r.fonte,
          }),
        });
      } catch { /* ignora erros individuais */ }
    }
  };

  // Atualizar status da pesquisa para concluida
  const concluirPesquisa = async () => {
    if (!pesquisaId || !precoEstimado) return;
    try {
      await fetch(`/api/pesquisas/${pesquisaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "concluida",
          precoUnitarioEstimado: precoEstimado.unitario,
          precoTotalEstimado: precoEstimado.total,
          metodoCalculo: config.metodo,
        }),
      });
    } catch { /* ignora */ }
  };

  const linksAceitos = resultados
    .filter(r => r.avaliacao === "aceito" && r.linkEdital)
    .map(r => ({ nome: r.documentoOrigem || r.descricao, url: r.linkEdital!, tipo: "link" as const }));

  const relatorioData = {
    processo,
    objeto: objetoDesc,
    quantidade,
    metodo: config.metodo,
    estatisticas: estatisticas || { n: 0, media: 0, mediana: 0, minimo: 0, maximo: 0, desvioPadrao: 0, coeficienteVariacao: 0 },
    precoUnitario: precoEstimado?.unitario || 0,
    precoTotal: precoEstimado?.total || 0,
    justificativa: precoEstimado
      ? `O preço foi formado com base em ${estatisticas?.n} registros, utilizando o método da ${config.metodo.replace(/_/g, " ")}.`
      : "",
    referencias: resultados
      .filter(r => r.avaliacao === "aceito")
      .map(r => ({
        id: r.id, orgao: r.orgao, descricao: r.descricao,
        quantidade: r.quantidade || 0, data: r.dataContrato || "",
        valor_unitario: r.valorUnitario || 0, valor_total: r.valorTotal || 0,
        localizacao: r.localizacao || "", similaridade: r.similaridade,
        documento_origem: r.documentoOrigem || "", link_origem: r.linkEdital || "",
        status_avaliacao: "aceito" as const,
      })),
    responsavel: processo.responsavel,
    email: processo.email,
    linksEvidencias: linksAceitos,
  };

  const stepLabels = [
    "processo", "objeto", "especificacao", "quantidade",
    "local", "revisar", "configurar", "busca",
    "resultados", "calculos", "preco", "evidencias", "relatorio"
  ];
  // step 1-13 → stepLabels[step-1]

  const renderStep = () => {
    switch (step) {
      // ─── Step 1: Processo ────────────────────────────────────────────
      case 1: return (
        <Card title="Informações do processo">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Número do processo *">
              <input className="input" placeholder="Ex: 2026/0042" value={processo.numero} onChange={e => setProcesso({ ...processo, numero: e.target.value })} />
            </Field>
            <Field label="Órgão *">
              <input className="input" placeholder="Ex: Secretaria de Saúde de RO" value={processo.orgao} onChange={e => setProcesso({ ...processo, orgao: e.target.value })} />
            </Field>
            <Field label="Unidade solicitante">
              <input className="input" placeholder="Ex: DTEC/SEGEP" value={processo.unidade} onChange={e => setProcesso({ ...processo, unidade: e.target.value })} />
            </Field>
            <Field label="Responsável *">
              <input className="input" placeholder="Nome completo" value={processo.responsavel} onChange={e => setProcesso({ ...processo, responsavel: e.target.value })} />
            </Field>
            <Field label="E-mail do responsável *">
              <input type="email" className="input" placeholder="servidor@orgao.gov.br" value={processo.email} onChange={e => setProcesso({ ...processo, email: e.target.value })} />
            </Field>
          </div>
          <div className="flex justify-end mt-6">
            <Button onClick={nextStep} primary disabled={!processo.numero || !processo.orgao || !processo.responsavel || !processo.email}>
              Próximo <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      );

      // ─── Step 2: Objeto ──────────────────────────────────────────────
      case 2: return (
        <Card title="Descrição do objeto">
          <Field label="Descreva o objeto da contratação">
            <textarea
              className="input min-h-[120px]"
              placeholder="Ex: Aquisição de notebooks para uso administrativo com processador Intel Core i5 ou superior, 16 GB RAM, 256 GB SSD..."
              value={objetoDesc}
              onChange={e => setObjetoDesc(e.target.value)}
            />
          </Field>
          <p className="text-xs text-neutral-500 mt-2">Seja específico: inclua características principais, finalidade e exigências técnicas essenciais.</p>
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <Button onClick={nextStep} primary disabled={objetoDesc.length < 10}>Próximo <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </Card>
      );

      // ─── Step 3: Especificações ──────────────────────────────────────
      case 3: return (
        <Card title="Especificação técnica">
          <p className="text-sm text-neutral-500 mb-4">Detalhe as características técnicas exigidas. Serão usadas para calcular a similaridade nos resultados.</p>
          <div className="space-y-3">
            {especificacao.map((esp, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start p-3 rounded-lg border border-neutral-100 bg-neutral-50/50">
                <div className="md:col-span-3">
                  <input className="input text-sm" placeholder="Item (ex: Processador)" value={esp.item} onChange={e => updateEspec(idx, "item", e.target.value)} />
                </div>
                <div className="md:col-span-6">
                  <input className="input text-sm" placeholder="Especificação (ex: Intel Core i5 ou superior)" value={esp.especificacao} onChange={e => updateEspec(idx, "especificacao", e.target.value)} />
                </div>
                <div className="md:col-span-2 flex items-center gap-2 pt-2">
                  <input type="checkbox" id={`obr-${idx}`} checked={esp.obrigatorio} onChange={e => updateEspec(idx, "obrigatorio", e.target.checked)} />
                  <label htmlFor={`obr-${idx}`} className="text-xs text-neutral-500">Obrigatório</label>
                </div>
                <div className="md:col-span-1 flex justify-end">
                  <button onClick={() => removeEspec(idx)} className="p-1.5 rounded hover:bg-red-100 text-neutral-400 hover:text-red-600">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addEspecificacao} className="mt-3 inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 font-medium">
            <PlusIcon /> Adicionar item
          </button>
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <Button onClick={nextStep} primary>Próximo <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </Card>
      );

      // ─── Step 4: Quantidade ──────────────────────────────────────────
      case 4: return (
        <Card title="Quantidade e parcelamento">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Quantidade *">
              <input type="number" className="input" min={1} value={quantidade} onChange={e => setQuantidade(Number(e.target.value))} />
            </Field>
            <Field label="Unidade de medida">
              <select className="input" value={unidadeMedida} onChange={e => setUnidadeMedida(e.target.value)}>
                {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Forma de parcelamento">
              <select className="input" value={formaParcelamento} onChange={e => setFormaParcelamento(e.target.value as FormaParcelamento)}>
                <option value="item">Por item</option>
                <option value="lote">Por lote</option>
                <option value="global">Preço global</option>
              </select>
            </Field>
            <Field label="Local de entrega">
              <input className="input" placeholder="Ex: Porto Velho/RO" value={localEntrega} onChange={e => setLocalEntrega(e.target.value)} />
            </Field>
          </div>
          {formaParcelamento === "global" && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
              <strong>Atenção:</strong> No preço global, o valor total é calculado diretamente. A quantidade serve apenas como referência de escopo.
            </div>
          )}
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <Button onClick={nextStep} primary disabled={quantidade < 1}>Próximo <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </Card>
      );

      // ─── Step 5: Local/Editais (simplificado, sem mock) ─────────────
      case 5: return (
        <Card title="Local de entrega e abrangência">
          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4 mb-4">
            <p className="text-sm font-medium text-neutral-700 mb-2">Resumo até aqui</p>
            <ul className="text-sm text-neutral-600 space-y-1">
              <li><span className="font-medium">Processo:</span> {processo.numero} — {processo.orgao}</li>
              <li><span className="font-medium">Objeto:</span> {objetoDesc.substring(0, 100)}{objetoDesc.length > 100 ? "..." : ""}</li>
              <li><span className="font-medium">Quantidade:</span> {quantidade} {unidadeMedida}(s)</li>
              <li><span className="font-medium">Local de entrega:</span> {localEntrega || "Não informado"}</li>
            </ul>
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
            <strong>Próxima etapa:</strong> Configurar a pesquisa e buscar preços de referência em múltiplas fontes: PNCP, Painel de Preços, Compras.gov, BPS Saúde e SINAPI.
          </div>
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <Button onClick={nextStep} primary>Revisar e confirmar <ChevronRight className="w-4 h-4" /></Button>
          </div>
        </Card>
      );

      // ─── Step 6: Revisar ────────────────────────────────────────────
      case 6: return (
        <Card title="Revisar e confirmar informações">
          {erro && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {erro}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Processo"><input className="input bg-neutral-50" value={processo.numero} readOnly /></Field>
            <Field label="Órgão"><input className="input bg-neutral-50" value={processo.orgao} readOnly /></Field>
            <Field label="Unidade"><input className="input bg-neutral-50" value={processo.unidade || "—"} readOnly /></Field>
            <Field label="Responsável"><input className="input bg-neutral-50" value={processo.responsavel} readOnly /></Field>
            <Field label="E-mail"><input className="input bg-neutral-50" value={processo.email} readOnly /></Field>
            <Field label="Objeto resumido"><input className="input bg-neutral-50" value={`${quantidade} ${unidadeMedida}(s) — ${formaParcelamento}`} readOnly /></Field>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-sm">
            <strong>Especificações técnicas ({especificacao.filter(e => e.item).length} itens):</strong>
            <ul className="list-disc list-inside mt-1 text-neutral-600">
              {especificacao.filter(e => e.item).map((e, i) => (
                <li key={i}>{e.item}: {e.especificacao} {e.obrigatorio ? "(obrigatório)" : "(desejável)"}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-neutral-500 mt-4">
            Ao confirmar, o processo e a pesquisa serão registrados no sistema e a busca poderá ser iniciada.
          </p>
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <Button onClick={confirmarECriar} primary disabled={loading}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : "Confirmar e prosseguir"}
            </Button>
          </div>
        </Card>
      );

      // ─── Step 7: Configurações de pesquisa ──────────────────────────
      case 7: return (
        <Card title="Configurações da pesquisa">
          {erro && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {erro}
            </div>
          )}
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 mb-4">
            <Check className="w-4 h-4 inline mr-1" />
            Processo e pesquisa registrados com sucesso.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Field label="Período de referência">
              <select className="input" value={config.periodo} onChange={e => setConfig({ ...config, periodo: e.target.value as PeriodoPesquisa })}>
                <option value="12_meses">Últimos 12 meses</option>
                <option value="6_meses">Últimos 6 meses</option>
                <option value="24_meses">Últimos 24 meses</option>
              </select>
            </Field>
            <Field label="Região">
              <select className="input" value={config.regiao} onChange={e => setConfig({ ...config, regiao: e.target.value as RegiaoPesquisa })}>
                <option value="brasil">Todo o Brasil</option>
                <option value="norte">Norte</option>
                <option value="nordeste">Nordeste</option>
                <option value="centro_oeste">Centro-Oeste</option>
                <option value="sudeste">Sudeste</option>
                <option value="sul">Sul</option>
              </select>
            </Field>
            <Field label="Mínimo de referências">
              <input type="number" className="input" min={1} max={20} value={config.qtdMin} onChange={e => setConfig({ ...config, qtdMin: Number(e.target.value) })} />
            </Field>
            <Field label="Método de cálculo">
              <select className="input" value={config.metodo} onChange={e => setConfig({ ...config, metodo: e.target.value as MetodoCalculo })}>
                <option value="media_aritmetica">Média aritmética</option>
                <option value="mediana">Mediana</option>
                <option value="media_ponderada">Média ponderada</option>
                <option value="menor_preco">Menor preço</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 p-3 rounded-lg bg-neutral-50 border border-neutral-100 text-sm text-neutral-600">
            Fontes que serão consultadas: <strong>PNCP, Painel de Preços, Compras.gov.br, BPS Saúde, SINAPI</strong>
          </div>
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <Button onClick={iniciarBusca} primary disabled={loading || !pesquisaId}>
              {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando...</> : "Iniciar busca de preços"}
            </Button>
          </div>
        </Card>
      );

      // ─── Step 8: Agentes em tempo real ──────────────────────────────
      case 8: return (
        <Card title="Consultando fontes de preços">
          <p className="text-sm text-neutral-500 mb-6">
            Os agentes estão consultando múltiplas bases de dados simultaneamente. Aguarde a conclusão.
          </p>
          {pesquisaId && (
            <AgentStatusPanel
              pesquisaId={pesquisaId}
              onConcluido={onBuscaConcluida}
            />
          )}
          {carregandoResultados && (
            <div className="mt-4 flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando resultados...
            </div>
          )}
        </Card>
      );

      // ─── Step 9: Resultados ─────────────────────────────────────────
      case 9: return (
        <Card title={`Resultados da pesquisa (${resultados.length} encontrados)`}>
          {resultados.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">Nenhum resultado encontrado. Tente ampliar o período ou a região de busca.</p>
              <Button onClick={() => goToStep(7)} secondary className="mt-4">Ajustar configurações</Button>
            </div>
          ) : (
            <>
              <div className="mb-3 text-xs text-neutral-500">
                Aceite os preços compatíveis com seu objeto e rejeite os que não se aplicam. Use a justificativa quando rejeitar.
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Órgão</th>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Descrição</th>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Qtd</th>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Data</th>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Valor unit.</th>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Local</th>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Sim.</th>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Fonte / Link</th>
                      <th className="text-left px-3 py-2 font-medium text-neutral-600">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultados.map(r => (
                      <tr key={r.id} className={`border-t border-neutral-100 ${r.avaliacao === "rejeitado" ? "opacity-50 bg-red-50/30" : r.avaliacao === "aceito" ? "bg-green-50/30" : ""}`}>
                        <td className="px-3 py-2 text-xs">{r.orgao}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate text-xs" title={r.descricao}>{r.descricao}</td>
                        <td className="px-3 py-2 text-xs">{r.quantidade ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{r.dataContrato ?? "—"}</td>
                        <td className="px-3 py-2 text-xs font-medium">{r.valorUnitario != null ? formatarMoeda(r.valorUnitario) : "—"}</td>
                        <td className="px-3 py-2 text-xs">{r.localizacao ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{r.similaridade}%</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs text-neutral-500">{r.fonte?.toUpperCase()}</span>
                            {r.linkEdital && (
                              <a href={r.linkEdital} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs">
                                <ExternalLink className="w-3 h-3" /> Ver edital
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => avaliarResultado(r.id, "aceito")}
                              disabled={avaliandoId === r.id}
                              className="p-1 rounded hover:bg-green-100 text-green-600"
                              title="Aceitar"
                            >
                              {avaliandoId === r.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                            </button>
                            <button
                              onClick={() => avaliarResultado(r.id, "rejeitado")}
                              disabled={avaliandoId === r.id}
                              className="p-1 rounded hover:bg-red-100 text-red-600"
                              title="Rejeitar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          {r.avaliacao === "rejeitado" && (
                            <input
                              className="mt-1 w-full text-xs px-2 py-1 rounded border border-neutral-200"
                              placeholder="Justificativa..."
                              value={r.justificativaRejeicao || ""}
                              onBlur={e => avaliarResultado(r.id, "rejeitado", e.target.value)}
                              onChange={e => setResultados(prev => prev.map(x => x.id === r.id ? { ...x, justificativaRejeicao: e.target.value } : x))}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex gap-4 text-xs text-neutral-500">
                <span className="text-green-600 font-medium">{resultados.filter(r => r.avaliacao === "aceito").length} aceitos</span>
                <span className="text-red-500">{resultados.filter(r => r.avaliacao === "rejeitado").length} rejeitados</span>
                <span>{resultados.filter(r => r.avaliacao === "pendente").length} pendentes</span>
              </div>
            </>
          )}
          <div className="flex justify-between mt-6">
            <Button onClick={() => goToStep(7)} secondary>Ajustar configurações</Button>
            <Button
              onClick={() => { calcular(); nextStep(); }}
              primary
              disabled={resultados.filter(r => r.avaliacao === "aceito").length === 0}
            >
              Calcular estimativa
            </Button>
          </div>
        </Card>
      );

      // ─── Step 10: Análise estatística ────────────────────────────────
      case 10: return (
        <Card title="Análise estatística">
          {estatisticas ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
                <StatBox label="referências" value={estatisticas.n.toString()} />
                <StatBox label="média" value={formatarMoeda(estatisticas.media)} />
                <StatBox label="mediana" value={formatarMoeda(estatisticas.mediana)} />
                <StatBox label="mínimo" value={formatarMoeda(estatisticas.minimo)} />
                <StatBox label="máximo" value={formatarMoeda(estatisticas.maximo)} />
                <StatBox label="desvio padrão" value={estatisticas.desvioPadrao.toFixed(2)} />
                <StatBox label="coef. variação" value={`${estatisticas.coeficienteVariacao.toFixed(1)}%`} />
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <h3 className="text-sm font-medium mb-2">Memória de cálculo</h3>
                <div className="font-mono text-xs text-neutral-600 space-y-1">
                  <p>referências aceitas: {estatisticas.n}</p>
                  <p>valores: {resultados.filter(r => r.avaliacao === "aceito" && r.valorUnitario != null).map(r => formatarMoeda(r.valorUnitario!)).join(" | ")}</p>
                  <p>média = {formatarMoeda(estatisticas.media)}</p>
                  <p>mediana = {formatarMoeda(estatisticas.mediana)}</p>
                  <p>mínimo = {formatarMoeda(estatisticas.minimo)} | máximo = {formatarMoeda(estatisticas.maximo)}</p>
                  <p>desvio padrão = {estatisticas.desvioPadrao.toFixed(2)}</p>
                  <p>coeficiente de variação = {estatisticas.coeficienteVariacao.toFixed(1)}%</p>
                </div>
              </div>
              {estatisticas.coeficienteVariacao > 25 && (
                <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                  <strong>Atenção:</strong> O coeficiente de variação ({estatisticas.coeficienteVariacao.toFixed(1)}%) está acima de 25%, indicando alta dispersão dos preços. Considere revisar os resultados aceitos.
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-neutral-500 py-8 text-center">Nenhum resultado aceito com valor unitário. Volte e aceite pelo menos um registro.</p>
          )}
          <div className="flex justify-between mt-6">
            <Button onClick={() => goToStep(9)} secondary>Voltar</Button>
            <Button onClick={nextStep} primary disabled={!estatisticas}>Gerar preço estimado</Button>
          </div>
        </Card>
      );

      // ─── Step 11: Preço estimado ─────────────────────────────────────
      case 11: return (
        <Card title="Preço estimado">
          {precoEstimado ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <StatBox label="valor unitário estimado" value={formatarMoeda(precoEstimado.unitario)} />
                <StatBox label={`valor total (${quantidade} ${unidadeMedida})`} value={formatarMoeda(precoEstimado.total)} />
                <StatBox label="método aplicado" value={config.metodo.replace(/_/g, " ")} />
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
                <strong>Justificativa:</strong> O preço foi formado com base em {estatisticas?.n} referências de preços públicos, utilizando o método da {config.metodo.replace(/_/g, " ")}. Coeficiente de variação: {estatisticas?.coeficienteVariacao.toFixed(1)}%.
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500 py-8 text-center">Aceite pelo menos um resultado com valor unitário para gerar o preço estimado.</p>
          )}
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <Button onClick={nextStep} primary disabled={!precoEstimado}>Salvar evidências</Button>
          </div>
        </Card>
      );

      // ─── Step 12: Evidências ─────────────────────────────────────────
      case 12: return (
        <Card title="Documentos e evidências">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 mb-4">
            <h4 className="text-sm font-medium mb-2">Links das referências aceitas</h4>
            {linksAceitos.length > 0 ? (
              <ul className="space-y-2">
                {linksAceitos.map((link, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">{link.nome}</a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-neutral-500">Nenhuma referência com link aceita.</p>
            )}
          </div>
          <div className="rounded-lg bg-neutral-50 border border-neutral-200 p-4">
            <h4 className="text-sm font-medium mb-2">Evidências que serão registradas automaticamente</h4>
            <ul className="list-disc list-inside text-sm text-neutral-600 space-y-1">
              <li>Registros consultados nas fontes públicas em {new Date().toLocaleDateString("pt-BR")}</li>
              <li>Termo de referência do processo {processo.numero}</li>
              <li>Planilha de cálculo intermediária (XLSX)</li>
              <li>Links dos editais aceitos como referência</li>
            </ul>
          </div>
          <div className="flex justify-between mt-6">
            <Button onClick={prevStep} secondary>Voltar</Button>
            <Button
              onClick={async () => {
                await salvarEvidencias();
                await concluirPesquisa();
                nextStep();
              }}
              primary
            >
              Gerar relatório
            </Button>
          </div>
        </Card>
      );

      // ─── Step 13: Relatório final ────────────────────────────────────
      case 13: return (
        <Card title="Relatório final">
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800 mb-6">
            <Check className="w-4 h-4 inline mr-1" />
            <strong>Pesquisa concluída e registrada.</strong> O relatório está pronto para exportação.
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Field label="Nome do arquivo PDF">
              <input className="input" defaultValue={`estimativa_${processo.numero.replace("/", "_")}.pdf`} readOnly />
            </Field>
            <Field label="Nome do arquivo XLSX">
              <input className="input" defaultValue={`estimativa_${processo.numero.replace("/", "_")}.xlsx`} readOnly />
            </Field>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 mb-4 text-sm">
            <p className="font-medium text-neutral-700 mb-1">Metadados incluídos:</p>
            <ul className="list-disc list-inside text-neutral-600 space-y-1">
              <li>Responsável: {processo.responsavel} ({processo.email})</li>
              <li>Processo: {processo.numero} | Órgão: {processo.orgao}</li>
              <li>Referências aceitas ({resultados.filter(r => r.avaliacao === "aceito").length})</li>
              <li>Memória de cálculo completa — método: {config.metodo.replace(/_/g, " ")}</li>
            </ul>
          </div>
          <div className="flex justify-between mt-6">
            <div className="flex gap-2">
              <Button onClick={() => router.push("/pesquisas")} secondary>Ver minhas pesquisas</Button>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  const bytes = gerarXLSX(relatorioData);
                  downloadXLSX(bytes, `estimativa_${processo.numero.replace("/", "_")}.xlsx`);
                }}
                secondary
              >
                Baixar XLSX
              </Button>
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

  const stepInfo = [
    "processo", "objeto", "especificação", "quantidade",
    "local", "revisar", "configurar", "busca",
    "resultados", "calculos", "preço", "evidências", "relatório"
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-medium">Nova pesquisa de preços</h1>
        {pesquisaId && (
          <span className="text-xs font-mono text-neutral-400 bg-neutral-100 px-2 py-1 rounded">
            ID: {pesquisaId.slice(0, 8)}...
          </span>
        )}
      </div>

      {/* Step navigator */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-6">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
          <button
            key={s}
            onClick={() => goToStep(s)}
            className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              s === step
                ? "bg-neutral-900 text-white border-neutral-900"
                : s < step
                ? "bg-neutral-100 text-neutral-700 border-neutral-200 hover:bg-neutral-200"
                : "bg-white text-neutral-400 border-neutral-200 cursor-not-allowed"
            }`}
            disabled={s > step}
          >
            {s}. {stepInfo[s - 1]}
          </button>
        ))}
      </div>

      {renderStep()}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-medium mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-neutral-500">{label}</label>
      {children}
    </div>
  );
}

function Button({
  children, onClick, primary, secondary, disabled, className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const base = "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border";
  const styles = primary
    ? "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
    : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className || ""}`}>
      {children}
    </button>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center">
      <span className="block text-lg font-medium tabular-nums">{value}</span>
      <span className="text-xs text-neutral-500">{label}</span>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
