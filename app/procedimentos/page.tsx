"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  Boxes,
  BriefcaseBusiness,
  ClipboardCheck,
  FileSearch,
  Gavel,
  Handshake,
  Lightbulb,
  ListChecks,
  SearchCheck,
} from "lucide-react";

const MODOS = [
  {
    id: "necessidade",
    numero: "01",
    titulo: "Descobrir a necessidade",
    resumo: "Comece pelo problema, mesmo sem saber o que contratar.",
    icone: Lightbulb,
    href: "/assistente?modo=necessidade",
    procedimentos: [
      "Identificar o problema ou necessidade do setor",
      "Entender quem será atendido e qual resultado é esperado",
      "Definir urgência, prioridade e contexto da demanda",
      "Levantar informações iniciais e documentos já existentes",
      "Iniciar DFD / Requisição de Compra",
    ],
  },
  {
    id: "planejamento",
    numero: "02",
    titulo: "Planejar a contratação",
    resumo: "Transforme a necessidade em uma solução tecnicamente planejada.",
    icone: ListChecks,
    href: "/assistente?modo=planejamento",
    procedimentos: [
      "Revisar e completar DFD / Requisição",
      "Elaborar o Estudo Técnico Preliminar (ETP)",
      "Consultar contratações anteriores semelhantes",
      "Levantar alternativas possíveis para resolver a necessidade",
      "Identificar riscos e medidas de tratamento",
      "Justificar a solução escolhida",
    ],
  },
  {
    id: "objeto",
    numero: "03",
    titulo: "Definir o objeto",
    resumo: "Descreva exatamente o que o mercado deverá entregar.",
    icone: Boxes,
    href: "/assistente?modo=objeto",
    procedimentos: [
      "Definir especificações técnicas",
      "Calcular e justificar quantitativos",
      "Definir unidade de medida e parcelamento",
      "Definir prazos, locais e forma de execução",
      "Estabelecer requisitos da contratada e critérios de medição",
      "Elaborar Termo de Referência / Projeto aplicável",
    ],
  },
  {
    id: "pesquisa",
    numero: "04",
    titulo: "Pesquisa de preços",
    resumo: "Encontre referências, trate os dados e forme o valor estimado.",
    icone: SearchCheck,
    href: "/assistente?modo=pesquisa",
    procedimentos: [
      "Definir parâmetros e período da pesquisa",
      "Consultar PNCP e outras fontes admitidas",
      "Registrar cotações, contratos, atas, notas e evidências",
      "Comparar objetos e validar similaridade",
      "Tratar outliers e justificar exclusões",
      "Calcular valor estimado e gerar memória de cálculo",
      "Montar relatório da pesquisa de preços",
    ],
  },
  {
    id: "preparacao",
    numero: "05",
    titulo: "Preparar a licitação",
    resumo: "Organize as peças necessárias antes da publicação do edital.",
    icone: FileSearch,
    href: "/assistente?modo=preparacao",
    procedimentos: [
      "Confirmar adequação orçamentária",
      "Definir modalidade, critério e modo de disputa",
      "Revisar TR / Projeto e documentos técnicos",
      "Elaborar edital e anexos",
      "Elaborar minuta do contrato ou ata",
      "Submeter ao controle jurídico e tratar apontamentos",
      "Autorizar e publicar o edital",
    ],
  },
  {
    id: "selecao",
    numero: "06",
    titulo: "Selecionar o fornecedor",
    resumo: "Acompanhe a disputa até a escolha e homologação do vencedor.",
    icone: Gavel,
    href: "/assistente?modo=selecao",
    procedimentos: [
      "Receber propostas e lances",
      "Analisar e julgar as propostas",
      "Negociar quando cabível",
      "Verificar habilitação",
      "Realizar diligências e saneamentos permitidos",
      "Tratar recursos e contrarrazões",
      "Adjudicar e homologar o resultado",
    ],
  },
  {
    id: "contrato",
    numero: "07",
    titulo: "Contrato e execução",
    resumo: "Da convocação do vencedor até o encerramento da contratação.",
    icone: Handshake,
    href: "/assistente?modo=contrato",
    procedimentos: [
      "Convocar o vencedor e conferir condições finais",
      "Formalizar contrato, ata ou instrumento substitutivo",
      "Publicar no PNCP quando aplicável",
      "Emitir ordem de serviço / fornecimento",
      "Designar gestão e fiscalização",
      "Acompanhar execução, ocorrências, medições e alterações",
      "Receber o objeto, liquidar, pagar e encerrar o processo",
    ],
  },
];

