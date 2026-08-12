# Exemplo: Notebook — Similaridade Média (72%)

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
    {"nome": "sistema_operacional", "valor": "Windows 11 Pro ou equivalente", "tipo": "obrigatorio"}
  ]
}
```

**Resultado PNCP:**
```json
{
  "orgao": "Prefeitura Municipal de Curitiba",
  "descricao": "Aquisicao de 20 notebooks educacionais Lenovo IdeaPad 3, processador AMD Ryzen 5 5500U, 8GB RAM, SSD 256GB, tela 15.6" HD, Windows 11 Home, garantia 1 ano",
  "localizacao": "Curitiba/PR",
  "esfera": "municipal"
}
```

## Saída esperada

```json
{
  "similaridade": 72,
  "motivo": "Processador Ryzen 5 e equivalente ao i5. Tela 15.6" e compativel com 14" solicitado. Porem: memoria RAM 8GB e inferior aos 16GB obrigatorios, Windows 11 Home e inferior ao Pro, garantia 1 ano e inferior ao padrao esperado.",
  "compatibilidade_tecnica": "media",
  "criterios": {
    "compatibilidade_tecnica": 65,
    "mesma_categoria": 95,
    "contexto_compativel": 85
  },
  "alertas": [
    "Memoria RAM 8GB e INFERIOR ao obrigatorio 16GB — divergencia critica",
    "Windows 11 Home e INFERIOR ao Pro solicitado — falta recursos corporativos",
    "Garantia 1 ano e significativamente inferior ao padrao de 3 anos",
    "Tela 15.6" e maior que 14" solicitado, mas ainda aceitavel para uso administrativo"
  ],
  "recomendacao": "analisar"
}
```
