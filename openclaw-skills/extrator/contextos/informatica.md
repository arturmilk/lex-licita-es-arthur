# Contexto: Informática

Use este contexto quando a categoria detectada for "informatica".

## Características típicas a extrair

### Hardware
- processador (marca, modelo, geração, clock)
- memoria_ram (capacidade, tipo DDR, frequência)
- armazenamento (tipo: SSD/HDD, capacidade, interface)
- placa_de_video (integrada/dedicada, modelo, VRAM)
- tela (polegadas, resolução, tipo: LED/IPS/OLED)
- bateria (capacidade, autonomia estimada)
- conectividade (WiFi 6, Bluetooth 5, portas USB-C/3.0)

### Software
- sistema_operacional (Windows, Linux, macOS, versão)
- licenciamento (OEM, volume, perpetuo, assinatura)
- softwares_incluidos (Office, antivírus, etc.)

### Serviços de TI
- tipo_de_servico (suporte, desenvolvimento, consultoria)
- nivel_de_suporte (N1, N2, N3)
- sla_tempo_resposta (em horas)
- sla_tempo_resolucao (em horas)
- disponibilidade (horário de atendimento)
- modalidade (presencial, remoto, híbrido)

### Garantia e Suporte
- garantia_equipamento (meses)
- garantia_estendida (sim/nao, meses)
- suporte_tecnico (telefone, email, presencial)
- pecas_de_reposicao (incluídas ou não)

## Armadilhas comuns
- "Intel i5" sem especificar geração → extrair como "Intel Core i5 (geração não especificada)" com confiança baixa
- "16GB" sem especificar DDR → extrair como "16 GB (tipo não especificado)"
- "Windows" sem versão → extrair como "Windows (versão não especificada)"
- "garantia de fábrica" sem prazo → alertar: "prazo de garantia não especificado"
