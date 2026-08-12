# Contexto: Veículos

Use este contexto quando a categoria detectada for "veiculos".

## Características típicas a extrair

### Identificação
- tipo_de_veiculo (automóvel, caminhão, ônibus, motocicleta, máquina)
- marca
- modelo (ou "ou similar")
- ano_fabricacao_minimo
- ano_modelo_minimo

### Motor e Performance
- tipo_de_combustivel (gasolina, diesel, etanol, flex, elétrico, híbrido)
- motor (cilindrada, potência, torque)
- transmissao (manual, automática, CVT)
- tracao (4x2, 4x4, 6x4)
- capacidade_de_carga (kg)
- capacidade_de_passageiros

### Dimensões
- comprimento (mm)
- largura (mm)
- altura (mm)
- entre_eixos (mm)
- peso_bruto_total (kg)

### Equipamentos e Acessórios
- ar_condicionado (sim/nao)
- direcao_hidraulica_eletrica (sim/nao)
- vidros_eletricos (sim/nao)
- travas_eletricas (sim/nao)
- airbags (quantidade)
- abs (sim/nao)
- computador_de_bordo (sim/nao)
- camera_de_re (sim/nao)
- sensor_de_estacionamento (sim/nao)
- outros_acessorios

### Documentação e Garantia
- garantia_do_fabricante (meses/km)
- revisoes_inclusas (sim/nao, quantidade)
- seguro_obrigatorio_incluso (sim/nao)
- licenciamento_incluso (sim/nao)

## Armadilhas comuns
- "caminhão 3/4" sem especificar carga → extrair como "caminhão 3/4 (capacidade não especificada)"
- "veículo zero km" sem definir modelo → alertar: "modelo não especificado"
- "ou similar" sem critérios → extrair como "ou similar (critérios não definidos)"
