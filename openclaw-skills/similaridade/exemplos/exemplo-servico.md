# Exemplo: Serviço — Similaridade Baixa (20%)

## Entrada

**Objeto desejado:**
```json
{
  "categoria": "servicos",
  "subcategoria": "limpeza-e-conservacao",
  "caracteristicas": [
    {"nome": "natureza_do_servico", "valor": "limpeza predial continua", "tipo": "obrigatorio"},
    {"nome": "frequencia", "valor": "diaria", "tipo": "obrigatorio"},
    {"nome": "equipe", "valor": "10 profissionais", "tipo": "obrigatorio"},
    {"nome": "material_incluso", "valor": "material e equipamentos inclusos", "tipo": "obrigatorio"},
    {"nome": "jornada", "valor": "8 horas/dia", "tipo": "obrigatorio"},
    {"nome": "prazo", "valor": "12 meses", "tipo": "obrigatorio"}
  ]
}
```

**Resultado PNCP:**
```json
{
  "orgao": "Prefeitura de Santos",
  "descricao": "Contratacao de servico de vigilancia patrimonial armada, 24 horas, 6 postos fixos, rondas motorizadas, prazo de 12 meses",
  "localizacao": "Santos/SP",
  "esfera": "municipal"
}
```

## Saída esperada

```json
{
  "similaridade": 20,
  "motivo": "Categoria igual (servicos) mas subcategoria diferente (seguranca-e-vigilancia vs limpeza-e-conservacao) — maximo 50. Natureza do servico completamente distinta (-20) e equipe divergente (6 postos vs 10 profissionais) (-10). Prazo compativel.",
  "recomendacao": "rejeitar",
  "detalhes": {
    "categoria_match": true,
    "specs_compativeis": ["prazo (12 meses = 12 meses)"],
    "specs_divergentes": ["subcategoria (seguranca vs limpeza)", "natureza_do_servico (vigilancia armada vs limpeza predial)", "equipe (6 postos vs 10 profissionais)", "frequencia (24h vs diaria)"],
    "specs_faltantes": ["material_incluso (nao mencionado no candidato)", "jornada (nao mencionada no candidato)"],
    "alertas": ["SUBCATEGORIA DIFERENTE: limpeza vs seguranca — similaridade maxima 50", "Servicos de natureza distinta — nao usar como referencia de preco"]
  }
}
```
