# Exemplo: Poucas referências (score 67)

## Entrada

```json
{
  "n": 3,
  "cv": 14.0,
  "min_referencias": 5,
  "cv_limite": 25,
  "similaridade_minima": 75,
  "menor_similaridade_aceita": 84,
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
      "campo": "min_referencias",
      "mensagem": "Quantidade insuficiente de referencias aceitas para calculo estatistico robusto (3 de 5).",
      "sugestao": "Amplie o periodo de pesquisa ou relaxe filtros de regiao para obter mais referencias."
    }
  ],
  "regras": {
    "min_referencias": { "atende": false, "valor": 3, "minimo": 5 },
    "cv_limite": { "atende": true, "valor": 14.0, "limite": 25 },
    "similaridade_minima": { "atende": true, "valor": 84, "minimo": 75 }
  }
}
```
