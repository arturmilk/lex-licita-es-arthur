"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/Pagina";
import {
  ArrowRight,
  Boxes,
  BriefcaseBusiness,
  ClipboardCheck,
  FileSearch,
  Gavel,
  Handshake,
  Lightbulb,
  ListChecks,
  MessageCircle,
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

  // O detalhe abre abaixo da grade: leva a pessoa até ele (no celular ficaria fora da tela)
  useEffect(() => {
    if (selecionado) document.getElementById("detalhe-modo")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selecionado]);

  return (
    <div>
      <CabecalhoPagina
        sobretitulo="Central de procedimentos"
        titulo="De onde você quer começar?"
        descricao="Escolha o momento da contratação. O LEX mostra o caminho, as peças necessárias e abre o trabalho a partir dali."
      />

      {/* As 7 etapas são uma sequência real da contratação — por isso a numeração */}
      <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {MODOS.map((m) => {
          const Icon = m.icone;
          const ativo = selecionado === m.id;
          return (
            <li
              key={m.id}
              className={`group flex flex-col rounded-xl border p-5 transition-[border-color,box-shadow,background-color] duration-200 ${
                ativo
                  ? "border-ink-900 bg-ink-900 text-white shadow-raise"
                  : "border-slate-200 bg-white shadow-card hover:border-ink-200 hover:shadow-raise"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${ativo ? "bg-white/10 text-gold-400" : "bg-ink-50 text-ink-800"}`} aria-hidden>
                  <Icon size={21} />
                </span>
                <span className={`font-mono text-[13px] font-medium ${ativo ? "text-white/60" : "text-slate-500"}`}>
                  <span className="sr-only">Etapa </span>{m.numero}
                </span>
              </div>
              <h2 className={`mt-5 text-base font-semibold ${ativo ? "text-white" : "text-ink-950"}`}>{m.titulo}</h2>
              <p className={`mt-1.5 text-sm leading-relaxed ${ativo ? "text-white/70" : "text-slate-600"}`}>{m.resumo}</p>
              <div className="mt-auto flex items-center gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => setSelecionado(ativo ? null : m.id)}
                  aria-expanded={ativo}
                  aria-controls="detalhe-modo"
                  className={`btn btn-sm min-h-[44px] ${ativo ? "bg-white/10 text-white hover:bg-white/15" : "btn-outline"}`}
                >
                  {ativo ? "Ocultar etapas" : "Ver etapas"}
                </button>
                <Link
                  href={m.href}
                  className={`btn btn-sm min-h-[44px] ${ativo ? "bg-gold-500 text-ink-950 hover:bg-gold-400" : "btn-primary"}`}
                >
                  Começar <ArrowRight size={14} aria-hidden />
                </Link>
              </div>
            </li>
          );
        })}
        <li className="flex flex-col justify-between rounded-xl border border-dashed border-slate-300 p-5">
          <div>
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white text-ink-800 ring-1 ring-slate-200" aria-hidden>
              <MessageCircle size={20} />
            </span>
            <p className="mt-5 text-base font-semibold text-ink-950">Não sabe em qual etapa está?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">Conte a situação ao assistente e ele indica por onde seguir.</p>
          </div>
          <Link href="/assistente" className="btn btn-outline btn-sm mt-5 min-h-[44px] self-start">
            Perguntar ao assistente <ArrowRight size={14} aria-hidden />
          </Link>
        </li>
      </ol>

      {modo && (
        <section id="detalhe-modo" aria-labelledby="detalhe-modo-titulo" className="card mt-6 scroll-mt-6 animate-entrar overflow-hidden">
          <div className="grid gap-6 p-6 md:grid-cols-[1fr_16rem] md:items-start md:p-8">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <span className="icon-tile" aria-hidden>
                  <modo.icone size={19} />
                </span>
                <div>
                  <p className="font-mono text-xs font-medium text-slate-500">Etapa {modo.numero}</p>
                  <h2 id="detalhe-modo-titulo" className="text-xl font-semibold tracking-[-0.015em] text-ink-950">{modo.titulo}</h2>
                </div>
              </div>

              <ol className="grid gap-2.5 sm:grid-cols-2">
                {modo.procedimentos.map((p, i) => (
                  <li key={p} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-4 py-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white font-mono text-[11px] font-medium text-ink-800">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed text-slate-700">{p}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl bg-ink-50 p-5 md:sticky md:top-6">
              <p className="text-sm font-semibold text-ink-950">Começar neste ponto</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">
                O LEX abre o ambiente certo e mantém esta etapa como contexto do trabalho.
              </p>
              <Link href={modo.href} className="btn btn-primary mt-4 w-full">
                Começar daqui <ArrowRight size={15} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
