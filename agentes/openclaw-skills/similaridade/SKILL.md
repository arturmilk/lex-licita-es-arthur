---
name: estima-similaridade
description: Calcula indice de similaridade tecnica entre objeto desejado e resultados de licitacoes.
user-invocable: true
disable-model-invocation: false
---

# Estima.IA — Agente de Similaridade

## Identidade
Consulte `SOU.md` para entender quem este agente e, sua personalidade, valores e limites.

## Configuracao tecnica
Consulte `AGENT.md` para modelo, temperatura, formato de saida, criterios de avaliacao e regras de comparacao.

## Contextos por categoria
Carregue o contexto apropriado conforme a categoria do objeto:
- `contextos/comparacao-informatica.md` — equipamentos de TI
- `contextos/comparacao-obras.md` — construcao civil
- `contextos/comparacao-servicos.md` — servicos e consultoria
- `contextos/comparacao-veiculos.md` — automoveis e maquinas

## Exemplos de few-shot
Consulte `exemplos/` para ver casos reais de entrada e saida:
- `exemplos/exemplo-notebook-alto.md` — similaridade 96% (alta)
- `exemplos/exemplo-notebook-medio.md` — similaridade 72% (media)
- `exemplos/exemplo-notebook-baixo.md` — similaridade 38% (baixa)
- `exemplos/exemplo-obra.md` — similaridade 91% (alta)

## Formato de saida obrigatorio

```json
{
  "similaridade": 0-100,
  "motivo": "string com ate 200 caracteres",
  "compatibilidade_tecnica": "alta|media|baixa|incompativel",
  "criterios": {
    "compatibilidade_tecnica": 0-100,
    "mesma_categoria": 0-100,
    "contexto_compativel": 0-100
  },
  "alertas": ["lista de divergencias"],
  "recomendacao": "aceitar|rejeitar|analisar"
}
```

## Instrucoes de execucao

1. Leia o `SOU.md` para internalizar a identidade do agente.
2. Leia o `AGENT.md` para entender a configuracao tecnica e os pesos.
3. Receba o objeto desejado (JSON com caracteristicas) e o resultado PNCP (JSON com descricao).
4. Identifique a categoria e carregue o contexto apropriado de `contextos/`.
5. Avalie os tres criterios (compatibilidade tecnica, mesma categoria, contexto compativel).
6. Calcule a similaridade ponderada: (compatibilidade * 0.60) + (categoria * 0.25) + (contexto * 0.15).
7. Redija o motivo em ate 200 caracteres.
8. Liste alertas sobre divergencias importantes.
9. Recomende: aceitar (>=75), analisar (50-74), rejeitar (<50).
10. Retorne o JSON estruturado.
11. Se ambiguo, consulte exemplos em `exemplos/` antes de decidir.
