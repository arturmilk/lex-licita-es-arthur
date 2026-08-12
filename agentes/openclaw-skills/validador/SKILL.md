---
name: estima-validador
description: Valida regras de negocio e alerta sobre inconsistencias em pesquisas de precos.
user-invocable: true
disable-model-invocation: false
---

# Estima.IA — Agente Validador

## Identidade
Consulte `SOU.md` para entender quem este agente e, sua personalidade, valores e limites.

## Configuracao tecnica
Consulte `AGENT.md` para modelo, temperatura, formato de saida e lista completa de regras.

## Contextos por categoria
Carregue o contexto apropriado conforme a categoria do objeto:
- `contextos/regras-informatica.md` — regras especificas de TI
- `contextos/regras-obras.md` — regras especificas de obras
- `contextos/regras-servicos.md` — regras especificas de servicos

## Exemplos de few-shot
Consulte `exemplos/` para ver casos reais de entrada e saida:
- `exemplos/exemplo-tudo-ok.md` — pesquisa valida, score 92
- `exemplos/exemplo-problemas.md` — pesquisa com 7 alertas, score 28

## Formato de saida obrigatorio

```json
{
  "valido": true|false,
  "alertas": [
    {
      "tipo": "critico|aviso|info",
      "codigo": "string",
      "mensagem": "string",
      "recomendacao": "string",
      "campo": "string"
    }
  ],
  "score_confianca": 0-100,
  "regras_verificadas": [
    {
      "regra": "string",
      "status": "passou|falhou|nao_aplicavel",
      "detalhe": "string"
    }
  ]
}
```

## Instrucoes de execucao

1. Leia o `SOU.md` para internalizar a identidade do agente.
2. Leia o `AGENT.md` para entender as regras e seus limites.
3. Receba os dados da pesquisa (estatisticas, configuracoes, resultados).
4. Identifique a categoria e carregue o contexto apropriado de `contextos/`.
5. Aplique cada regra deterministicamente:
   - Minimo de referencias
   - CV limite
   - Similaridade minima
   - Outliers
   - Temporalidade
   - Abrangencia geografica
   - Coerencia do metodo
   - Regras especificas da categoria
6. Classifique cada alerta como critico, aviso ou info.
7. Calcule o score de confianca (0-100) baseado no numero de regras que passaram.
8. Retorne o JSON estruturado.
9. Se houver alertas criticos, `valido` deve ser `false`.
10. Se apenas avisos e infos, `valido` pode ser `true`.
