# Exemplo: Notebook — Similaridade Alta (96%)

## Entrada

**Objeto desejado:**
```json
{
  "categoria": "informatica",
  "subcategoria": "computadores-portateis",
  "caracteristicas": [
    {"nome": "processador", "valor": "Intel Core i5 ou superior", "tipo": "obrigatorio"},
    {"nome": "memoria_ram", "valor": "16 GB", "tipo": "obrigatorio"},
    {"nome": "armazenamento", "valor": "256 GB SSD", "tipo": "obrigatorio"},
    {"nome": "tela", "valor": "14 polegadas", "tipo": "obrigatorio"},
    {"nome": "sistema_operacional", "valor": "Windows 11 Pro ou equivalente", "tipo": "obrigatorio"},
    {"nome": "garantia", "valor": "3 anos", "tipo": "obrigatorio"}
  ]
}
```

**Resultado PNCP:**
```json
{
  "orgao": "Ministerio da Educacao",
  "descricao": "Aquisicao de 30 notebooks empresariais Dell Latitude 5430, processador Intel Core i5-1235U, 16GB DDR4, SSD 256GB NVMe, tela 14" Full HD, Windows 11 Pro, garantia 3 anos on-site",
  "localizacao": "Brasilia/DF",
  "esfera": "federal"
}
```

## Saída esperada

```json
{
  "similaridade": 96,
  "motivo": "Mesmas especificacoes tecnicas, apenas descricao com mais detalhes de marca e modelo. Processador i5-1235U atende 'i5 ou superior'. SSD NVMe e superior ao SSD generico solicitado. Garantia on-site e superior.",
  "compatibilidade_tecnica": "alta",
  "criterios": {
    "compatibilidade_tecnica": 98,
    "mesma_categoria": 100,
    "contexto_compativel": 90
  },
  "alertas": [
    "Marca Dell especificada no resultado, mas objeto nao exige marca",
    "Modelo Latitude 5430 mencionado, mas objeto aceita 'ou similar'"
  ],
  "recomendacao": "aceitar"
}
```
