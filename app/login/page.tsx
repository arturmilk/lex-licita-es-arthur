"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/painel";

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
      setError("E-mail ou senha inválidos. Confira e tente novamente.");
      setLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Painel institucional (desktop) */}
      <div className="relative hidden overflow-hidden bg-ink-900 p-12 lg:flex lg:w-1/2 lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-[0.08]" aria-hidden>
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold" />
          <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-gold" />
        </div>

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-white/20">
            <img src="/logo-lex.png" alt="" className="h-10 w-10 object-contain" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">LEX Licitações</span>
        </div>

        <div className="relative z-10">
          <h1 className="mb-4 text-4xl font-bold leading-tight text-white">
            Pesquisa de preços<br />para contratações<br />públicas
          </h1>
          <p className="max-w-sm text-base leading-relaxed text-gold">
            Organize a pesquisa de preços de mercado em um só lugar, com fontes oficiais e memória de cálculo pronta para o processo.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-6">
            {[
              { label: "Fontes oficiais", value: "3+" },
              { label: "Conformidade", value: "IN 65" },
              { label: "Relatórios", value: "PDF/XLSX" },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="mt-1 text-xs text-gold">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-gold/80">
          © {new Date().getFullYear()} LEX Licitações — um produto NOVAGENTE.
        </p>
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <img src="/logo-lex.png" alt="" className="h-9 w-9 object-contain" />
            <span className="text-lg font-bold text-ink-900">LEX Licitações</span>
          </div>

          <h2 className="mb-1 text-2xl font-bold text-slate-900">Entrar</h2>
          <p className="mb-8 text-sm text-slate-600">Use o e-mail e a senha do seu órgão.</p>

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-200 text-xs font-bold text-red-700">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="inp"
                placeholder="voce@orgao.gov.br"
              />
            </div>

            <div>
              <label htmlFor="senha" className="mb-1.5 block text-sm font-medium text-slate-700">
                Senha
              </label>
              <div className="relative">
                <input
                  id="senha"
                  type={showSenha ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={form.senha}
                  onChange={(e) => setForm({ ...form, senha: e.target.value })}
                  className="inp pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Entrando...
                </>
              ) : "Entrar"}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-600">
            Primeiro acesso?{" "}
            <a href="/register" className="font-medium text-ink-900 underline-offset-2 hover:underline">
              Cadastre seu órgão
            </a>
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
