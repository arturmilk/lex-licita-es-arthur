# Exemplo: Notebook — Justificativa

## Entrada

```json
{
  "estatisticas": {
    "n": 5,
    "media": 4850.00,
    "mediana": 4800.00,
    "minimo": 4600.00,
    "maximo": 5100.00,
    "desvioPadrao": 204.12,
    "coeficienteVariacao": 4.2
  },
  "metodo": "media aritmetica",
  "quantidade": 50,
  "referenciasAceitas": 5,
  "categoria": "informatica"
}
```

## Saída esperada

```
O preco estimado foi formado com base em 5 (cinco) registros de contratacoes publicas similares consultadas no Portal Nacional de Contratacoes Publicas (PNCP), referentes ao periodo dos ultimos 12 meses e abrangencia nacional, utilizando o metodo da media aritmetica.

Os valores unitarios encontrados variaram entre R$ 4.600,00 (minimo) e R$ 5.100,00 (maximo), com media de R$ 4.850,00 e mediana de R$ 4.800,00. O coeficiente de variacao de 4,2% indica alta homogeneidade nos precos, demonstrando coerencia com o mercado para equipamentos de informatica com as especificacoes pesquisadas.

Assim, o preco unitario estimado de R$ 4.850,00 e o valor total de R$ 242.500,00 (cinquenta unidades) encontram-se dentro dos parametros de mercado e sao considerados adequados para a contratacao.
```
