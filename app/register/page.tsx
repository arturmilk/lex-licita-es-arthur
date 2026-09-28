"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, User, Building2, Eye, EyeOff } from "lucide-react";
import { PainelInstitucional } from "@/components/PainelInstitucional";

function Field({
  label, value, onChange, type = "text", placeholder = "", required = false, autoComplete,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  const isPassword = type === "password";
  return (
    <div>
      <label htmlFor={id} className="rotulo">
        {label} {required && <span className="text-red-600" aria-hidden>*</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={`inp ${isPassword ? "pr-12" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-200 pb-2 pt-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-ink-50 text-ink-700" aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-sm font-semibold text-ink-950">{label}</h2>
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
    if (form.senha !== form.confirmarSenha) { setError("As senhas não coincidem. Digite a mesma senha nos dois campos."); return; }
    if (form.senha.length < 8) { setError("A senha precisa ter pelo menos 8 caracteres."); return; }

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
      if (!res.ok) setError(data.error || "Não foi possível concluir o cadastro. Confira os dados e tente de novo.");
      else router.push("/login?registered=1");
    } catch {
      setError("Sem conexão com o servidor. Verifique a internet e tente de novo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <PainelInstitucional
        titulo="Cadastre seu órgão e comece a pesquisar preços."
        texto="Crie a conta do responsável e tenha pesquisas, relatórios e evidências organizados conforme a legislação."
      />

      <main className="flex flex-1 items-start justify-center overflow-y-auto bg-canvas p-6 sm:p-10">
        <div className="w-full max-w-md py-4 sm:py-8">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-card ring-1 ring-slate-200">
              <img src="/logo-lex.png" alt="" className="h-8 w-8 object-contain" />
            </span>
            <span className="text-lg font-semibold tracking-[-0.01em] text-ink-950">LEX Licitações</span>
          </div>

          <h1 className="text-[1.75rem] font-semibold tracking-[-0.022em] text-ink-950">Criar conta</h1>
          <p className="mt-1.5 text-[15px] text-slate-600">Preencha os dados do responsável e do órgão.</p>

          {error && (
            <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <span aria-hidden className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-200 text-[11px] font-bold text-red-800">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <SectionTitle icon={User} label="Dados do responsável" />

            <Field label="Nome completo" value={form.nome} onChange={set("nome")} placeholder="Nome e sobrenome" required autoComplete="name" />
            <Field label="E-mail institucional" value={form.email} onChange={set("email")} type="email" placeholder="nome@orgao.gov.br" required autoComplete="email" />
            <Field label="Cargo ou função" value={form.cargo} onChange={set("cargo")} placeholder="Ex.: Pregoeiro" autoComplete="organization-title" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Senha" value={form.senha} onChange={set("senha")} type="password" placeholder="Mín. 8 caracteres" required autoComplete="new-password" />
              <Field label="Confirmar senha" value={form.confirmarSenha} onChange={set("confirmarSenha")} type="password" placeholder="Repita a senha" required autoComplete="new-password" />
            </div>

            <SectionTitle icon={Building2} label="Dados do órgão" />

            <Field label="Nome do órgão" value={form.orgaoNome} onChange={set("orgaoNome")} placeholder="Ex.: Secretaria Municipal de Administração" required autoComplete="organization" />
            <Field label="CNPJ (opcional)" value={form.orgaoCnpj} onChange={set("orgaoCnpj")} placeholder="00.000.000/0000-00" />

            <div>
              <label htmlFor="esfera" className="rotulo">Esfera</label>
              <select id="esfera" value={form.esfera} onChange={(e) => set("esfera")(e.target.value)} className="inp">
                <option value="federal">Federal</option>
                <option value="estadual">Estadual</option>
                <option value="municipal">Municipal</option>
                <option value="distrital">Distrital</option>
              </select>
            </div>

            <button type="submit" disabled={loading} className="btn btn-primary mt-2 w-full">
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Cadastrando...</>
              ) : "Cadastrar órgão"}
            </button>
          </form>

          <p className="mt-8 border-t border-slate-200 pt-6 text-center text-sm text-slate-600">
            Já tem conta?{" "}
            <a href="/login" className="link">
              Entrar
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
