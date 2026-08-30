# 📋 ESTIMA.IA — RELATÓRIO COMPLETO PÓS-DEPLOY

**Todas as instruções e melhorias implementadas depois do deploy / após baixar do Git**

---

## 🔧 FASE 1 — CORREÇÕES DE DEPLOY E CI (para o sistema subir e rodar)

1. **Deploy/CI** — build unificado em um único workflow, corrigindo falhas de cache do Docker:
   - Cache do Next.js (buildx gha) gerava chunks inconsistentes → erro "listarDashboard is not a function" no /dashboard → build limpo no Docker
   - Pacote `postgres` copiado para o standalone — migrate.js falhava no container (MODULE_NOT_FOUND) e derrubava o app
   - Duplicações removidas (app/components e app/lib antigas na raiz — o build compilava código velho)
   - Build para linux/amd64 (QEMU/arm64 falhava no build do Next) → deploy builda na VPS (arm64 nativo)

2. **Busca PNCP** — desativado cache do Next.js nas rotas e fetches do PNCP (dados ficavam congelados)

3. **Autenticação** — permissões por perfil: pesquisador, gestor, administrador

4. **Busca PNCP completa** — filtros, checkboxes e correções de bugs

5. **Fluxo 17 etapas + pesquisa de mercado** — CNPJ + fonte obrigatórios, regra CV 20%, ME/EPP, decomposição de custos, premissas no relatório

6. **Detalhe da pesquisa** — itens, premissas, ME/EPP, decomposição e CNPJ das referências

7. **Monitoramento admin** — gráficos + logs no banco + fix na raiz

---

## 📝 FASE 2 — MELHORIAS DO DOCUMENTO "SISTEMA IA DE PREÇOS"

8. **Filtro por período** — opções 90/180/365 dias aplicadas na busca e na paginação (preço de 2024 não polui a estimativa)

9. **Análise crítica das referências** (determinística, não inventa motivo):
   - Outliers detectados por quantidade e região
   - Normalização de unidade (resma vs caixa)
   - Alerta de aceitabilidade — Lei 14.133 art. 23 §1º
   - Sugestão de justificativa com evidência

10. **Filtro por região/estado + ordenação** por valor (maior/menor) e data na tela de resultados

11. **Histórico do próprio órgão** — preços de pesquisas anteriores do mesmo órgão em card separado

---

## 🧭 FASE 3 — SISTEMA ORIENTADO À INTENÇÃO (o coração do sistema)

**Princípio:** "O servidor não precisa aprender o sistema. O sistema aprende como o servidor trabalha."

12. **Painel de trabalho do servidor** (`/painel` — primeira tela): tarefas de hoje, atrasadas, pendentes, aguardando outro, paradas 5+ dias + alertas

13. **Assistente "O que você precisa fazer?"** — digita em linguagem normal → IA detecta o tipo de processo → cria o processo + jornada guiada

14. **Jornadas guiadas passo a passo** — o sistema conduz: "agora faça isso", "falta este documento", "próxima etapa é esta"

15. **Checklist automático por tipo de processo** — 4 tipos (contratação de bens, dispensa, diárias, licença) com 18 etapas, documentos necessários e validações

16. **Validação antes de avançar** — faltou documento/assinatura/campo? bloqueia com mensagem clara

17. **Geração de minutas** — despacho, parecer, memorando, ofício, justificativa, relatório

18. **Histórico auditável** — quem fez o quê e quando em cada processo

19. **Busca inteligente por linguagem natural** — "processos de aquisição parados há mais de 10 dias"

20. **Consulta à legislação** — com fonte ("qual o prazo?" → Lei 14.133 + regra)

21. **Alertas inteligentes** — prazos vencendo, processos parados, atrasos

22. **Painel do gestor** (`/gestor`) — gargalos, atrasos, carga por servidor, taxa de conclusão

---

## 🤖 FASE 4 — IA NO SISTEMA (DeepSeek)

23. **Escrita assistida de documentos** — descreve em linguagem normal → IA escreve minuta formal completa (com processo, objeto, servidor, data)

24. **Leitura e resumo de documentos (PDF/TXT)** — envia arquivo → IA devolve: o que aconteceu, o que importa, o que falta, prazos, ação necessária

25. **Assistente contextual "Me ajuda"** — botão flutuante em todas as telas que entende o contexto (página/processo/etapa) e orienta o próximo passo

---

## 📱 FASE 5 — RESPONSIVIDADE NO CELULAR

26. **Correção 1** — viewport meta (width=device-width) + tabela de processos vira cartões empilhados no celular (botão "Guiar" acessível)

27. **Correção 2 (o bug real)** — layout `flex-col` no mobile: o header esticava até 100vh (tela inteira) e escondia o conteúdo; agora header 48px em cima + conteúdo ocupando o resto. Viewport exportado corretamente (Next 14 Viewport type)

---

## 🔍 FASE 6 — CORREÇÃO DA PESQUISA DE PREÇOS (fontes de dados)

28. **Compras.gov dados abertos corrigido** — o domínio antigo (compras.dados.gov.br) morreu (404) → migrado para dadosabertos.compras.gov.br com endpoint validado

29. **Fallback de janela de data** — o portal parou de publicar ~jun/2025 → o sistema recua mês a mês até achar dados e mostra qual janela usou

30. **Fontes lentas/quebradas excluídas** — precos_abertos (30s!), painel_precos (403)

