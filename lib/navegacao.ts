import {
  Home, Plus, History, MessageCircle, Search, Scale, BarChart3, Paperclip,
  BookOpen, Users, LayoutDashboard, Settings,
} from "lucide-react";

/** `inclui`: outras rotas que "pertencem" ao item (acendem o item na barra lateral). */
export type ItemNav = { href: string; icon: React.ElementType; label: string; roles?: string[]; inclui?: string[] };
export type GrupoNav = { nome: string; roles?: string[]; itens: ItemNav[] };

/**
 * Navegação por intenção (não por módulo técnico) — fonte única para a barra
 * lateral, para a busca global e para a trilha ("onde estou") do topo.
 */
export const GRUPOS: GrupoNav[] = [
  {
    nome: "Meu trabalho",
    itens: [
      { href: "/painel", icon: Home, label: "Meu dia" },
      { href: "/pesquisa/nova", icon: Plus, label: "Nova pesquisa" },
      { href: "/historicos", icon: History, label: "Histórico", inclui: ["/processos", "/pesquisas"] },
    ],
  },
  {
    nome: "Assistente e consultas",
    itens: [
      { href: "/assistente", icon: MessageCircle, label: "Assistente" },
      { href: "/busca", icon: Search, label: "Busca" },
      { href: "/jurisprudencia", icon: Scale, label: "Jurisprudência" },
      { href: "/relatorios", icon: BarChart3, label: "Relatórios" },
      { href: "/evidencias", icon: Paperclip, label: "Evidências" },
      { href: "/procedimentos", icon: BookOpen, label: "Procedimentos" },
    ],
  },
  {
    nome: "Gestão",
    roles: ["gestor", "administrador"],
    itens: [
      { href: "/gestor", icon: Users, label: "Painel do gestor" },
      { href: "/dashboard", icon: LayoutDashboard, label: "Indicadores" },
    ],
  },
  {
    nome: "Administração",
    roles: ["administrador"],
    itens: [{ href: "/admin", icon: Settings, label: "Administração" }],
  },
];

export const PERFIL: Record<string, string> = {
  administrador: "Administrador",
  gestor: "Gestor",
  pesquisador: "Pesquisador",
};

/** Itens de navegação que o perfil pode acessar (achatados). */
export function itensDoPerfil(perfil: string) {
  return GRUPOS.flatMap((g) =>
    g.roles && !g.roles.includes(perfil)
      ? []
      : g.itens.filter((i) => !i.roles || i.roles.includes(perfil)).map((i) => ({ ...i, grupo: g.nome })),
  );
}

const dentro = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");

/** O item de navegação está ativo para esta rota? (match exato ou rota "filha"/incluída) */
export function itemAtivo(item: ItemNav, pathname: string) {
  if (pathname === item.href) return true;
  if (item.href === "/painel") return false;
  return dentro(pathname, item.href) || (item.inclui || []).some((r) => dentro(pathname, r));
}

/** Subpáginas que não estão no menu, mas precisam de nome na trilha do topo. */
const SUBPAGINAS: { teste: RegExp; rotulo: string }[] = [
  { teste: /^\/processos\/[^/]+\/jornada/, rotulo: "Processo" },
  { teste: /^\/processos$/, rotulo: "Processos" },
  { teste: /^\/pesquisas\/[^/]+/, rotulo: "Pesquisa" },
  { teste: /^\/pesquisas$/, rotulo: "Pesquisas" },
];

/** Trilha "Grupo › Página › Subpágina" da rota atual — orienta quem se perde nos menus. */
export function localizar(pathname: string): { grupo: string; pagina: string; href: string; sub?: string } | null {
  for (const g of GRUPOS) {
    for (const item of g.itens) {
      if (itemAtivo(item, pathname)) {
        const sub = pathname === item.href ? undefined : SUBPAGINAS.find((s) => s.teste.test(pathname))?.rotulo;
        return { grupo: g.nome, pagina: item.label, href: item.href, sub };
      }
    }
  }
  return null;
}
