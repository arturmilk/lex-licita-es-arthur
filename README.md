# Estima.IA - Versao Local (Demonstracao)

## Como executar

### Requisitos
- Node.js 18+ (https://nodejs.org)

### Passos

1. Entre na pasta do projeto:
```bash
cd estima-ia
```

2. Instale as dependencias:
```bash
npm install
```

3. Execute o servidor de desenvolvimento:
```bash
npm run dev
```

4. Acesse no navegador:
```
http://localhost:3000
```

5. Login:
- Use qualquer e-mail e senha (modo demonstracao)
- Ou clique diretamente em "Entrar"

---

## O que funciona nesta versao

- Todas as 7 telas navegaveis (Dashboard, Nova pesquisa, Processos, etc.)
- Wizard de 13 passos completo
- Extracao de caracteristicas por IA (simulada)
- Pesquisa no PNCP (simulada com dados mockados)
- Tabela comparativa com aceitar/rejeitar/justificar
- Calculos estatisticos deterministicos (media, mediana, DP, CV)
- Geracao de preco estimado com justificativa
- Download de PDF e XLSX com memoria de calculo
- Design responsivo

## O que NAO funciona (requer Supabase real)

- Autenticacao real (login e simulado)
- Persistencia de dados no banco
- Consulta real a API do PNCP (usa mock)
- Upload de arquivos para Storage
- Row Level Security

---

## Para conectar ao Supabase real

Substitua os arquivos:
- `lib/supabase.ts` -> use o cliente real do Supabase
- `lib/actions.ts` -> use Server Actions reais
- `.env.local` -> preencha com credenciais reais
