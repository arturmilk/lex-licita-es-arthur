# Exemplo: CV acima do limite (score 67)

## Entrada

```json
{
  "n": 6,
  "cv": 31.0,
  "min_referencias": 5,
  "cv_limite": 25,
  "similaridade_minima": 75,
  "menor_similaridade_aceita": 80,
  "categoria": "informatica"
}
```

## Saída esperada

```json
{
  "valido": false,
  "score_confianca": 67,
  "alertas": [
    {
      "tipo": "erro",
      "campo": "cv_limite",
      "mensagem": "Coeficiente de variacao acima do limite aceitavel, indicando alta dispersao nos precos (31,0% > 25%).",
      "sugestao": "Considere usar a mediana em vez da media aritmetica, ou revise referencias com maior dispersao."
    }
  ],
  "regras": {
    "min_referencias": { "atende": true, "valor": 6, "minimo": 5 },
    "cv_limite": { "atende": false, "valor": 31.0, "limite": 25 },
    "similaridade_minima": { "atende": true, "valor": 80, "minimo": 75 }
  }
}
```
