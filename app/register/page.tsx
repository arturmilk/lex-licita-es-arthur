"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    confirmarSenha: "",
    cargo: "",
    orgaoNome: "",
    orgaoCnpj: "",
    esfera: "federal",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.senha !== form.confirmarSenha) {
      setError("As senhas não coincidem");
      return;
    }
    if (form.senha.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          orgaoNome: form.orgaoNome,
          orgaoCnpj: form.orgaoCnpj || undefined,
          esfera: form.esfera,
          cargo: form.cargo || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao cadastrar");
      } else {
        router.push("/login?registered=1");
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const field = (
    label: string,
    key: keyof typeof form,
    type = "text",
    placeholder = ""
  ) => (
    <div>
      <label className="block text-sm font-medium text-neutral-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Estima.IA</h1>
              <p className="text-xs text-neutral-500">Cadastro de órgão público</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Dados pessoais</p>
            {field("Nome completo", "nome", "text", "Fulano de Tal")}
            {field("Email institucional", "email", "email", "fulano@orgao.gov.br")}
            {field("Cargo / Função", "cargo", "text", "Pregoeiro")}
            {field("Senha", "senha", "password", "Mínimo 8 caracteres")}
            {field("Confirmar senha", "confirmarSenha", "password", "")}

            <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider pt-2">Dados do órgão</p>
            {field("Nome do órgão", "orgaoNome", "text", "Ministério da Educação")}
            {field("CNPJ (opcional)", "orgaoCnpj", "text", "00.000.000/0000-00")}

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Esfera</label>
              <select
                value={form.esfera}
                onChange={(e) => setForm({ ...form, esfera: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="federal">Federal</option>
                <option value="estadual">Estadual</option>
                <option value="municipal">Municipal</option>
                <option value="distrital">Distrital</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
              {loading ? "Cadastrando..." : "Cadastrar órgão"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-neutral-500">
            Já tem conta?{" "}
            <a href="/login" className="text-neutral-900 font-medium hover:underline">
              Entrar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
