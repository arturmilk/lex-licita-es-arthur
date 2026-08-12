# Exemplo: Notebook (Informática)

## Entrada

```
Aquisição de 50 (cinquenta) notebooks para uso administrativo, com processador 
Intel Core i5 ou superior, 16 GB de memória RAM, 256 GB SSD, tela 14 polegadas, 
sistema operacional Windows 11 Pro ou equivalente, garantia mínima de 3 anos.
```

## Saída esperada

```json
{
  "categoria": "informatica",
  "subcategoria": "computadores-portateis",
  "caracteristicas": [
    {
      "nome": "quantidade",
      "valor": "50 unidades",
      "tipo": "obrigatorio",
      "confianca": 100,
      "fonte": "Aquisição de 50 (cinquenta) notebooks"
    },
    {
      "nome": "processador",
      "valor": "Intel Core i5 ou superior",
      "tipo": "obrigatorio",
      "confianca": 95,
      "fonte": "processador Intel Core i5 ou superior"
    },
    {
      "nome": "memoria_ram",
      "valor": "16 GB",
      "tipo": "obrigatorio",
      "confianca": 97,
      "fonte": "16 GB de memória RAM"
    },
    {
      "nome": "armazenamento",
      "valor": "256 GB SSD",
      "tipo": "obrigatorio",
      "confianca": 96,
      "fonte": "256 GB SSD"
    },
    {
      "nome": "tela",
      "valor": "14 polegadas",
      "tipo": "obrigatorio",
      "confianca": 94,
      "fonte": "tela 14 polegadas"
    },
    {
      "nome": "sistema_operacional",
      "valor": "Windows 11 Pro ou equivalente",
      "tipo": "obrigatorio",
      "confianca": 92,
      "fonte": "sistema operacional Windows 11 Pro ou equivalente"
    },
    {
      "nome": "garantia",
      "valor": "3 anos",
      "tipo": "obrigatorio",
      "confianca": 93,
      "fonte": "garantia mínima de 3 anos"
    }
  ],
  "resumo": "Notebook corporativo com especificações padrão para administração pública",
  "alertas": [
    "Marca/fabricante não especificado",
    "Geração do processador Intel i5 não especificada",
    "Tipo de memória RAM (DDR4/DDR5) não especificado",
    "Resolução da tela não especificada"
  ]
}
```
