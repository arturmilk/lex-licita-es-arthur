# Estima.IA + OpenClaw — Guia de Integracao Completo

## Visao Geral

Este guia conecta a **Estima.IA** (Next.js + Supabase) ao **OpenClaw** (gateway auto-hospedado de agentes AI). O OpenClaw roda localmente (ou em um VPS) e executa 4 agentes especializados que usam IA para interpretar objetos, comparar similaridade, redigir justificativas e validar regras.

> **Principio:** A IA (OpenClaw) interpreta linguagem, semantica e redige. O Next.js calcula, valida deterministicamente e persiste.

---

## Arquitetura

```
Usuario -> Estima.IA (Next.js) -> OpenClaw Gateway (localhost:18789)
              |                        |
              v                        v
         Supabase (dados)      Agentes AI (4 skills)
                                    |
                                    v
                              ClawHub (skills)
```

---

## Passo 1: Instalar o OpenClaw

### Requisitos
- Node.js 18+
- Docker (opcional, mas recomendado)
- Conta em provedor de LLM (Anthropic, OpenAI, ou local via Ollama)

### Instalacao

```bash
# 1. Instale o OpenClaw globalmente
npm install -g openclaw

# 2. Inicialize o workspace
openclaw init

# 3. Configure as credenciais de LLM
openclaw auth add anthropic
# ou
openclaw auth add openai

# 4. Copie as skills da Estima.IA
cp -r openclaw-skills/extrator ~/.openclaw/workspace/skills/
cp -r openclaw-skills/similaridade ~/.openclaw/workspace/skills/
cp -r openclaw-skills/justificador ~/.openclaw/workspace/skills/
cp -r openclaw-skills/validador ~/.openclaw/workspace/skills/

# 5. Copie a configuracao multi-agente
cp openclaw-config/openclaw.json ~/.openclaw/openclaw.json

# 6. Inicie o gateway
openclaw gateway start
```

O Gateway estara disponivel em `http://localhost:18789`.

---

## Passo 2: Configurar a Estima.IA para usar o OpenClaw

### Variaveis de ambiente (.env.local)

```env
# OpenClaw Gateway
OPENCLAW_URL=http://localhost:18789
OPENCLAW_TOKEN=your-secret-token-from-openclaw-config

# Supabase (ja configurado)
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### Instalar o cliente OpenClaw

O arquivo `lib/openclaw-client.ts` ja esta pronto no projeto. Ele fornece 4 funcoes:

```typescript
import {
  extrairCaracteristicas,
  calcularSimilaridade,
  gerarJustificativa,
  validarPesquisa,
  healthCheck
} from "@/lib/openclaw-client";
```

---

## Passo 3: Integrar no Wizard (substituir simulacoes)

### Passo 4 — Extracao de caracteristicas (IA)

Substitua a simulacao por:

```typescript
// app/pesquisa/nova/page.tsx — Passo 4
const extrairIA = async () => {
  setIaLoading(true);
  try {
    const resultado = await extrairCaracteristicas(objetoDesc, especificacao);
    setCaracteristicasIA(resultado.caracteristicas || []);
    nextStep();
  } catch (err) {
    console.error("Erro no agente extrator:", err);
    // Fallback para modo offline
    setCaracteristicasIA([/* mock */]);
  } finally {
    setIaLoading(false);
  }
};
```

### Passo 8 — Similaridade nos resultados PNCP

Substitua a simulacao por:

```typescript
// Apos buscar resultados do PNCP
const resultadosComSimilaridade = await Promise.all(
  resultadosBrutos.map(async (r) => {
    const sim = await calcularSimilaridade(objetoDesc, especificacao, {
      descricao: r.descricao,
      orgao: r.orgao,
      localizacao: r.localizacao,
    });
    return { ...r, similaridade: sim.similaridade };
  })
);
setResultados(resultadosComSimilaridade);
```

### Passo 11 — Justificativa do preco estimado

Substitua a simulacao por:

```typescript
const justificativa = await gerarJustificativa(
  estatisticas,
  config.metodo,
  quantidade,
  estatisticas.n
);
setJustificativaTexto(justificativa.justificativa);
```

### Validacao automatica

```typescript
const validacao = await validarPesquisa({
  n: estatisticas.n,
  cv: estatisticas.coeficienteVariacao,
  min_referencias: config.qtdMin,
  cv_limite: 25,
  similaridade_minima: 75,
  menor_similaridade_aceita: Math.min(...resultadosAceitos.map(r => r.similaridade)),
});

