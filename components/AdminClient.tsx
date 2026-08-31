"use client";

import { useState } from "react";
import { Plus, Copy, Key, Trash2, UserCheck, UserX } from "lucide-react";

const PERFIL_COR: Record<string, string> = {
  administrador: "bg-purple-100 text-purple-700",
  gestor: "bg-blue-100 text-blue-700",
  pesquisador: "bg-neutral-100 text-neutral-600",
};

interface Props {
  usuarios: any[];
  config: any;
  apiKeys: any[];
  orgaoId: string;
}

export default function AdminClient({ usuarios: initialUsuarios, config: initialConfig, apiKeys: initialKeys, orgaoId }: Props) {
  const [usuarios, setUsuarios] = useState(initialUsuarios);
  const [config, setConfig] = useState(initialConfig);
  const [apiKeys, setApiKeys] = useState(initialKeys);
  const [savingConfig, setSavingConfig] = useState(false);
  const [novoUsuario, setNovoUsuario] = useState(false);
  const [formUser, setFormUser] = useState({ nome: "", email: "", senha: "", perfil: "pesquisador", cargo: "" });
  const [novaKey, setNovaKey] = useState(false);
  const [nomeKey, setNomeKey] = useState("");

  async function salvarConfig() {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/admin/configuracoes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      alert("Configurações salvas!");
    } catch (err) {
      alert("Erro: " + err);
    } finally {
      setSavingConfig(false);
    }
  }

  async function criarUsuario() {
    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formUser),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro");
      setUsuarios((prev) => [...prev, { ...data, ativo: true, createdAt: new Date() }]);
      setNovoUsuario(false);
      setFormUser({ nome: "", email: "", senha: "", perfil: "pesquisador", cargo: "" });
    } catch (err) {
      alert("Erro: " + err);
    }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch(`/api/admin/usuarios/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !ativo }),
    });
    setUsuarios((prev) => prev.map((u) => u.id === id ? { ...u, ativo: !ativo } : u));
  }

  async function gerarApiKey() {
    if (!nomeKey) return alert("Informe um nome para a chave");
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nomeKey }),
    });
    const data = await res.json();
    setApiKeys((prev) => [...prev, data]);
    setNomeKey("");
    setNovaKey(false);
  }

  async function revogarKey(id: string) {
    if (!confirm("Revogar esta chave?")) return;
    await fetch("/api/admin/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setApiKeys((prev) => prev.map((k) => k.id === id ? { ...k, ativo: false } : k));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Administração</h1>

      {/* Usuarios */}
      <div className="bg-white rounded-xl border border-neutral-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-800">Usuários do órgão</h2>
          <button onClick={() => setNovoUsuario(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Novo usuário
          </button>
        </div>

        {novoUsuario && (
          <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100 grid grid-cols-2 gap-3">
            <input placeholder="Nome completo" value={formUser.nome} onChange={(e) => setFormUser({ ...formUser, nome: e.target.value })}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            <input placeholder="Email" type="email" value={formUser.email} onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            <input placeholder="Senha (mín. 8 chars)" type="password" value={formUser.senha} onChange={(e) => setFormUser({ ...formUser, senha: e.target.value })}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            <input placeholder="Cargo (opcional)" value={formUser.cargo} onChange={(e) => setFormUser({ ...formUser, cargo: e.target.value })}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            <select value={formUser.perfil} onChange={(e) => setFormUser({ ...formUser, perfil: e.target.value })}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
              <option value="pesquisador">Pesquisador</option>
              <option value="gestor">Gestor</option>
              <option value="administrador">Administrador</option>
            </select>
            <div className="flex gap-2">
              <button onClick={criarUsuario} className="flex-1 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors">Criar</button>
              <button onClick={() => setNovoUsuario(false)} className="px-4 py-2 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50 transition-colors">Cancelar</button>
            </div>
          </div>
        )}

        <div className="divide-y divide-neutral-50">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center gap-4 px-6 py-3 hover:bg-neutral-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800">{u.nome}</p>
                <p className="text-xs text-neutral-400">{u.email}{u.cargo ? ` · ${u.cargo}` : ""}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${PERFIL_COR[u.perfil] || "bg-neutral-100"}`}>{u.perfil}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.ativo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                {u.ativo ? "ativo" : "inativo"}
              </span>
              <button onClick={() => toggleAtivo(u.id, u.ativo)} className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-800 transition-colors">
                {u.ativo ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Config */}
      <div className="bg-white rounded-xl border border-neutral-200">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-800">Configurações do sistema</h2>
        </div>
        <div className="px-6 py-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Similaridade mínima (%)</label>
            <input type="number" min="0" max="100" value={config.similaridadeMinima}
              onChange={(e) => setConfig({ ...config, similaridadeMinima: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">CV — alerta (%)</label>
            <input type="number" min="0" max="100" value={config.cvAlerta}
              onChange={(e) => setConfig({ ...config, cvAlerta: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Período padrão</label>
            <select value={config.periodoPadrao} onChange={(e) => setConfig({ ...config, periodoPadrao: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
              <option value="6_meses">6 meses</option>
              <option value="12_meses">12 meses</option>
              <option value="24_meses">24 meses</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Método padrão</label>
            <select value={config.metodoPadrao} onChange={(e) => setConfig({ ...config, metodoPadrao: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
              <option value="media_aritmetica">Média aritmética</option>
              <option value="mediana">Mediana</option>
              <option value="media_ponderada">Média ponderada</option>
              <option value="menor_preco">Menor preço</option>
            </select>
          </div>
        </div>
        <div className="px-6 pb-4">
          <button onClick={salvarConfig} disabled={savingConfig}
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors">
            {savingConfig ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-white rounded-xl border border-neutral-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="font-semibold text-neutral-800">Chaves de API (Agentes)</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Use para integrar agentes externos ao LEX Licitações</p>
          </div>
          <button onClick={() => setNovaKey(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-800 transition-colors">
            <Key className="w-3.5 h-3.5" /> Nova chave
          </button>
        </div>
        {novaKey && (
          <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-100 flex gap-3">
            <input placeholder="Nome da chave (ex: Agente PNCP)" value={nomeKey} onChange={(e) => setNomeKey(e.target.value)}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            <button onClick={gerarApiKey} className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors">Gerar</button>
            <button onClick={() => setNovaKey(false)} className="px-4 py-2 border border-neutral-300 rounded-lg text-sm hover:bg-neutral-50 transition-colors">Cancelar</button>
          </div>
        )}
        <div className="divide-y divide-neutral-50">
          {apiKeys.length === 0 && (
            <p className="px-6 py-8 text-sm text-neutral-400 text-center">Nenhuma chave criada ainda.</p>
          )}
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center gap-4 px-6 py-3">
              <Key className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-800">{k.nome}</p>
                <code className="text-xs text-neutral-400 font-mono truncate block">{k.chave}</code>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${k.ativo ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
                {k.ativo ? "ativa" : "revogada"}
              </span>
              {k.ativo && (
                <>
                  <button onClick={() => navigator.clipboard.writeText(k.chave)}
                    className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-400 hover:text-neutral-800 transition-colors">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => revogarKey(k.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-neutral-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
