# Estima.IA v2

Sistema de pesquisa de preços para licitações públicas com integração real ao PNCP.

## Stack

- **Next.js 14** (App Router + Server Actions)
- **PostgreSQL** via Docker
- **Drizzle ORM** (TypeScript-first)
- **NextAuth.js v5** (autenticação com JWT)
- **MinIO** (storage de arquivos, S3-compatível)
- **API do PNCP** (real, sem mock)

## Iniciar em desenvolvimento

### 1. Pré-requisitos
- Node.js 18+
- Docker + Docker Compose

### 2. Subir serviços
```bash
docker compose up -d
```

### 3. Instalar dependências
```bash
npm install
```

### 4. Configurar variáveis
```bash
cp .env.example .env.local
# Edite .env.local com seus valores
```

### 5. Criar tabelas e seed inicial
```bash
npm run db:push
npm run db:seed
```

### 6. Iniciar aplicação
```bash
npm run dev
```

Acesse: http://localhost:3000

**Login padrão:** admin@estima.ia / Admin@123

## Integração com Agentes

A API de agentes usa autenticação por API Key. Gere uma chave em Admin > API Keys.

### Headers
```
X-API-Key: eia_xxxxx
```
ou
```
Authorization: Bearer eia_xxxxx
```

### Endpoints disponíveis
- `GET /api/agent` - Documentação
- `GET /api/agent/pesquisas` - Listar pesquisas do órgão
- `POST /api/agent/pesquisas` - Criar pesquisa via agente
- `POST /api/agent/pncp` - Buscar no PNCP
- `POST /api/agent/calcular` - Calcular preço estimado

## Deploy no VPS / Produção

```bash
# Na VPS
docker compose up -d postgres minio

# Configurar variáveis de produção
AUTH_SECRET=$(openssl rand -base64 32)
AGENT_API_KEY=$(openssl rand -hex 32)

npm run build
npm run db:push
npm run db:seed
npm start
```

## Estrutura
```
app/
  api/
    auth/         - NextAuth handlers
    register/     - Cadastro de órgão
    processos/    - CRUD processos
    pesquisas/    - CRUD pesquisas + resultados
    evidencias/   - CRUD evidências
    upload/       - Upload de arquivos (MinIO)
    pncp/         - Consulta PNCP (autenticado)
    admin/        - Usuários, configurações, API keys
    agent/        - API para agentes externos
lib/
  db/             - Drizzle schema + migrations
  auth.ts         - NextAuth config
  storage.ts      - MinIO helpers
  pncp.ts         - PNCP API client
  math.ts         - Cálculos estatísticos
  agent-auth.ts   - Auth para agentes
```
