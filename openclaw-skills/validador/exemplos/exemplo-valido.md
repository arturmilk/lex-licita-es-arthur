# Exemplo: Pesquisa válida — atende todos os critérios (score 100)

## Entrada

```json
{
  "n": 7,
  "cv": 12.5,
  "min_referencias": 5,
  "cv_limite": 25,
  "similaridade_minima": 75,
  "menor_similaridade_aceita": 82,
  "categoria": "informatica"
}
```

## Saída esperada

```json
{
  "valido": true,
  "score_confianca": 100,
  "alertas": [],
  "regras": {
    "min_referencias": { "atende": true, "valor": 7, "minimo": 5 },
    "cv_limite": { "atende": true, "valor": 12.5, "limite": 25 },
    "similaridade_minima": { "atende": true, "valor": 82, "minimo": 75 }
  }
}
```
