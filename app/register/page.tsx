"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2, User, Building2, Eye, EyeOff } from "lucide-react";

function Field({
  label, value, onChange, type = "text", placeholder = "", required = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={isPassword && show ? "text" : type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition pr-10"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="w-6 h-6 rounded-md bg-indigo-50 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-indigo-600" />
      </div>
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    nome: "", email: "", senha: "", confirmarSenha: "",
    cargo: "", orgaoNome: "", orgaoCnpj: "", esfera: "federal",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (key: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.senha !== form.confirmarSenha) { setError("As senhas não coincidem"); return; }
    if (form.senha.length < 8) { setError("A senha deve ter no mínimo 8 caracteres"); return; }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome, email: form.email, senha: form.senha,
          orgaoNome: form.orgaoNome, orgaoCnpj: form.orgaoCnpj || undefined,
          esfera: form.esfera, cargo: form.cargo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Erro ao cadastrar");
      else router.push("/login?registered=1");
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-indigo-700 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">Estima.IA</span>
        </div>

        <div className="relative z-10">
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Cadastre seu órgão<br />e comece a pesquisar<br />preços com IA
          </h2>
          <p className="text-indigo-200 text-sm leading-relaxed max-w-xs">
            Crie sua conta gratuita e tenha acesso a pesquisas de preços automatizadas, relatórios e evidências conformes com a legislação.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Acesso às bases PNCP e Compras.gov.br",
              "Relatórios em PDF e XLSX prontos",
              "Conformidade com a IN SEGES 65/2021",
              "Histórico de pesquisas e evidências",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-indigo-100">
                <span className="mt-0.5 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-indigo-300 text-xs">
          © {new Date().getFullYear()} Estima.IA — Uso exclusivo de servidores públicos
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 bg-slate-50 flex items-start justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-md py-8">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-800 text-lg">Estima.IA</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mb-1">Criar conta</h1>
          <p className="text-sm text-slate-500 mb-8">Preencha os dados do responsável e do órgão</p>

          {error && (
            <div className="mb-5 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <span className="shrink-0 w-4 h-4 rounded-full bg-red-200 flex items-center justify-center text-red-600 text-xs font-bold">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <SectionTitle icon={User} label="Dados pessoais" />

            <Field label="Nome completo" value={form.nome} onChange={set("nome")} placeholder="Fulano de Tal" required />
            <Field label="Email institucional" value={form.email} onChange={set("email")} type="email" placeholder="fulano@orgao.gov.br" required />
            <Field label="Cargo / Função" value={form.cargo} onChange={set("cargo")} placeholder="Pregoeiro" />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Senha" value={form.senha} onChange={set("senha")} type="password" placeholder="Mín. 8 caracteres" required />
              <Field label="Confirmar senha" value={form.confirmarSenha} onChange={set("confirmarSenha")} type="password" placeholder="Repetir senha" required />
            </div>

            <SectionTitle icon={Building2} label="Dados do órgão" />

            <Field label="Nome do órgão" value={form.orgaoNome} onChange={set("orgaoNome")} placeholder="Ministério da Educação" required />
            <Field label="CNPJ (opcional)" value={form.orgaoCnpj} onChange={set("orgaoCnpj")} placeholder="00.000.000/0000-00" />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Esfera</label>
              <select
                value={form.esfera}
                onChange={(e) => set("esfera")(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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
              className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Cadastrando...</>
              ) : "Cadastrar órgão"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Já tem conta?{" "}
            <a href="/login" className="text-indigo-600 font-medium hover:text-indigo-800 transition-colors">
              Entrar
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
