"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Search } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "rascunho", label: "Rascunho" },
  { value: "pesquisando", label: "Pesquisando" },
  { value: "estimado", label: "Estimado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

export default function ProcessosBusca({ initialBusca = "", initialStatus = "todos" }: { initialBusca?: string; initialStatus?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "todos") params.set(key, value);
    else params.delete(key);
    router.push(`/processos?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Buscar por número ou objeto..."
          defaultValue={initialBusca}
          onChange={(e) => update("busca", e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </div>
      <select
        defaultValue={initialStatus || "todos"}
        onChange={(e) => update("status", e.target.value)}
        className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
