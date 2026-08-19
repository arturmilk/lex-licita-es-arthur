# Spec — Melhorias pós-reunião (Estima.IA)

**Data:** 2026-08-19
**Origem:** Reunião com cliente, transcrita via NotebookLM + pontos do Gemini.
**Objetivo:** Finalizar o Estima.IA com as melhorias de interface, pesquisa de mercado, precificação estatística e o módulo de decomposição de custos (diferencial competitivo, prazo 15 dias).

---

## 1. Interface e Usabilidade

### 1.1 Reordenação de telas
- A tela **"Objeto da contratação"** (atual etapa 2) passa a ser a **primeira tela** do fluxo.
- Nova ordem do wizard (17 etapas):
  1. Objeto e forma de parcelamento
  2. Itens/lotes da contratação (acordeão)
  3. Informações do processo
  4. Quantidade e local de entrega
  5. Pesquisa de mercado (manual — CNPJ + fonte)
  6. Extração IA
  7. Revisão e confirmação
  8. Configurações da pesquisa
  9. Pesquisa PNCP (por item)
  10. Resultados (segregados por item)
  11. Análise IA
  12. Estatísticas (regra CV 20%)
  13. Preço estimado
  14. Metodologia e parâmetros do relatório
  15. Decomposição de custos
  16. Documentos e evidências
  17. Relatório final (com premissas)

### 1.2 Parcelamento no início
- A escolha da forma de parcelamento (**por item / por lote / global**) ocorre **na etapa 1**, antes do fluxo principal e da inserção de itens.

### 1.3 Estrutura em acordeão
- A interface de itens e lotes (etapa 2) usa **acordeão/sanfona**: seções expandíveis/recolhíveis, mantendo visual limpo.

### 1.4 Campos dinâmicos por lote ou item
- Ao definir a seleção por item ou lote, a interface abre dinamicamente os campos corretos (quantidade, unidade de medida, nº do item no edital).

## 2. Busca e Pesquisa de Mercado

### 2.1 Exclusão da busca de fornecedores
- A funcionalidade "Editais de fornecedores próximos" (atual etapa 5) é **excluída**.

### 2.2 Pesquisa de Mercado (nova tela)
- Substitui a busca de fornecedores.
- Registro manual de cotações com **CNPJ e fonte obrigatórios** (transparência documental).
- Campos: item relacionado, fornecedor, CNPJ, fonte, valor, data, observação.

### 2.3 Busca por item específico
- A pesquisa automática (PNCP) é executada e exibida **segregada por item** selecionado.

### 2.4 Rastreabilidade do item no edital
- Cada item tem campo **"nº do item do edital"** (vínculo com PNCP para conferência técnica).
- Os resultados exibem o item do edital correspondente e link para o edital/PNCP.

### 2.5 Especificação detalhada do objeto
- Especificação minuciosa por item (tamanho, capacidade, potência etc.) para evitar precificação genérica.

## 3. Precificação e Estatística

### 3.1 Regra de variação de preço (CV > 20%)
- Se o **coeficiente de variação** das referências aceitas ultrapassar 20%, o sistema:
  - emite **alerta**; e
  - usa **automaticamente o menor preço** como referência de cálculo (em vez de média distorcida).
- Limite configurável (default 20; `configuracoes.cv_alerta` migrado de 25 → 20).

### 3.2 Seletor de metodologias estatísticas
- Tela (etapa 14) antes da geração do relatório:
  - escolha da **tendência central**: média aritmética, mediana ou menor preço (mantendo média ponderada);
  - seleção dos **parâmetros que constarão no relatório**: média, desvio padrão, valor máximo, valor mínimo.

### 3.3 Campo e regras de ME/EPP
- Cálculo automatizado do percentual destinado a ME/EPP:
  - valor total estimado **≤ R$ 80.000** → sugestão de **exclusividade** ME/EPP;
  - acima disso, com item divisível → **reserva de 25%** do valor.
- Campo na UI com toggle aplicar/não aplicar + valor reservado em R$.

## 4. Diferencial competitivo

### 4.1 Módulo de Decomposição de Custos (prazo 15 dias)
- Módulo exclusivo por item: composição de custos com:
  - **insumos** (descrição, unidade, quantidade, custo unitário);
  - **mão de obra de dedicação exclusiva** (cargo, salário base, encargos %);
  - **encargos** percentuais e **BDI**;
  - cálculo automático do custo unitário e total;
  - comparação com o preço estimado de mercado (diferença %);
  - inclusão no relatório final.
- Diferencial frente a concorrentes (ex.: Banco de Preços).

### 4.2 Premissas no relatório final
- O relatório (PDF e XLSX) passa a conter bloco estruturado de **premissas e justificativas**:
  - fontes utilizadas, quantitativos, local de entrega, coeficiente de variação,
  - métrica de tendência central escolhida, parâmetros exibidos, regra ME/EPP, nº do item do edital.

---

## Decisões técnicas

- **Persistência:** manter padrão jsonb do projeto (`itens`, `pesquisaMercado`, `parametrosRelatorio`, `meEpp`, `decomposicaoCustos`, `premissas` na tabela `pesquisas`).
- **Resultados por item:** coluna `item_id` em `resultados_pesquisa` (referência ao id do item no jsonb) + `cnpj` + `fonte_dados`.
- **Migração de produção:** o Dockerfile não roda `db:push`; criar SQL idempotente versionado em `scripts/migrations/` e aplicar no workflow de deploy antes do `up -d app`.
- **Validação:** build local (`NODE_OPTIONS=--max-old-space-size=2560 npm run build`) antes de cada push; deploy automático via GitHub Actions na main.
- **CV:** `lib/math.ts` ganha `calcularComRegraCv()` — alerta + fallback para menor preço.

## Fora de escopo (nesta rodada)

- Cadastro/login social; multi-órgão avançado; integração com sistemas internos do órgão; módulo de concorrência/tempo real.
