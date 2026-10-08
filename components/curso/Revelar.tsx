"use client";

import { useEffect } from "react";

/**
 * Revela ao rolar: elementos com `data-revelar` que estão abaixo da tela ganham `data-oculto`
 * (escondidos pelo CSS) e perdem o atributo quando entram na tela. O que já está à vista na
 * carga não pisca, e sem JavaScript tudo aparece normalmente.
 */
export function Revelar() {
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          if (!e.isIntersecting) continue;
          e.target.removeAttribute("data-oculto");
          obs.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    const limite = window.innerHeight * 0.9;
    document.querySelectorAll<HTMLElement>("[data-revelar]").forEach((el) => {
      if (el.getBoundingClientRect().top < limite) return;
      el.setAttribute("data-oculto", "");
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  return null;
}
