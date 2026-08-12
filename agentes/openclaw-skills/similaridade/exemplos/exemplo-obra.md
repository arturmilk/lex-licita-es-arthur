# Exemplo: Obra — Similaridade Alta (91%)

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
  "orgao": "Tribunal Regional Federal",
  "descricao": "Reforma e modernizacao da sede do TRF-3a Regiao, area 2.400 m2, substituicao de pisos ceramicos, adequacao do sistema eletrico a NBR 5410/2023, execucao em 210 dias, empreitada por preco global",
  "localizacao": "Sao Paulo/SP",
  "esfera": "federal"
}
```

## Saída esperada

```json
{
  "similaridade": 91,
  "motivo": "Mesmo tipo de obra (reforma), area muito proxima (2.400 vs 2.500 m2), mesmo escopo de piso ceramico e adequacao eletrica a NBR 5410, mesmo regime de execucao. Prazo 210 dias e 16% maior que 180 dias, mas ainda dentro de margem razoavel para obras do mesmo porte.",
  "compatibilidade_tecnica": "alta",
  "criterios": {
    "compatibilidade_tecnica": 95,
    "mesma_categoria": 100,
    "contexto_compativel": 80
  },
  "alertas": [
    "Area 2.400 m2 e 4% menor que 2.500 m2 solicitados — diferenca aceitavel",
    "Prazo 210 dias e 16% superior aos 180 dias — pode indicar obra mais complexa ou condicoes diferentes",
    "NBR 5410/2023 e versao atualizada da NBR 5410 — tecnicamente superior"
  ],
  "recomendacao": "aceitar"
}
```