if (!validacao.valido) {
  // Mostra alertas no wizard
  setAlertasValidacao(validacao.alertas);
}
```

---

## Passo 4: Testar a integracao

### 1. Verifique se o OpenClaw esta rodando

```bash
curl http://localhost:18789/api/status
# Deve retornar: {"status":"ok"}
```

### 2. Teste o agente extrator via curl

```bash
curl -X POST http://localhost:18789/api/sessions/test/messages \
  -H "Authorization: Bearer your-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"message": "/skill estima-extrator {\"descricao\": \"Notebook i5 16GB\"}"}'
```

### 3. Teste via Estima.IA

Acesse `http://localhost:3000/pesquisa/nova` e siga o wizard. No passo 4, clique em "Extrair com IA". O resultado deve vir do OpenClaw.

---

## Passo 5: Deploy em producao

### Opcao A: OpenClaw no mesmo servidor da Estima.IA

```
Servidor VPS
├── Porta 3000 → Estima.IA (Next.js)
└── Porta 18789 → OpenClaw Gateway
```

Configure `OPENCLAW_URL=http://localhost:18789` na Estima.IA.

### Opcao B: OpenClaw em servidor dedicado

```
Servidor A (Vercel/Render) → Estima.IA
Servidor B (VPS)          → OpenClaw Gateway
```

Configure `OPENCLAW_URL=https://openclaw.seu-dominio.com:18789`.

**Seguranca:**
- Use HTTPS no Gateway
- Configure firewall para aceitar apenas conexoes do servidor da Estima.IA
- Use token de autenticacao forte

---

## Troubleshooting

| Problema | Solucao |
|----------|---------|
| "Gateway nao responde" | Verifique se `openclaw gateway start` esta rodando |
| "Skill nao encontrada" | Verifique se as skills foram copiadas para `~/.openclaw/workspace/skills/` |
| "Token invalido" | Verifique `OPENCLAW_TOKEN` no `.env.local` e no `openclaw.json` |
| "Timeout na extracao" | O LLM pode estar lento. Aumente o timeout ou use modelo mais rapido |
| "JSON invalido na resposta" | O agente pode ter retornado texto livre. Verifique os logs do OpenClaw |

---

## Estrutura de arquivos OpenClaw na Estima.IA

```
estima-ia/
├── lib/
│   ├── openclaw-client.ts      ← Cliente HTTP para o Gateway
│   ├── math.ts                 ← Calculos deterministicos (sem IA)
│   └── ...
├── openclaw-skills/
│   ├── extrator/SKILL.md       ← Skill do agente extrator
│   ├── similaridade/SKILL.md   ← Skill do agente de similaridade
│   ├── justificador/SKILL.md   ← Skill do agente justificador
│   └── validador/SKILL.md      ← Skill do agente validador
├── openclaw-config/
│   └── openclaw.json           ← Configuracao multi-agente
└── OPENCLAW-INTEGRACAO.md      ← Este guia
```

---

## Resumo dos 4 Agentes

| Agente | Skill | Funcao | Entrada | Saida |
|--------|-------|--------|---------|-------|
| **Extrator** | `estima-extrator` | Interpreta objeto → specs JSON | Descricao + especificacoes | JSON com categoria e caracteristicas |
| **Similaridade** | `estima-similaridade` | Compara objeto × PNCP | Objeto + resultado PNCP | JSON com indice 0-100 |
| **Justificador** | `estima-justificador` | Redige texto do preco | Estatisticas + metodo | Texto justificativo |
| **Validador** | `estima-validador` | Verifica regras de negocio | Dados da pesquisa | JSON com alertas |

---

## Proximos passos

1. Instale o OpenClaw e configure as skills
2. Teste cada agente via curl
3. Integre no wizard da Estima.IA
4. Valide em ambiente de teste
5. Deploy em producao com HTTPS
