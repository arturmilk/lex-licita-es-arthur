# Exemplo: Consultoria em TI (Serviços)

## Entrada

```
Contratação de empresa especializada para prestação de serviços de 
consultoria em governança de TI, com duração de 12 meses, exigindo 
2 (dois) consultores seniores com certificação ITIL v4 e experiência 
mínima comprovada de 5 anos em órgãos públicos. O serviço será 
prestado em regime de 40 horas semanais, com atendimento presencial 
2 vezes por semana e remoto nos demais dias. Entregáveis: relatório 
mensal de maturidade, plano de ação trimestral e capacitação da 
equipe interna.
```

## Saída esperada

```json
{
  "categoria": "servicos",
  "subcategoria": "consultoria-e-assessoria",
  "caracteristicas": [
    {
      "nome": "tipo_de_servico",
      "valor": "consultoria em governança de TI",
      "tipo": "obrigatorio",
      "confianca": 98,
      "fonte": "serviços de consultoria em governança de TI"
    },
    {
      "nome": "prazo_de_execucao",
      "valor": "12 meses",
      "tipo": "obrigatorio",
      "confianca": 99,
      "fonte": "duração de 12 meses"
    },
    {
      "nome": "quantidade_de_profissionais",
      "valor": "2 consultores seniores",
      "tipo": "obrigatorio",
      "confianca": 97,
      "fonte": "2 (dois) consultores seniores"
    },
    {
      "nome": "certificacoes_exigidas",
      "valor": "ITIL v4",
      "tipo": "obrigatorio",
      "confianca": 96,
      "fonte": "certificação ITIL v4"
    },
    {
      "nome": "experiencia_minima",
      "valor": "5 anos em órgãos públicos",
      "tipo": "obrigatorio",
      "confianca": 95,
      "fonte": "experiência mínima comprovada de 5 anos em órgãos públicos"
    },
    {
      "nome": "jornada_de_trabalho",
      "valor": "40 horas semanais",
      "tipo": "obrigatorio",
      "confianca": 98,
      "fonte": "regime de 40 horas semanais"
    },
    {
      "nome": "modalidade",
      "valor": "híbrido (2x presencial, 3x remoto)",
      "tipo": "obrigatorio",
      "confianca": 94,
      "fonte": "atendimento presencial 2 vezes por semana e remoto nos demais dias"
    },
    {
      "nome": "entregaveis",
      "valor": "relatório mensal de maturidade, plano de ação trimestral, capacitação da equipe",
      "tipo": "obrigatorio",
      "confianca": 96,
      "fonte": "relatório mensal de maturidade, plano de ação trimestral e capacitação da equipe interna"
    }
  ],
  "resumo": "Consultoria em governança de TI por 12 meses com 2 consultores seniores certificados ITIL",
  "alertas": [
    "Não especifica se a certificação ITIL deve ser Foundation ou nível superior",
    "Não define formato dos relatórios (PDF, apresentação, dashboard)",
    "Não menciona SLA para resposta a demandas emergenciais",
    "Não especifica se há reuniões de kickoff ou fechamento"
  ]
}
```
