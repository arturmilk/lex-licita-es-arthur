"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/pesquisa/nova";

  const [form, setForm] = useState({ email: "", senha: "" });
  const [showSenha, setShowSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email: form.email,
      password: form.senha,
      redirect: false,
    });

    if (result?.error) {
      setError("Email ou senha inválidos");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#032650] flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A227] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#C9A227] rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src="/logo-lex.png" alt="LEX Licitações" className="w-11 h-11 object-contain" />
          <span className="text-white font-bold text-xl tracking-tight">LEX Licitações</span>
        </div>

        {/* Main content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-bold text-white leading-tight mb-4">
            Pesquisa de preços<br />inteligente para<br />licitações públicas
          </h2>
          <p className="text-[#C9A227] text-base leading-relaxed max-w-sm">
            Automatize a pesquisa de preços de mercado com IA, em conformidade com a IN SEGES 65/2021.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { label: "Fontes integradas", value: "3+" },
              { label: "Conformidade", value: "IN 65" },
              { label: "Relatórios", value: "PDF/XLSX" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-[#C9A227] text-xs mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-[#C9A227]/80 text-xs">
          © {new Date().getFullYear()} LEX Licitações — Uso exclusivo de servidores públicos
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src="/logo-lex.png" alt="LEX Licitações" className="w-9 h-9 object-contain" />
            <span className="font-bold text-slate-800 text-lg">LEX Licitações</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mb-1">Bem-vindo de volta</h1>
          <p className="text-sm text-slate-500 mb-8">Entre com suas credenciais para continuar</p>

          {error && (
            <div className="mb-5 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <span className="shrink-0 w-4 h-4 rounded-full bg-red-200 flex items-center justify-center text-red-600 text-xs font-bold">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Email institucional
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent transition"
                placeholder="seu@orgao.gov.br"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700">Senha</label>
              </div>
              <div className="relative">
                <input
                  type={showSenha ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  className="w-full px-4 py-2.5 pr-11 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#C9A227] focus:border-transparent transition"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#032650] text-white rounded-lg text-sm font-semibold hover:bg-[#042f5e] active:bg-[#032650] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Entrando...
                </>
              ) : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              Primeiro acesso?{" "}
              <a href="/register" className="text-[#032650] font-medium hover:text-[#042f5e] transition-colors">
                Cadastre seu órgão
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginForm />
    </Suspense>
  );
}
