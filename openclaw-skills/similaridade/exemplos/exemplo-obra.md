# Exemplo: Obra — Similaridade Média (70%)

## Entrada

**Objeto desejado:**
```json
{
  "categoria": "obras",
  "subcategoria": "construcao-civil",
  "caracteristicas": [
    {"nome": "tipo_de_obra", "valor": "reforma", "tipo": "obrigatorio"},
    {"nome": "area_construida", "valor": "2.500 m2", "tipo": "obrigatorio"},
    {"nome": "piso", "valor": "substituicao por ceramica", "tipo": "obrigatorio"},
    {"nome": "instalacao_eletrica", "valor": "troca total, adequacao a NBR 5410", "tipo": "obrigatorio"},
    {"nome": "prazo_execucao", "valor": "180 dias", "tipo": "obrigatorio"},
    {"nome": "regime_de_execucao", "valor": "empreitada por preco global", "tipo": "obrigatorio"}
  ]
}
```

**Resultado PNCP:**
```json
{
  "orgao": "Tribunal de Justica de SP",
  "descricao": "Reforma e modernizacao de forum, area 2.200 m2, substituicao de piso em porcelanato, adequacao do sistema eletrico a NBR 5410, execucao em 240 dias, empreitada por preco unitario",
  "localizacao": "Sao Paulo/SP",
  "esfera": "estadual"
}
```

## Saída esperada

```json
{
  "similaridade": 70,
  "motivo": "Categoria e subcategoria iguais. Tipo de obra, piso (porcelanato e superior a ceramica, sem penalidade) e instalacao eletrica (NBR 5410) compativeis. Deduzido: area 2.200 vs 2.500 m2 (-10), prazo 240 vs 180 dias (-10), regime preco unitario vs preco global (-10).",
  "recomendacao": "analisar",
  "detalhes": {
    "categoria_match": true,
    "specs_compativeis": ["tipo_de_obra (reforma = reforma)", "piso (porcelanato superior a ceramica)", "instalacao_eletrica (adequacao a NBR 5410)"],
    "specs_divergentes": ["area_construida (2.200 m2 vs 2.500 m2)", "prazo_execucao (240 vs 180 dias)", "regime_de_execucao (preco unitario vs preco global)"],
    "specs_faltantes": [],
    "alertas": ["Regime de execucao diferente — impacto relevante na formacao do preco", "Prazo 33% superior ao solicitado", "Area 12% menor que a solicitada"]
  }
}
```