31. **Fallback Firecrawl** — quando o PNCP bloquear (hCaptcha/403), tenta renderizar a busca via Firecrawl (aguardando chave em FIRECRAWL_API_KEY)

32. **Nova fonte Contratos.gov.br (preços REAIS pagos)** — inspirada no repositório mcp-brasil: varre UGs federais e extrai itens de contrato com preço unitário pago (resolve a "Opção B" que ficava "buscando…")

---

## ✅ FASE 7 — CORREÇÕES DE BUGS DA JORNADA

33. **Jornada guiada travada** — documentos/validações vinham da tarefa (tabela sem esses campos) em vez do modelo de etapas → checkboxes nunca apareciam e o backend bloqueava. Corrigido: carrega etapas_processo, casa com a etapa atual, mostra checklist + campos obrigatórios (data abertura, modalidade) e valida antes de avançar

34. **Exemplos nos campos em branco** — placeholders orientativos: quantidade (Ex: 500), unidade (resma, kg, m²), descrição do item (papel A4), número do processo e unidade com dicas, campos da jornada (modalidade, dotação, especificações, fundamentação legal, datas com exemplo)

---

## 💰 FASE 8 — DOTAÇÃO ORÇAMENTÁRIA AUTOMÁTICA

35. **Sugestão de dotação baseada no objeto** — regras de classificação SIAFI por palavras-chave:
   - Papel/toner → 3.3.90.30 (material de consumo)
   - Manutenção → 3.3.90.39 (serviços de terceiros PJ)
   - Notebooks/equipamentos → 4.4.90.52 (permanente)
   - Software/antivírus → 3.3.90.40 (serviços TI)
   - Diárias → 3.3.90.14
   - Obras → 4.4.90.51
36. **Botão "Sugerir com base no objeto"** na jornada → opções ordenadas por compatibilidade (%) → preenche com 1 clique

---

## 🔗 FASE 9 — CORREÇÃO DO ERRO 404

37. **404 ao voltar para o processo** — links da busca inteligente e painel apontavam para /processos/{id} (rota inexistente — só existe /processos/{id}/jornada) e tarefas sem processoId geravam /processos/null
38. **Corrigido** — todos os links vão para a jornada, tarefas órfãs não linkam, e /processos/{id} redireciona automaticamente para a jornada

---

## ⚖️ FASE 10 — JULGADOS DE APOIO (TCU + TCE-RO)

39. **Busca de julgados pelo objeto** — TCE-RO (Papyrus) + TCU em paralelo:
   - TCE-RO: papyrus.tce.ro.gov.br/api/espelho/buscar (443+ acórdãos, com ementa completa, relator, órgão julgador)
   - TCU: pesquisa.apps.tcu.gov.br (com headers de navegador + rate limit ~1 req/5s)
40. **Link guardado no processo** — clica "Guardar" → acórdão fica salvo dentro do processo com link, ementa, relator
41. **Marcar "em uso"** — botão "Marcar em uso" → badge "USADO NA JUSTIFICATIVA" → entra automaticamente na justificativa do documento
42. **Link sempre visível** — 🔗 direto (papyrus.tce.ro.gov.br/acordao/ID ou pesquisa TCU)

---

## 📄 FASE 11 — MODELOS AGU AUTO-PREENCHÍVEIS

43. **5 modelos oficiais da Lei 14.133/2021** (estrutura AGU):
    - Edital de Pregão Eletrônico
    - Termo de Referência
    - Ata de Registro de Preços
    - Contrato de Serviços com Dedicação Exclusiva de Mão de Obra
    - Lista de Verificação (checklist)
44. **Auto-preenchimento com dados do processo** — objeto, número do processo, dotação (sugerida automaticamente), justificativa (Lei 14.133), julgados em uso **com links**, data
45. **Edição livre + salvar como minuta** — o documento preenchido pode ser editado antes de salvar como minuta do processo

---

## 🗂️ ARQUIVOS NOVOS CRIADOS (pós-deploy)

- `lib/julgados.ts` — cliente de busca TCU + TCE-RO
- `lib/dotacao.ts` — regras de classificação orçamentária SIAFI
- `lib/analise-critica.ts` — análise estatística das referências
- `lib/intencao.ts` — detecção de intenção, jornadas, painel, alertas, busca
- `lib/actions-intencao.ts` — server actions do sistema orientado à intenção
- `lib/sources/contratos-govbr.ts` — fonte de preços reais pagos
- `lib/db/seed-intencao.ts` — 4 tipos de processo + 18 etapas guiadas
- `lib/db/seed-modelos.ts` — 5 modelos AGU
- `components/MeAjuda.tsx` — assistente contextual flutuante
- `app/api/ia/documento/route.ts` — leitura/resumo de PDF
- `app/painel/page.tsx` — painel do servidor
- `app/gestor/page.tsx` — visão do gestor
- `app/processos/[id]/jornada/page.tsx` — jornada guiada
- `app/processos/[id]/page.tsx` — redirect 404 → jornada

---

## 📌 STATUS ATUAL

- **Link:** https://submitting-feelings-parish-hugh.trycloudflare.com (túnel temporário — cai a cada reinício)
- **Login:** admin@estima.ia / Admin@123
- **Servidor:** porta 3002 (produção)
- **Banco:** Postgres local, database `estimaia`
- **Pendências conhecidas:** chave Firecrawl não configurada; MinIO ausente (evidências podem falhar); PNCP pode bloquear por IP (hCaptcha); deploy VPS + domínio próprio recomendado