export default function ProcedimentosPage() {
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const modo = MODOS.find((m) => m.id === selecionado);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#d5dce8] bg-white px-3 py-1.5 text-xs font-semibold text-[#032650] shadow-sm mb-3">
          <BookOpenCheck size={14} /> Central de Procedimentos
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">De onde você quer começar?</h1>
        <p className="text-sm md:text-base text-slate-500 mt-2 max-w-2xl">
          Escolha o momento da contratação. O LEX mostra o caminho, as peças necessárias e permite começar a trabalhar a partir dali.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {MODOS.map((m) => {
          const Icon = m.icone;
          const ativo = selecionado === m.id;
          return (
            <div
              key={m.id}
              className={`group text-left rounded-2xl border p-5 min-h-[220px] flex flex-col transition-all ${
                ativo
                  ? "border-[#032650] bg-[#032650] text-white shadow-lg -translate-y-0.5"
                  : "border-slate-200 bg-white hover:border-[#b8c5d6] hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${ativo ? "bg-white/12" : "bg-[#eef2f8]"}`}>
                  <Icon size={21} className={ativo ? "text-white" : "text-[#032650]"} />
                </div>
                <span className={`text-xs font-bold tracking-widest ${ativo ? "text-white/50" : "text-slate-300"}`}>MODO {m.numero}</span>
              </div>
              <div className="mt-auto pt-6">
                <h2 className={`text-base font-bold ${ativo ? "text-white" : "text-slate-800"}`}>{m.titulo}</h2>
                <p className={`text-sm mt-1.5 leading-relaxed ${ativo ? "text-white/65" : "text-slate-500"}`}>{m.resumo}</p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => setSelecionado(ativo ? null : m.id)}
                    className={`inline-flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      ativo ? "bg-white/10 text-white hover:bg-white/15" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {ativo ? "Ocultar etapas" : "Ver etapas"}
                  </button>
                  <Link
                    href={m.href}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      ativo ? "bg-[#C9A227] text-[#032650] hover:bg-[#d8b536]" : "bg-[#032650] text-white hover:bg-[#042f5e]"
                    }`}
                  >
                    Começar <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modo && (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6 md:p-8 grid md:grid-cols-[1fr_auto] gap-6 md:items-start">
            <div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-[#eef2f8] flex items-center justify-center">
                  <modo.icone size={19} className="text-[#032650]" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Modo {modo.numero}</p>
                  <h2 className="text-xl font-bold text-slate-900">{modo.titulo}</h2>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2.5">
                {modo.procedimentos.map((p, i) => (
                  <div key={p} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <span className="w-6 h-6 rounded-full bg-white border border-slate-200 text-[#032650] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-slate-700 leading-relaxed">{p}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="md:w-56 rounded-2xl bg-[#eef2f8] p-4 md:sticky md:top-6">
              <p className="text-xs font-bold text-[#032650] uppercase tracking-wide">Começar neste ponto</p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                O LEX abre o ambiente certo e mantém este modo como contexto do trabalho.
              </p>
              <Link
                href={modo.href}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#032650] px-4 py-3 text-sm font-semibold text-white hover:bg-[#042f5e] shadow-sm hover:shadow-md transition-all"
              >
                Começar daqui <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
