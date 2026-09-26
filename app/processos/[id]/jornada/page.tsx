"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Loader2, FileText, History, ShieldAlert, ShieldCheck, Wand2, ChevronRight, CheckSquare, Sparkles, FileUp, Scale, Plus } from "lucide-react";
import { obterTarefasDoProcesso, avancarEtapa, obterHistorico, gerarMinuta, listarMinutas, escreverComIA, obterJornada, sugerirDotacaoOrcamentaria, buscarJulgadosDoProcesso, adicionarJulgado, listarJulgados, alternarJulgadoUsado, removerJulgado, listarModelosDocumento, preencherModeloDocumento } from "@/lib/actions-intencao";

export default function JornadaPage({ params }: { params: { id: string } }) {
  const [tarefas, setTarefas] = useState<any[] | null>(null);
  const [etapasModelo, setEtapasModelo] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [minutas, setMinutas] = useState<any[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [atual, setAtual] = useState<any | null>(null);
  const [docsMarcados, setDocsMarcados] = useState<string[]>([]);
  const [assinado, setAssinado] = useState(false);
  const [avancando, setAvancando] = useState(false);
  const [gerandoMinuta, setGerandoMinuta] = useState(false);
  const [gerandoMinIA, setGerandoMinIA] = useState(false);
  const [minutaContexto, setMinutaContexto] = useState("");
  const [tipoMinuta, setTipoMinuta] = useState("despacho");
  const [lendoDoc, setLendoDoc] = useState(false);
  const [resumoDoc, setResumoDoc] = useState<any | null>(null);
  const [erroDoc, setErroDoc] = useState<string | null>(null);
  const [camposEtapa, setCamposEtapa] = useState<Record<string, string>>({});
  const [sugestoesDotacao, setSugestoesDotacao] = useState<any[] | null>(null);
  const [carregandoDotacao, setCarregandoDotacao] = useState(false);
  const [julgados, setJulgados] = useState<any[]>([]);
  const [resultadoJulgados, setResultadoJulgados] = useState<any[] | null>(null);
  const [buscandoJulgados, setBuscandoJulgados] = useState(false);
  const [erroJulgados, setErroJulgados] = useState<string | null>(null);
  const [modelos, setModelos] = useState<any[]>([]);
  const [modeloSelecionado, setModeloSelecionado] = useState("");
  const [preenchendoModelo, setPreenchendoModelo] = useState(false);
  const [conteudoModeloPreenchido, setConteudoModeloPreenchido] = useState<string | null>(null);
  const [julgadosUsados, setJulgadosUsados] = useState(0);
  // ── AGENTE REVISOR: validação do processo antes de publicar ──
  const [revisaoIA, setRevisaoIA] = useState<string | null>(null);
  const [revisando, setRevisando] = useState(false);
  // ── AGENTE BIBLIOTECÁRIO: sugere julgados mais aderentes com motivo ──
  const [sugestoesJulgados, setSugestoesJulgados] = useState<any[] | null>(null);
  const [sugerindoJulgados, setSugerindoJulgados] = useState(false);

  const carregar = async () => {
    const ts = await obterTarefasDoProcesso(params.id);
    setTarefas(ts);
    setAtual(ts.find((t: any) => t.status === "em_andamento") || ts.find((t: any) => t.status === "pendente") || null);
    setHistorico(await obterHistorico(params.id));
    setMinutas(await listarMinutas(params.id));
    // Carrega o modelo de etapas (documentos/validações vivem em etapas_processo,
    // NÃO nas tarefas) para casar com a etapa atual
    const tipoId = ts[0]?.tipoProcessoId;
    if (tipoId) {
      try {
        setEtapasModelo(await obterJornada(tipoId));
      } catch { /* modelo indisponível */ }
    }
    // Julgados guardados + modelos AGU
    setJulgados(await listarJulgados(params.id).catch(() => []));
    setModelos(await listarModelosDocumento().catch(() => []));
  };

  useEffect(() => {
    carregar().catch((e) => setErro(String(e?.message || e)));
  }, [params.id]);

  async function avancar() {
    if (!atual) return;
    setAvancando(true);
    try {
      // Valida campos obrigatórios da etapa (ex: dataAbertura, modalidade)
      const camposObrig = (etapaModelo as any)?.camposObrigatorios || [];
      const faltando = camposObrig.filter((c: string) => !(camposEtapa[c] || "").trim());
      if (faltando.length > 0) {
        setErro(`Campos obrigatórios em falta: ${faltando.map((c: string) => c).join(", ")}. Preencha antes de avançar.`);
        setTimeout(() => setErro(null), 6000);
        setAvancando(false);
        return;
      }
      const r = await avancarEtapa(atual.id, docsMarcados, assinado);
      if (r.ok) {
        setDocsMarcados([]);
        setAssinado(false);
        setCamposEtapa({});
        await carregar();
      } else {
        setErro(r.mensagem);
        setTimeout(() => setErro(null), 5000);
      }
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setAvancando(false);
    }
  }

  async function carregarSugestoesDotacao() {
    setCarregandoDotacao(true);
    setSugestoesDotacao(null);
    try {
      setSugestoesDotacao(await sugerirDotacaoOrcamentaria(params.id));
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setCarregandoDotacao(false);
    }
  }

  async function buscarJulgados() {
    setBuscandoJulgados(true);
    setResultadoJulgados(null);
    setErroJulgados(null);
    try {
      const r = await buscarJulgadosDoProcesso(params.id);
      setResultadoJulgados(r);
    } catch (e: any) {
      setErroJulgados(String(e?.message || e));
    } finally {
      setBuscandoJulgados(false);
    }
  }

  async function adicionarJulgadoDoProcesso(j: any) {
    try {
      await adicionarJulgado(params.id, {
        tribunal: j.tribunal, numero: j.numero, relator: j.relator,
        orgaoJulgador: j.orgaoJulgador, ementa: j.ementa, link: j.link, assunto: j.assunto,
      });
      setJulgados(await listarJulgados(params.id));
      setResultadoJulgados(null);
    } catch (e: any) {
      setErro(String(e?.message || e));
    }
  }

  async function alternarUsado(id: string, usado: boolean) {
    try {
      await alternarJulgadoUsado(id, usado);
      setJulgados(await listarJulgados(params.id));
    } catch (e: any) {
      setErro(String(e?.message || e));
    }
  }

  async function removerJulgadoDoProcesso(id: string) {
    try {
      await removerJulgado(id);
      setJulgados(await listarJulgados(params.id));
    } catch (e: any) {
      setErro(String(e?.message || e));
    }
  }

  async function preencherModelo() {
    if (!modeloSelecionado) return;
    setPreenchendoModelo(true);
    try {
      const r = await preencherModeloDocumento(params.id, modeloSelecionado);
      setConteudoModeloPreenchido(r.conteudoPreenchido);
      setJulgadosUsados(r.julgadosUsados || 0);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setPreenchendoModelo(false);
    }
  }

  async function salvarModeloComoMinuta() {
    if (!conteudoModeloPreenchido) return;
    try {
      const nome = modelos.find((m: any) => m.id === modeloSelecionado)?.nome || "Modelo AGU";
      await gerarMinuta({ processoId: params.id, tipo: "modelo_agu", contexto: `Modelo: ${nome}\n\n${conteudoModeloPreenchido}` });
      setMinutas(await listarMinutas(params.id));
      setErro("Documento salvo como minuta do processo!");
      setTimeout(() => setErro(null), 4000);
    } catch (e: any) {
      setErro(String(e?.message || e));
    }
  }

  async function gerarMin() {
    setGerandoMinuta(true);
    try {
      await gerarMinuta({ processoId: params.id, tipo: tipoMinuta, contexto: minutaContexto });
      setMinutaContexto("");
      setMinutas(await listarMinutas(params.id));
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setGerandoMinuta(false);
    }
  }

  async function gerarMinIA() {
    setGerandoMinIA(true);
    try {
      const minuta = await escreverComIA({ tipo: tipoMinuta, pedido: minutaContexto, processoId: params.id });
      setMinutaContexto("");
      setMinutas(await listarMinutas(params.id));
      window.alert(`Minuta de ${minuta.tipo} gerada pela IA!`);
    } catch (e: any) {
      setErro(String(e?.message || e));
    } finally {
      setGerandoMinIA(false);
    }
  }

  // ── AGENTE REVISOR: lê o processo e aponta pendências ──
  async function revisarProcesso() {
    setRevisando(true);
    setRevisaoIA(null);
    try {
      const resp = await fetch("/api/ia/revisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processoId: params.id }),
        signal: AbortSignal.timeout(50_000),
      });
      const data = await resp.json().catch(() => null);
      setRevisaoIA(data?.revisao || "Não consegui revisar o processo agora.");
    } catch {
      setRevisaoIA("Não consegui revisar o processo agora. Tente novamente.");
    } finally {
      setRevisando(false);
    }
  }

  // ── AGENTE BIBLIOTECÁRIO: sugere os julgados MAIS aderentes com motivo ──
  async function sugerirJulgadosIA() {
    setSugerindoJulgados(true);
    setSugestoesJulgados(null);
    setErroJulgados(null);
    try {
      const resp = await fetch("/api/ia/bibliotecario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processoId: params.id }),
        signal: AbortSignal.timeout(50_000),
      });
      const data = await resp.json().catch(() => null);
      if (data?.erro) setErroJulgados(data.erro);
      setSugestoesJulgados(data?.sugestoes || []);
    } catch {
      setErroJulgados("Não consegui sugerir julgados agora. Tente novamente.");
      setSugestoesJulgados([]);
    } finally {
      setSugerindoJulgados(false);
    }
  }

  async function enviarDoc(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setLendoDoc(true);
    setResumoDoc(null);
    setErroDoc(null);
    try {
      const form = new FormData();
      form.append("arquivo", arquivo);
      const resp = await fetch("/api/ia/documento", { method: "POST", body: form });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.erro || "Falha ao ler documento");
      setResumoDoc(data);
    } catch (err: any) {
      setErroDoc(String(err?.message || err));
    } finally {
      setLendoDoc(false);
      e.target.value = "";
    }
  }

  // Documentos e validações vêm do MODELO de etapas (etapas_processo),
  // casados pelo título da etapa atual — a tarefa em si não tem esses campos.
  const etapaModelo = etapasModelo.find((e: any) => e.titulo === (atual as any)?.etapa);
  const docsNecessarios = (etapaModelo as any)?.documentosNecessarios || [];
  const precisaAssinatura = (etapaModelo as any)?.validacoes?.some((v: any) => v.tipo === "assinatura");

  const totalEtapas = tarefas?.length || 0;
  const etapasConcluidas = tarefas?.filter((t: any) => t.status === "concluida").length || 0;
  const percentualProgresso = totalEtapas ? Math.round((etapasConcluidas / totalEtapas) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Link href="/painel" className="inline-flex items-center gap-1 text-sm text-[#032650] hover:text-[#042f5e] mb-4">
        <ArrowLeft size={14} /> Voltar ao painel
      </Link>

      {erro && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{erro}</div>}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Jornada guiada do processo</h1>
          <p className="text-sm text-slate-500">{params.id.slice(0, 8)} — o sistema conduz etapa por etapa</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] gap-6 items-start">
        <aside className="lg:sticky lg:top-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#032650]/55">Acompanhamento</p>
                <h2 className="text-base font-bold text-slate-800 mt-1">Rito do processo</h2>
              </div>
              <span className="rounded-full bg-[#eef2f8] px-2.5 py-1 text-[11px] font-bold text-[#032650]">{percentualProgresso}%</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">{etapasConcluidas} de {totalEtapas} etapas concluídas</p>
            <div className="mt-3 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full rounded-full bg-[#032650] transition-all duration-500" style={{ width: `${percentualProgresso}%` }} />
            </div>
          </div>

          <div className="p-4 max-h-[calc(100vh-220px)] overflow-y-auto">
            {tarefas === null ? (
              <div className="flex items-center gap-2 py-4 px-2 text-xs text-slate-400">
                <Loader2 size={14} className="animate-spin" /> Carregando rito...
              </div>
            ) : tarefas.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 px-2">Nenhuma etapa cadastrada.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200" />
                <div className="space-y-2">
                  {tarefas.map((t: any, i: number) => {
                    const concluida = t.status === "concluida";
                    const emAndamento = t.status === "em_andamento" || atual?.id === t.id;
                    return (
                      <div key={t.id} className={`relative flex gap-3 rounded-xl px-2.5 py-3 ${emAndamento ? "bg-[#eef2f8] ring-1 ring-[#c7d2e3]" : ""}`}>
                        <div className={`relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                          concluida ? "border-emerald-500 bg-emerald-500 text-white" :
                          emAndamento ? "border-[#032650] bg-[#032650] text-white" :
                          "border-slate-200 bg-white text-slate-300"
                        }`}>
                          {concluida ? <CheckCircle2 size={15} /> : <span className="text-[10px] font-bold">{i + 1}</span>}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs leading-snug ${
                            concluida ? "font-medium text-slate-400 line-through decoration-slate-400" :
                            emAndamento ? "font-bold text-[#032650]" :
                            "font-medium text-slate-500"
                          }`}>{t.titulo}</p>
                          {concluida && <span className="mt-1 inline-block text-[10px] font-semibold text-emerald-600">Concluída</span>}
                          {emAndamento && !concluida && (
                            <span className="mt-1 inline-flex rounded-full bg-[#032650] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">Você está aqui</span>
                          )}
                          {!concluida && !emAndamento && <span className="mt-1 inline-block text-[10px] text-slate-400">Próxima etapa</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {tarefas && tarefas.length > 0 && etapasConcluidas === totalEtapas && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                <CheckCircle2 size={18} className="mx-auto text-emerald-600 mb-1" />
                <p className="text-xs font-bold text-emerald-700">Rito concluído</p>
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0">
      {/* Etapa atual */}
      {atual ? (
        <div className="rounded-2xl border-2 border-[#d5dce8] bg-white p-6 shadow-sm mb-6">
          <p className="text-xs font-semibold text-[#C9A227] uppercase tracking-wide mb-1">Etapa atual</p>
          <h2 className="text-lg font-bold text-slate-800 mb-1">{atual.titulo}</h2>
          <p className="text-sm text-slate-600 mb-4">{atual.descricao || atual.instrucao}</p>

          {/* Checklist de documentos */}
          {docsNecessarios.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Documentos necessários</p>
              <div className="space-y-1.5">
                {docsNecessarios.map((doc: string) => {
                  const marcado = docsMarcados.includes(doc);
                  return (
                    <label key={doc} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => setDocsMarcados(marcado ? docsMarcados.filter((d) => d !== doc) : [...docsMarcados, doc])}
                        className="accent-[#032650]"
                      />
                      <span className={`text-sm ${marcado ? "text-slate-400 line-through" : "text-slate-700"}`}>{doc}</span>
                      {marcado && <CheckCircle2 size={14} className="ml-auto text-green-500" />}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assinatura */}
          {precisaAssinatura && (
            <label className="flex items-center gap-2.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5 cursor-pointer mb-4">
              <input type="checkbox" checked={assinado} onChange={(e) => setAssinado(e.target.checked)} className="accent-purple-600" />
              <span className="text-sm text-purple-800">Confirmo que o documento foi assinado pela autoridade competente</span>
              <ShieldAlert size={14} className="ml-auto text-purple-500" />
            </label>
          )}

          {/* Campos obrigatórios da etapa (ex: data de abertura, modalidade) */}
          {((etapaModelo as any)?.camposObrigatorios || []).length > 0 && (
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {((etapaModelo as any)?.camposObrigatorios || []).map((campo: string) => (
                <div key={campo}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    {campo === "dataAbertura" ? "Data de abertura das propostas" :
                     campo === "modalidade" ? "Modalidade" :
                     campo === "objeto" ? "Objeto" :
                     campo === "quantidade" ? "Quantidade" :
                     campo === "unidade" ? "Unidade" :
                     campo === "justificativa" ? "Justificativa" :
                     campo === "metodoCalculo" ? "Método de cálculo" :
                     campo === "valorEstimado" ? "Valor estimado" :
                     campo === "dotacaoOrcamentaria" ? "Dotação orçamentária" :
                     campo === "especificacoes" ? "Especificações técnicas" :
                     campo === "condicoesPagamento" ? "Condições de pagamento" :
                     campo === "destino" ? "Destino" :
                     campo === "dataInicio" ? "Data de início" :
                     campo === "dataFim" ? "Data de fim" :
                     campo === "motivo" ? "Motivo" :
                     campo === "valorDiarias" ? "Valor das diárias" :
                     campo === "tipoLicenca" ? "Tipo de licença" :
                     campo === "fundamentacaoLegal" ? "Fundamentação legal" :
                     campo}
                  </label>
                  {campo.toLowerCase().includes("data") ? (
                    <div>
                      <input
                        type="date"
                        value={camposEtapa[campo] || ""}
                        onChange={(e) => setCamposEtapa({ ...camposEtapa, [campo]: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#C9A227] text-sm"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {campo === "dataAbertura" ? "Ex.: 15/10/2026 — data prevista para abertura das propostas" :
                         campo === "dataInicio" ? "Ex.: 01/09/2026 — primeiro dia da viagem/licença" :
                         campo === "dataFim" ? "Ex.: 05/09/2026 — último dia" :
                         "Selecione a data"}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <input
                        type="text"
                        value={camposEtapa[campo] || ""}
                        onChange={(e) => setCamposEtapa({ ...camposEtapa, [campo]: e.target.value })}
                        placeholder={
                          campo === "modalidade" ? "Ex.: Pregão Eletrônico, Concorrência, Dispensa..." :
                          campo === "objeto" ? "Ex.: Aquisição de papel A4 para uso administrativo" :
                          campo === "quantidade" ? "Ex.: 500" :
                          campo === "unidade" ? "Ex.: resma, unidade, kg, m²..." :
                          campo === "justificativa" ? "Ex.: necessidade de reposição do estoque para o exercício" :
                          campo === "metodoCalculo" ? "Ex.: média aritmética, mediana, menor preço..." :
                          campo === "valorEstimado" ? "Ex.: 45.000,00" :
                          campo === "dotacaoOrcamentaria" ? "Ex.: 2026.04.122.2001.0001.3.3.90.30" :
                          campo === "especificacoes" ? "Ex.: 75g/m², branco, 500 folhas, formato A4" :
                          campo === "condicoesPagamento" ? "Ex.: pagamento em 30 dias após entrega, via nota de empenho" :
                          campo === "destino" ? "Ex.: Brasília/DF — Almoxarifado Central" :
                          campo === "motivo" ? "Ex.: participação em reunião de trabalho na sede do órgão" :
                          campo === "valorDiarias" ? "Ex.: 350,00 (conforme tabela vigente)" :
                          campo === "tipoLicenca" ? "Ex.: licença para tratamento de saúde, licença-maternidade..." :
                          campo === "fundamentacaoLegal" ? "Ex.: art. 75, II da Lei 14.133/2021" :
                          `Informe ${campo}`
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#C9A227] text-sm"
                      />
                      {campo === "dotacaoOrcamentaria" && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={carregarSugestoesDotacao}
                            disabled={carregandoDotacao}
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#032650] hover:text-[#042f5e] bg-[#eef2f8] hover:bg-[#d5dce8] px-2.5 py-1 rounded-lg cursor-pointer"
                          >
                            {carregandoDotacao ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                            Sugerir com base no objeto
                          </button>

                          {sugestoesDotacao && sugestoesDotacao.length > 0 && (
                            <div className="mt-2 space-y-1.5">
                              <p className="text-[10px] text-slate-400">Sugestões (valide com a unidade de orçamento antes de usar):</p>
                              {sugestoesDotacao.map((s, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setCamposEtapa({ ...camposEtapa, dotacaoOrcamentaria: s.classificacao })}
                                  className="w-full text-left rounded-lg border border-[#d5dce8] hover:border-[#C9A227] bg-[#eef2f8]/40 hover:bg-[#eef2f8] px-2.5 py-1.5 cursor-pointer transition-colors"
                                >
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="font-mono text-[11px] font-semibold text-[#032650]">{s.classificacao}</span>
                                    <span className="text-[10px] font-bold text-[#C9A227]">{s.compatibilidade}%</span>
                                  </span>
                                  <span className="block text-[10px] text-slate-500">{s.descricao}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {sugestoesDotacao && sugestoesDotacao.length === 0 && (
                            <p className="mt-1 text-[10px] text-slate-400">Nenhuma sugestão encontrada para este objeto. Preencha manualmente.</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Validação antes de avançar */}
          <button
            onClick={avancar}
            disabled={avancando}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#032650] text-white text-sm font-semibold hover:bg-[#032650] disabled:opacity-50 cursor-pointer"
          >
            {avancando ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={14} />}
            Concluir etapa e avançar
          </button>
          <p className="mt-2 text-[11px] text-slate-400">O sistema valida documentos e assinaturas antes de liberar a próxima etapa.</p>
        </div>
      ) : tarefas && tarefas.length > 0 ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center mb-6">
          <CheckCircle2 size={28} className="mx-auto text-green-600 mb-2" />
          <p className="font-semibold text-green-800">Processo finalizado!</p>
          <p className="text-sm text-green-700">Todas as etapas foram concluídas.</p>
        </div>
      ) : null}

      {/* Minutas */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Wand2 size={16} className="text-[#032650]" />
          <h3 className="font-semibold text-slate-800 text-sm">Gerar minuta de documento</h3>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {["despacho", "parecer", "memorando", "oficio", "justificativa", "relatorio"].map((t) => (
            <button
              key={t}
              onClick={() => setTipoMinuta(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                tipoMinuta === t ? "bg-[#032650] text-white border-[#032650]" : "bg-white text-slate-600 border-slate-300 hover:border-[#C9A227]"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <textarea
          value={minutaContexto}
          onChange={(e) => setMinutaContexto(e.target.value)}
          placeholder="O que deve constar no documento? Ex.: justificar por que o prazo foi prorrogado..."
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-[#C9A227] text-sm min-h-[70px]"
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <button
            onClick={gerarMin}
            disabled={gerandoMinuta}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#eef2f8] text-[#032650] text-sm font-semibold hover:bg-[#d5dce8] disabled:opacity-50 cursor-pointer"
          >
            {gerandoMinuta ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            Gerar minuta (modelo)
          </button>
          <button
            onClick={gerarMinIA}
            disabled={gerandoMinIA}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#032650] to-[#0a3a6e] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {gerandoMinIA ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Escrever com IA
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Escrever com IA: descreva em linguagem normal o que o documento deve dizer (ex.: "justificar por que o prazo foi prorrogado").
        </p>

        {minutas.length > 0 && (
          <div className="mt-4 space-y-2">
            {minutas.map((m) => (
              <div key={m.id} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{m.tipo} · {m.status}</p>
                  {m.acao === "minuta_ia" && <Sparkles size={12} className="text-purple-500" />}
                </div>
                <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">{m.conteudo}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leitura e resumo de documentos */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-3">
          <FileUp size={16} className="text-emerald-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Ler e resumir documento (PDF/TXT)</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Envie um PDF, processo ou anexo e a IA devolve: o que aconteceu, o que importa, o que falta, prazos e a ação necessária.
        </p>
        <input
          type="file"
          accept=".pdf,.txt,.md"
          onChange={enviarDoc}
          disabled={lendoDoc}
          className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-emerald-50 file:text-emerald-700 file:text-sm file:font-semibold hover:file:bg-emerald-100 cursor-pointer"
        />
        {lendoDoc && (
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 size={14} className="animate-spin text-emerald-600" /> Lendo documento e consultando a IA…
          </p>
        )}
        {resumoDoc && (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Resumo inteligente — {resumoDoc.nome}</p>
            <div className="space-y-2 text-sm text-slate-700">
              <p><span className="font-semibold text-slate-900"> O que aconteceu:</span> {resumoDoc.resumo.aconteceu}</p>
              <p><span className="font-semibold text-slate-900"> O que importa:</span> {resumoDoc.resumo.importa}</p>
              <p><span className="font-semibold text-slate-900"> O que falta:</span> {resumoDoc.resumo.falta}</p>
              <p><span className="font-semibold text-slate-900"> Prazos:</span> {resumoDoc.resumo.prazos}</p>
              <p><span className="font-semibold text-slate-900"> Ação necessária:</span> {resumoDoc.resumo.acao}</p>
              {resumoDoc.resumo.resumoCompleto && (
                <p className="mt-2 text-xs text-slate-500 italic">{resumoDoc.resumo.resumoCompleto.slice(0, 300)}…</p>
              )}
            </div>
            {/* AGENTE LEITOR: dados estruturados extraídos do documento */}
            {resumoDoc.dados && (resumoDoc.dados.tipoDocumento !== "não identificado" || (resumoDoc.dados.valores || []).length > 0) && (
              <div className="mt-3 rounded-lg bg-white border border-emerald-100 p-3">
                <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide mb-2"> Agente Leitor — dados extraídos do documento</p>
                <div className="text-xs text-slate-700 space-y-1">
                  <p><span className="font-semibold">Tipo de documento:</span> {resumoDoc.dados.tipoDocumento}</p>
                  {resumoDoc.dados.orgao && <p><span className="font-semibold">Órgão/UG:</span> {resumoDoc.dados.orgao}</p>}
                  {resumoDoc.dados.objeto && <p><span className="font-semibold">Objeto:</span> {resumoDoc.dados.objeto.slice(0, 120)}</p>}
                  {(resumoDoc.dados.valores || []).length > 0 && (
                    <div className="mt-1.5">
                      <p className="font-semibold mb-1">Valores encontrados:</p>
                      {resumoDoc.dados.valores.map((v: any, i: number) => (
                        <p key={i} className="ml-2">
                          • {v.descricao || "Item"} — {v.valorUnitario ? `R$ ${Number(v.valorUnitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : v.valorTotal ? `R$ ${Number(v.valorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "valor não identificado"}
                          {v.quantidade ? ` · qtd ${v.quantidade} ${v.unidade || ""}` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                  {(resumoDoc.dados.campos?.numeroProcesso || resumoDoc.dados.campos?.dotacao || resumoDoc.dados.campos?.modalidade) && (
                    <p className="mt-1">
                      <span className="font-semibold">Campos:</span>{" "}
                      {[resumoDoc.dados.campos?.numeroProcesso && `Processo ${resumoDoc.dados.campos.numeroProcesso}`,
                        resumoDoc.dados.campos?.dotacao && `Dotação ${resumoDoc.dados.campos.dotacao}`,
                        resumoDoc.dados.campos?.modalidade && `Modalidade ${resumoDoc.dados.campos.modalidade}`].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {erroDoc && <p className="mt-2 text-xs text-red-600">{erroDoc}</p>}
      </div>

      {/* Julgados de apoio (TCU/TCE) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Scale size={16} className="text-rose-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Julgados de apoio (TCU/TCE)</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Busque acórdãos sobre o objeto e guarde os links no processo — servem de parâmetro para o edital, para a justificativa e para fundamentar recursos.
        </p>

        <div className="flex flex-wrap gap-2 mb-3">
          <button
            onClick={buscarJulgados}
            disabled={buscandoJulgados}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            {buscandoJulgados ? <Loader2 size={12} className="animate-spin" /> : <Scale size={12} />}
            Buscar julgados sobre o objeto
          </button>
          {/* AGENTE BIBLIOTECÁRIO: sugere os julgados MAIS aderentes com motivo */}
          <button
            onClick={sugerirJulgadosIA}
            disabled={sugerindoJulgados}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 px-3 py-1.5 rounded-lg cursor-pointer disabled:opacity-50"
          >
            {sugerindoJulgados ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {sugerindoJulgados ? "Analisando aderência…" : "Sugerir os melhores julgados"}
          </button>
        </div>

        {erroJulgados && <p className="text-xs text-red-600 mb-2">{erroJulgados}</p>}

        {/* AGENTE BIBLIOTECÁRIO: sugestões ranqueadas com motivo */}
        {sugestoesJulgados && sugestoesJulgados.length > 0 && (
          <div className="mb-3 space-y-2">
            <p className="text-[11px] font-semibold text-rose-500 uppercase tracking-wide">
               Bibliotecário — os mais aderentes ao seu objeto (com motivo):
            </p>
            {sugestoesJulgados.map((j: any, i: number) => (
              <div key={i} className="rounded-lg border border-rose-200 bg-white px-3 py-2 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">
                      {j.tribunal === "tcu" ? "TCU" : "TCE-RO"} — Acórdão {j.numero}
                      {j.relator && j.relator !== "—" ? <span className="font-normal text-slate-500"> · Rel. {j.relator}</span> : null}
                    </p>
                    {j.motivo && (
                      <p className="mt-0.5 text-[11px] text-rose-700 leading-snug">
                        <span className="font-semibold">Por quê:</span> {j.motivo}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 line-clamp-1">{j.ementa?.slice(0, 120)}</p>
                    <a href={j.link} target="_blank" rel="noreferrer" className="text-[10px] text-rose-600 hover:underline break-all"> {j.link}</a>
                  </div>
                  <button
                    onClick={() => adicionarJulgadoDoProcesso(j)}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded-md cursor-pointer"
                  >
                    <Plus size={10} /> Guardar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {sugestoesJulgados && sugestoesJulgados.length === 0 && !erroJulgados && (
          <p className="text-xs text-slate-400 mb-2">Nenhum julgado aderente encontrado para este objeto.</p>
        )}

        {resultadoJulgados && (
          <div className="mb-3 space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Resultados ({resultadoJulgados.length}) — clique para adicionar ao processo:
            </p>
            {resultadoJulgados.length === 0 && <p className="text-xs text-slate-400">Nenhum julgado encontrado (TCU pode estar bloqueando por limite de consultas).</p>}
            {resultadoJulgados.map((j: any, i: number) => (
              <div key={i} className="rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">
                      {j.tribunal === "tcu" ? "TCU" : "TCE-RO"} — Acórdão {j.numero}
                      {j.relator && j.relator !== "—" ? <span className="font-normal text-slate-500"> · Rel. {j.relator}</span> : null}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{j.ementa.slice(0, 160)}</p>
                  </div>
                  <button
                    onClick={() => adicionarJulgadoDoProcesso(j)}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-rose-600 hover:bg-rose-700 px-2 py-1 rounded-md cursor-pointer"
                  >
                    <Plus size={10} /> Guardar
                  </button>
                </div>
                <a href={j.link} target="_blank" rel="noreferrer" className="text-[10px] text-rose-600 hover:underline break-all"> {j.link}</a>
              </div>
            ))}
          </div>
        )}

        {julgados.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Guardados no processo ({julgados.length}):</p>
            {julgados.map((j: any) => (
              <div key={j.id} className={`rounded-lg border px-3 py-2 ${j.usado ? "border-green-300 bg-green-50/50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800">
                      {j.tribunal === "tcu" ? "TCU" : "TCE-RO"} — Acórdão {j.numero}
                      {j.usado && <span className="ml-1.5 text-[9px] font-bold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">USADO NA JUSTIFICATIVA</span>}
                    </p>
                    {j.ementa && <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{j.ementa.slice(0, 140)}</p>}
                    {j.link && <a href={j.link} target="_blank" rel="noreferrer" className="text-[10px] text-rose-600 hover:underline break-all"> {j.link}</a>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={() => alternarUsado(j.id, !j.usado)}
                      className={`text-[10px] font-bold px-2 py-1 rounded-md cursor-pointer ${j.usado ? "bg-green-600 text-white" : "bg-slate-200 text-slate-600 hover:bg-slate-300"}`}
                    >
                      {j.usado ? " Em uso" : "Marcar em uso"}
                    </button>
                    <button onClick={() => removerJulgadoDoProcesso(j.id)} className="text-[10px] text-red-400 hover:text-red-600 cursor-pointer">remover</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modelos de documento (AGU) auto-preenchíveis */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={16} className="text-violet-600" />
          <h3 className="font-semibold text-slate-800 text-sm">Modelos de documento (AGU)</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          Escolha um modelo oficial (Lei 14.133/2021) — ele é <strong>auto-preenchido</strong> com o objeto, dotação, justificativa e os julgados marcados como em uso.
        </p>

        <select
          value={modeloSelecionado}
          onChange={(e) => setModeloSelecionado(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-violet-400 text-sm mb-3"
        >
          <option value="">Selecione um modelo…</option>
          {modelos.map((m: any) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </select>

        {modeloSelecionado && (
          <button
            onClick={preencherModelo}
            disabled={preenchendoModelo}
            className="ml-2 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-lg cursor-pointer"
          >
            {preenchendoModelo ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            Auto-preenchar com dados do processo
          </button>
        )}

        {conteudoModeloPreenchido && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-semibold text-violet-500 uppercase tracking-wide">
                Documento preenchido ({julgadosUsados} julgado(s) em uso incluídos)
              </p>
              <button
                onClick={salvarModeloComoMinuta}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg cursor-pointer"
              >
                <CheckCircle2 size={12} /> Salvar como minuta do processo
              </button>
            </div>
            <textarea
              value={conteudoModeloPreenchido}
              onChange={(e) => setConteudoModeloPreenchido(e.target.value)}
              rows={16}
              className="w-full font-mono text-[11px] leading-relaxed text-slate-700 border border-slate-200 rounded-xl p-3 focus:outline-none focus:border-violet-400"
            />
          </div>
        )}
      </div>

      {/* AGENTE REVISOR: valida o processo antes de publicar */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            <h3 className="font-semibold text-slate-800 text-sm">Agente Revisor — pronto para publicar?</h3>
          </div>
          <button
            onClick={revisarProcesso}
            disabled={revisando}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-lg cursor-pointer disabled:opacity-50"
          >
            {revisando ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            {revisando ? "Revisando o processo…" : revisaoIA ? "Revisar novamente" : "Revisar o processo completo"}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          O agente lê o processo inteiro (dados, tarefas, minutas, julgados) e aponta inconsistências, riscos jurídicos e o que falta antes de publicar — como um assessor revisando antes de assinar.
        </p>
        {revisaoIA && (
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {revisaoIA}
          </div>
        )}
      </div>

      {/* Histórico */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <History size={16} className="text-slate-500" />
          <h3 className="font-semibold text-slate-800 text-sm">Histórico completo</h3>
        </div>
        {historico.length === 0 ? (
          <p className="text-sm text-slate-400 py-2">Nenhuma ação registrada ainda.</p>
        ) : (
          <div className="space-y-2">
            {historico.map((h) => (
              <div key={h.id} className="flex items-start gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex flex-col items-center">
                  <CheckCircle2 size={14} className="text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-700">{h.descricao}</p>
                  <p className="text-xs text-slate-400">
                    {h.usuarioNome || "Sistema"} · {h.createdAt ? new Date(h.createdAt).toLocaleString("pt-BR") : ""} · {h.acao}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </main>
      </div>
    </div>
  );
}
