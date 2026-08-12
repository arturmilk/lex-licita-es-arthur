# Exemplo: Notebook — Similaridade Baixa (38%)

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
    {"nome": "tela", "valor": "14 polegadas", "tipo": "obrigatorio"}
  ]
}
```

**Resultado PNCP:**
```json
{
  "orgao": "Secretaria de Saude do Estado",
  "descricao": "Aquisicao de 50 tablets Samsung Galaxy Tab A8, processador Octa-Core, 4GB RAM, 64GB armazenamento, tela 10.5", Android 12, garantia 1 ano",
  "localizacao": "Sao Paulo/SP",
  "esfera": "estadual"
}
```

## Saída esperada

```json
{
  "similaridade": 38,
  "motivo": "Tablet e categoria diferente de notebook. Processador Octa-Core e de arquitetura mobile, nao equivalente a Intel Core i5 desktop. Memoria 4GB e muito inferior aos 16GB. Armazenamento 64GB e 1/4 do solicitado. Tela 10.5" e significativamente menor que 14". Android 12 e sistema operacional diferente do Windows esperado.",
  "compatibilidade_tecnica": "incompativel",
  "criterios": {
    "compatibilidade_tecnica": 25,
    "mesma_categoria": 40,
    "contexto_compativel": 70
  },
  "alertas": [
    "CATEGORIA DIFERENTE: tablet vs notebook — divergencia critica",
    "Processador mobile Octa-Core nao e equivalente a Intel Core i5 para uso administrativo",
    "Memoria 4GB e 1/4 do obrigatorio 16GB",
    "Armazenamento 64GB e 1/4 do obrigatorio 256GB",
    "Tela 10.5" e muito menor que 14" solicitado",
    "Android 12 e incompativel com Windows solicitado"
  ],
  "recomendacao": "rejeitar"
}
```
