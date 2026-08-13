"use client";

import { useState } from "react";
import { ExternalLink, Paperclip, Trash2, Upload, FileText, Image, Table, Link as LinkIcon } from "lucide-react";

const TIPO_ICONE: Record<string, React.ElementType> = {
  pdf: FileText,
  xlsx: Table,
  imagem: Image,
  link: LinkIcon,
  print: Image,
  outro: Paperclip,
};

const TIPO_COR: Record<string, string> = {
  pdf: "bg-red-100 text-red-700",
  xlsx: "bg-green-100 text-green-700",
  imagem: "bg-blue-100 text-blue-700",
  link: "bg-purple-100 text-purple-700",
  print: "bg-yellow-100 text-yellow-700",
  outro: "bg-neutral-100 text-neutral-700",
};

interface Evidencia {
  id: string;
  nome: string;
  tipo: string;
  url: string;
  origem: string | null;
  tamanhoBytes: number | null;
  createdAt: Date;
  pesquisaId: string;
  processoNumero: string | null;
}

interface Props {
  links: Evidencia[];
  docs: Evidencia[];
}

export default function EvidenciasClient({ links: initialLinks, docs: initialDocs }: Props) {
  const [docs, setDocs] = useState(initialDocs);
  const [uploading, setUploading] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Remover esta evidência?")) return;
    await fetch(`/api/evidencias/${id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((e) => e.id !== id));
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Arquivo "${file.name}" enviado. Associe-o a uma pesquisa específica dentro do wizard.`);
    } catch (err) {
      alert("Erro no upload: " + err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-neutral-900">Evidências</h1>
        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${uploading ? "bg-neutral-300 text-neutral-500" : "bg-neutral-900 text-white hover:bg-neutral-800"}`}>
          <Upload className="w-4 h-4" />
          {uploading ? "Enviando..." : "Anexar arquivo"}
          <input type="file" className="hidden" onChange={handleUpload} disabled={uploading}
            accept=".pdf,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp" />
        </label>
      </div>

      {/* PNCP Links */}
      {initialLinks.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h2 className="font-semibold text-neutral-800 text-sm">Links das referências aceitas (PNCP)</h2>
          </div>
          <div className="divide-y divide-neutral-50">
            {initialLinks.map((e) => (
              <div key={e.id} className="flex items-center gap-4 px-6 py-3">
                <LinkIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800 truncate">{e.nome}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">Processo {e.processoNumero || "—"}</p>
                </div>
                <a href={e.url} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-800 transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All docs */}
      <div className="bg-white rounded-xl border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-800 text-sm">Todos os documentos ({docs.length})</h2>
        </div>
        {docs.length === 0 ? (
          <div className="px-6 py-12 text-center text-neutral-400 text-sm">
            Nenhum documento anexado ainda.
          </div>
        ) : (
          <div className="divide-y divide-neutral-50">
            {docs.map((e) => {
              const Icon = TIPO_ICONE[e.tipo] || Paperclip;
              return (
                <div key={e.id} className="flex items-center gap-4 px-6 py-3 hover:bg-neutral-50 transition-colors">
                  <Icon className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <a href={e.url} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-neutral-800 hover:underline truncate block">{e.nome}</a>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {e.processoNumero ? `Processo ${e.processoNumero}` : "—"} · {e.origem || "upload"} · {new Date(e.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${TIPO_COR[e.tipo] || "bg-neutral-100 text-neutral-600"}`}>
                    {e.tipo}
                  </span>
                  <button onClick={() => handleDelete(e.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
