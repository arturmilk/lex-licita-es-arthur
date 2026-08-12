# Exemplo: Pesquisa válida — Tudo OK

## Entrada

```json
{
  "n": 7,
  "cv": 12.5,
  "min_referencias": 5,
  "cv_limite": 25,
  "similaridade_minima": 75,
  "menor_similaridade_aceita": 82,
  "maximo": 5200,
  "media": 4850,
  "minimo": 4600,
  "periodo_dias": 365,
  "referencia_mais_antiga_dias": 180,
  "regioes": ["DF", "SP", "PR", "RJ"],
  "metodo": "media_aritmetica",
  "categoria": "informatica"
}
```

## Saída esperada

```json
{
  "valido": true,
  "alertas": [
    {
      "tipo": "info",
      "codigo": "referencias_suficientes",
      "mensagem": "7 referencias aceitas. Minimo exigido: 5.",
      "recomendacao": "Quantidade de referencias adequada.",
      "campo": "resultados"
    },
    {
      "tipo": "info",
      "codigo": "cv_aceitavel",
      "mensagem": "CV de 12,5% esta dentro do limite de 25%.",
      "recomendacao": "Homogeneidade dos precos e adequada.",
      "campo": "estatisticas"
    },
    {
      "tipo": "info",
      "codigo": "similaridade_adequada",
      "mensagem": "Menor similaridade aceita: 82%. Minimo exigido: 75%.",
      "recomendacao": "Todas as referencias atingem o minimo de similaridade.",
      "campo": "resultados"
    }
  ],
  "score_confianca": 92,
  "regras_verificadas": [
    {"regra": "minimo_referencias", "status": "passou", "detalhe": "7 >= 5"},
    {"regra": "cv_limite", "status": "passou", "detalhe": "12,5% <= 25%"},
    {"regra": "similaridade_minima", "status": "passou", "detalhe": "82% >= 75%"},
    {"regra": "outliers", "status": "passou", "detalhe": "max 5200 <= media*2 (9700)"},
    {"regra": "temporalidade", "status": "passou", "detalhe": "ref mais antiga: 180 dias <= periodo: 365 dias"},
    {"regra": "abrangencia_geografica", "status": "passou", "detalhe": "4 regioes diferentes"},
    {"regra": "coerencia_metodo", "status": "passou", "detalhe": "media com 7 refs (>=3)"}
  ]
}
```
