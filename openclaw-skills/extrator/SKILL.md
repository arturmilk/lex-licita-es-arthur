---
name: estima-extrator
description: Extrai características técnicas estruturadas de descrições de objetos de contratação pública.
user-invocable: true
disable-model-invocation: false
---

# Estima.IA — Agente Extrator

## Identidade
Consulte `SOU.md` para entender quem este agente é, sua personalidade, valores e limites.

## Configuração técnica
Consulte `AGENT.md` para modelo, temperatura, formato de saída e regras de extração.

## Categorias disponíveis
Consulte `contextos/categorias.md` para a lista padronizada de categorias e subcategorias.

## Contextos por categoria
Carregue o contexto apropriado conforme a categoria detectada:
- `contextos/informatica.md` — equipamentos de TI, software, telecom
- `contextos/obras.md` — construção civil, reformas, infraestrutura
- `contextos/servicos.md` — consultoria, limpeza, segurança, TI
- `contextos/veiculos.md` — automóveis, máquinas, equipamentos móveis

## Exemplos de few-shot
Consulte `exemplos/` para ver casos reais de entrada e saída:
- `exemplos/exemplo-notebook.md` — informática
- `exemplos/exemplo-obra.md` — obras
- `exemplos/exemplo-servico.md` — serviços

## Formato de saída obrigatório

```json
{
  "categoria": "string",
  "subcategoria": "string",
  "caracteristicas": [
    {
      "nome": "string (snake_case)",
      "valor": "string",
      "tipo": "obrigatorio|desejavel",
      "confianca": 0-100,
      "fonte": "string (trecho do texto original)"
    }
  ],
  "resumo": "string com ate 200 caracteres",
  "alertas": ["lista de ambiguidades ou omissoes"]
}
```

## Instruções de execução

1. Leia o `SOU.md` para internalizar a identidade do agente.
2. Leia o `AGENT.md` para entender a configuração técnica.
3. Analise o texto de entrada e identifique a categoria.
4. Carregue o contexto apropriado de `contextos/`.
5. Extraia as características seguindo as regras do `AGENT.md`.
6. Retorne o JSON estruturado.
7. Se ambíguo, consulte exemplos em `exemplos/` antes de decidir.
