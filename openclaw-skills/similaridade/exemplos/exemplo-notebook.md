# Exemplo: Notebook — Similaridade Alta (98%)

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
  "descricao": "Aquisicao de 30 notebooks empresariais Dell Latitude 5430, processador Intel Core i5-1235U, 16GB DDR4, SSD 256GB NVMe, tela 14\" Full HD, Windows 11 Pro, garantia 3 anos on-site",
  "localizacao": "Brasilia/DF",
  "esfera": "federal"
}
```

## Saída esperada

```json
{
  "similaridade": 98,
  "motivo": "Categoria e subcategoria iguais. Todas as 6 specs obrigatorias atendidas ou superadas: i5-1235U atende 'i5 ou superior', 16GB igual, NVMe 256GB superior ao SSD generico, tela 14\" igual, Windows 11 Pro igual, garantia 3 anos on-site superior. Sem deducoes.",
  "recomendacao": "aceitar",
  "detalhes": {
    "categoria_match": true,
    "specs_compativeis": ["processador (i5-1235U atende i5 ou superior)", "memoria_ram (16GB = 16GB)", "armazenamento (256GB NVMe superior a SSD)", "tela (14\" = 14\")", "sistema_operacional (Windows 11 Pro = Pro)", "garantia (3 anos on-site superior)"],
    "specs_divergentes": [],
    "specs_faltantes": [],
    "alertas": ["Marca Dell especificada no resultado, mas objeto nao exige marca", "Modelo Latitude 5430 mencionado, mas objeto aceita 'ou equivalente'"]
  }
}
```
