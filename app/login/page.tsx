"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Layers, Mail, Lock, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@estima.ia");
  const [password, setPassword] = useState("demo123");
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { router.push("/dashboard"); }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-neutral-900 text-white mb-4">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-medium">Estima.IA</h1>
          <p className="text-sm text-neutral-500 mt-1">Pesquisa e formacao de precos publicos</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-8 shadow-sm">
          <h2 className="text-base font-medium mb-6">Entrar na plataforma</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type="email" required className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <input type="password" required className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:border-neutral-400" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-neutral-900 text-white text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrar"}
            </button>
          </form>
          <div className="mt-6 pt-4 border-t border-neutral-100 text-center">
            <p className="text-xs text-neutral-400">Ambiente de demonstracao local</p>
            <p className="text-xs text-neutral-400 mt-1">Use qualquer e-mail e senha</p>
          </div>
        </div>
      </div>
    </div>
  );
}
