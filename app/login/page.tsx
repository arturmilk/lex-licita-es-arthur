"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { PainelInstitucional } from "@/components/PainelInstitucional";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/painel";
  const cadastrado = searchParams.get("registered") === "1";

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
    <div className="flex min-h-screen">
      <PainelInstitucional />

      {/* Formulário */}
      <main className="flex flex-1 flex-col bg-canvas">
        <div className="flex flex-1 items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-[400px]">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-card ring-1 ring-slate-200">
                <img src="/logo-lex.png" alt="" className="h-8 w-8 object-contain" />
              </span>
              <span className="text-lg font-semibold tracking-[-0.01em] text-ink-950">LEX Licitações</span>
            </div>

            <h1 className="text-[1.75rem] font-semibold tracking-[-0.022em] text-ink-950">Entrar</h1>
            <p className="mt-1.5 text-[15px] text-slate-600">Use o e-mail e a senha do seu órgão.</p>

            {cadastrado && !error && (
              <div role="status" className="mt-6 flex items-start gap-2.5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
                Cadastro concluído. Entre com o e-mail e a senha que você criou.
              </div>
            )}

            {error && (
              <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-200 text-[11px] font-bold text-red-800">!</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="rotulo">E-mail</label>
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
                <label htmlFor="senha" className="rotulo">Senha</label>
                <div className="relative">
                  <input
                    id="senha"
                    type={showSenha ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={form.senha}
                    onChange={(e) => setForm({ ...form, senha: e.target.value })}
                    className="inp pr-12"
                    placeholder="Sua senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    aria-label={showSenha ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
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

            <p className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
              Primeiro acesso?{" "}
              <a href="/register" className="link">
                Cadastre seu órgão
              </a>
            </p>
          </div>
        </div>
        <p className="px-6 pb-6 text-center text-xs text-slate-500 lg:hidden">
          © {new Date().getFullYear()} LEX Licitações — um produto NOVAGENTE.
        </p>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <LoginForm />
    </Suspense>
  );
}
