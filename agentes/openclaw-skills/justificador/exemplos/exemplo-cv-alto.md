# Exemplo: Servico com CV Alto — Justificativa com ressalva

## Entrada

```json
{
  "estatisticas": {
    "n": 6,
    "media": 18500.00,
    "mediana": 16200.00,
    "minimo": 12000.00,
    "maximo": 32000.00,
    "desvioPadrao": 6800.00,
    "coeficienteVariacao": 36.8
  },
  "metodo": "mediana",
  "quantidade": 1,
  "referenciasAceitas": 6,
  "categoria": "servicos"
}
```

## Saída esperada

```
O preco estimado foi formado com base em 6 (seis) registros de contratacoes similares de servicos de consultoria em tecnologia da informacao consultadas no Portal Nacional de Contratacoes Publicas (PNCP), referentes ao periodo dos ultimos 12 meses e abrangencia nacional, utilizando o metodo da mediana.

Os valores unitarios mensais encontrados variaram entre R$ 12.000,00 (minimo) e R$ 32.000,00 (maximo), com media de R$ 18.500,00 e mediana de R$ 16.200,00. O coeficiente de variacao de 36,8% indica dispersao significativa nos honorarios, atribuivel a variabilidade de qualificacao dos profissionais, complexidade dos entregaveis e modalidade de execucao (presencial, remota ou hibrida). A mediana foi adotada como metodo de calculo justamente para mitigar o efeito de outliers.

Assim, o preco unitario mensal estimado de R$ 16.200,00 encontra-se dentro dos parametros de mercado para servicos de mesma natureza, considerando as especificidades tecnicas exigidas e a realidade de mercado observada.
```
