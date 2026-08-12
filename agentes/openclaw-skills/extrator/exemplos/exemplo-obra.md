# Exemplo: Reforma de Prédio (Obras)

## Entrada

```
Contratação de empresa para execução de reforma do prédio sede do órgão, 
com área construída de aproximadamente 2.500 m², incluindo substituição 
 do piso cerâmico, pintura interna e externa, troca do sistema elétrico 
para adequação à NBR 5410, instalação de sistema de ar-condicionado split 
 em 15 salas, prazo de execução de 180 dias, regime de empreitada por 
preco global.
```

## Saída esperada

```json
{
  "categoria": "obras",
  "subcategoria": "construcao-civil",
  "caracteristicas": [
    {
      "nome": "tipo_de_obra",
      "valor": "reforma",
      "tipo": "obrigatorio",
      "confianca": 100,
      "fonte": "execução de reforma do prédio sede"
    },
    {
      "nome": "area_construida",
      "valor": "2.500 m²",
      "tipo": "obrigatorio",
      "confianca": 95,
      "fonte": "área construída de aproximadamente 2.500 m²"
    },
    {
      "nome": "piso",
      "valor": "substituição por cerâmico",
      "tipo": "obrigatorio",
      "confianca": 93,
      "fonte": "substituição do piso cerâmico"
    },
    {
      "nome": "pintura",
      "valor": "interna e externa",
      "tipo": "obrigatorio",
      "confianca": 95,
      "fonte": "pintura interna e externa"
    },
    {
      "nome": "instalacao_eletrica",
      "valor": "troca total, adequação à NBR 5410",
      "tipo": "obrigatorio",
      "confianca": 96,
      "fonte": "troca do sistema elétrico para adequação à NBR 5410"
    },
    {
      "nome": "ar_condicionado",
      "valor": "split em 15 salas",
      "tipo": "obrigatorio",
      "confianca": 94,
      "fonte": "instalação de sistema de ar-condicionado split em 15 salas"
    },
    {
      "nome": "prazo_execucao",
      "valor": "180 dias",
      "tipo": "obrigatorio",
      "confianca": 98,
      "fonte": "prazo de execução de 180 dias"
    },
    {
      "nome": "regime_de_execucao",
      "valor": "empreitada por preço global",
      "tipo": "obrigatorio",
      "confianca": 99,
      "fonte": "regime de empreitada por preço global"
    }
  ],
  "resumo": "Reforma completa de prédio sede de 2.500 m² com adequação elétrica e climatização",
  "alertas": [
    "Marca/modelo do piso cerâmico não especificado",
    "Tipo de tinta não especificado",
    "BTU do ar-condicionado não especificado",
    "Não menciona projeto executivo",
    "Não especifica se há desocupação do prédio durante a obra"
  ]
}
```
