"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import BuscaGlobal from "@/components/BuscaGlobal";
import { localizar } from "@/lib/navegacao";

/**
 * Barra superior (desktop): diz ONDE a pessoa está (grupo › página) e oferece a
 * busca. A marca e o usuário já estão na barra lateral — não se repetem aqui.
 */
export default function Topo({ perfil }: { perfil: string }) {
  const pathname = usePathname();
  const onde = localizar(pathname);

  return (
    <header className="hidden h-16 shrink-0 items-center gap-6 border-b border-slate-200 bg-white px-8 md:flex">
      <nav aria-label="Você está em" className="min-w-0 flex-1">
        {onde && (
          <ol className="flex min-w-0 items-center gap-2 text-sm">
            {onde.grupo !== onde.pagina && (
              <>
                <li className="hidden truncate text-slate-500 lg:block">{onde.grupo}</li>
                <li aria-hidden className="hidden text-slate-300 lg:block">
                  <ChevronRight size={14} />
                </li>
              </>
            )}
            {onde.sub ? (
              <>
                <li className="truncate">
                  <Link href={onde.href} className="text-slate-500 transition-colors hover:text-ink-900">
                    {onde.pagina}
                  </Link>
                </li>
                <li aria-hidden className="text-slate-300">
                  <ChevronRight size={14} />
                </li>
                <li aria-current="page" className="truncate font-semibold text-ink-950">{onde.sub}</li>
              </>
            ) : (
              <li aria-current="page" className="truncate font-semibold text-ink-950">{onde.pagina}</li>
            )}
          </ol>
        )}
      </nav>
      <div className="w-full max-w-sm">
        <BuscaGlobal perfil={perfil} />
      </div>
    </header>
  );
}
