#!/bin/bash
# inicia o dev server desacoplado (sobrevive ao fim do exec)
cd /root/.openclaw/workspace-sistematico/estima-ia-app
pkill -f "next dev" 2>/dev/null
sleep 2
setsid nohup npm run dev > /tmp/estima-dev.log 2>&1 < /dev/null &
disown
echo "dev iniciado pid $!"
