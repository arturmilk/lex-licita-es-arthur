# Exemplo: Obra — Justificativa

## Entrada

```json
{
  "estatisticas": {
    "n": 4,
    "media": 2850000.00,
    "mediana": 2780000.00,
    "minimo": 2600000.00,
    "maximo": 3200000.00,
    "desvioPadrao": 245000.00,
    "coeficienteVariacao": 8.6
  },
  "metodo": "mediana",
  "quantidade": 1,
  "referenciasAceitas": 4,
  "categoria": "obras"
}
```

## Saída esperada

```
O preco estimado foi formado com base em 4 (quatro) registros de contratacoes similares de obras de reforma consultadas no Portal Nacional de Contratacoes Publicas (PNCP), referentes ao periodo dos ultimos 24 meses e abrangencia regional, utilizando o metodo da mediana.

Os valores totais encontrados variaram entre R$ 2.600.000,00 (minimo) e R$ 3.200.000,00 (maximo), com media de R$ 2.850.000,00 e mediana de R$ 2.780.000,00. O coeficiente de variacao de 8,6% indica homogeneidade nos custos, compativel com a padronizacao dos servicos de construcao civil para obras de mesmo porte e complexidade.

Assim, o preco global estimado de R$ 2.780.000,00 encontra-se dentro dos parametros de mercado e e considerado adequado para a contratacao, considerando as especificacoes tecnicas do projeto executivo.
```
