# Contexto: Obras

Use este contexto quando a categoria detectada for "obras".

## Características típicas a extrair

### Escopo
- tipo_de_obra (construção, reforma, ampliação, demolição)
- area_construida (m²)
- area_do_terreno (m²)
- numero_de_pavimentos
- altura_maxima (m)

### Estrutura
- tipo_estrutura (alvenaria, concreto armado, aço, madeira)
- fundacao (tipo: sapata, estaca, radier)
- cobertura (telha, laje, estrutura metálica)

### Acabamentos
- piso (cerâmica, porcelanato, cimento queimado)
- revestimento_parede (pintura, cerâmica, textura)
- esquadrias (alumínio, PVC, madeira)
- forro (gesso, PVC, mineral)

### Instalações
- instalacao_hidrossanitaria (sim/nao, especificacoes)
- instalacao_eletrica (sim/nao, carga instalada)
- instalacao_de_informatica (cabeamento estruturado, tomadas)
- sistema_de_incendio (alarme, sprinklers, extintores)
- acessibilidade (rampas, elevador, sanitários adaptados)

### Execução
- prazo_execucao (dias, meses)
- regime_de_execucao (empreitada por preco global, unitario, administracao)
- mao_de_obra (propria, terceirizada)
- subcontratacao_permitida (sim/nao)

### Materiais
- fornecimento_de_materiais (contratante, contratado, misto)
- materiais_incluidos (lista)
- materiais_excluidos (lista)

## Armadilhas comuns
- "reforma simples" sem especificar o que inclui → alertar: "escopo da reforma não detalhado"
- "acabamento padrão" sem definir padrão → extrair como "acabamento padrão (não especificado)" com baixa confiança
- "material de primeira linha" sem marca → alertar: "material de primeira linha sem especificação técnica"
