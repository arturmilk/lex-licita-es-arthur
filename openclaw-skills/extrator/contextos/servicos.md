# Contexto: Serviços

Use este contexto quando a categoria detectada for "servicos".

## Características típicas a extrair

### Escopo do serviço
- tipo_de_servico (consultoria, assessoria, execução, manutenção)
- area_de_atuacao (TI, engenharia, jurídica, administrativa)
- descricao_detalhada (o que será feito)
- entregaveis (relatórios, sistemas, treinamentos, laudos)

### Recursos humanos
- quantidade_de_profissionais
- formacao_academica_requerida
- experiencia_minima (anos)
- certificacoes_exigidas
- dedicacao (integral, parcial, sob demanda)

### Execução
- prazo_de_execucao (dias, meses, indeterminado)
- jornada_de_trabalho (horas/dia, dias/semana)
- local_de_execucao (presencial, remoto, híbrido)
- deslocamento_necessario (sim/nao, km)

### Gestão
- metodologia (PMBOK, Ágil, Scrum, ITIL)
- ferramentas_exigidas (softwares específicos)
- relatorios_e_controles (frequência, formato)
- reunioes_de_acompanhamento (frequência)

### Garantia
- garantia_do_servico (meses)
- correção_de_defeitos (prazo)
- penalidade_por_atraso (sim/nao, percentual)

## Armadilhas comuns
- "consultoria em TI" sem especificar o que → alertar: "escopo da consultoria não detalhado"
- "profissional qualificado" sem definir qualificação → extrair como "qualificação não especificada"
- "prazo conforme necessidade" → extrair como "prazo indeterminado/sob demanda"
