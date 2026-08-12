# Exemplo: Pesquisa com problemas — Alertas críticos

## Entrada

```json
{
  "n": 3,
  "cv": 32.0,
  "min_referencias": 5,
  "cv_limite": 25,
  "similaridade_minima": 75,
  "menor_similaridade_aceita": 68,
  "maximo": 8500,
  "media": 4850,
  "minimo": 3200,
  "periodo_dias": 365,
  "referencia_mais_antiga_dias": 420,
  "regioes": ["DF", "DF", "DF"],
  "metodo": "menor_preco",
  "categoria": "informatica"
}
```

## Saída esperada

```json
{
  "valido": false,
  "alertas": [
    {
      "tipo": "critico",
      "codigo": "referencias_insuficientes",
      "mensagem": "Apenas 3 referencias aceitas. Minimo exigido: 5.",
      "recomendacao": "Aceite mais resultados ou amplie os filtros de pesquisa.",
      "campo": "resultados"
    },
    {
      "tipo": "critico",
      "codigo": "cv_alto",
      "mensagem": "CV de 32,0% ultrapassa o limite de 25%.",
      "recomendacao": "Revise as referencias aceitas. Considere rejeitar outliers (ref com R$ 8.500 e ref com R$ 3.200).",
      "campo": "estatisticas"
    },
    {
      "tipo": "critico",
      "codigo": "similaridade_baixa",
      "mensagem": "Referencia com similaridade de 68% e abaixo do minimo de 75%.",
      "recomendacao": "Rejeite esta referencia ou redefina os criterios de aceitacao.",
      "campo": "resultados"
    },
    {
      "tipo": "aviso",
      "codigo": "outlier_detectado",
      "mensagem": "Existe referencia com valor de R$ 8.500,00 muito acima da media de R$ 4.850,00.",
      "recomendacao": "Verifique se nao ha erro de digitacao ou especificacao diferente.",
      "campo": "resultados"
    },
    {
      "tipo": "aviso",
      "codigo": "referencia_antiga",
      "mensagem": "Referencia com 420 dias e anterior ao periodo de pesquisa configurado (365 dias).",
      "recomendacao": "Ajuste o filtro de periodo ou rejeite referencias antigas.",
      "campo": "configuracoes"
    },
    {
      "tipo": "aviso",
      "codigo": "abrangencia_reduzida",
      "mensagem": "100% das referencias sao da mesma regiao (DF).",
      "recomendacao": "Considere ampliar a pesquisa para outras regioes.",
      "campo": "configuracoes"
    },
    {
      "tipo": "aviso",
      "codigo": "metodo_menor_preco_poucas_refs",
      "mensagem": "Metodo 'menor preco' com apenas 3 referencias. Recomendado: pelo menos 5.",
      "recomendacao": "Aceite mais referencias ou mude para media/mediana.",
      "campo": "configuracoes"
    }
  ],
  "score_confianca": 28,
  "regras_verificadas": [
    {"regra": "minimo_referencias", "status": "falhou", "detalhe": "3 < 5"},
    {"regra": "cv_limite", "status": "falhou", "detalhe": "32,0% > 25%"},
    {"regra": "similaridade_minima", "status": "falhou", "detalhe": "68% < 75%"},
    {"regra": "outliers", "status": "falhou", "detalhe": "max 8500 > media*2 (9700)? NAO, mas 8500 >> media (4850)"},
    {"regra": "temporalidade", "status": "falhou", "detalhe": "420 dias > 365 dias"},
    {"regra": "abrangencia_geografica", "status": "falhou", "detalhe": "1 regiao (DF)"},
    {"regra": "coerencia_metodo", "status": "falhou", "detalhe": "menor_preco com 3 refs (<5)"}
  ]
}
```
