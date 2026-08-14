#!/bin/bash
set -e

DOMAIN='iesa.novagente.com.br'
EMAIL='contato@novagente.com.br'

echo '=== Estima.IA — Ativar SSL ==='
echo ''

# 1. Check DNS
echo '1. Verificando DNS...'
IP=$(dig +short $DOMAIN 2>/dev/null || nslookup $DOMAIN 2>/dev/null | grep 'Address:' | tail -1 | awk '{print $2}')
if [ -z "$IP" ]; then
  echo 'ERRO: DNS ainda não propagou. Adicione o registro A:'
  echo "  $DOMAIN → 147.93.0.202"
  exit 1
fi
echo "  DNS OK → $IP"

# 2. Get SSL cert
echo ''
echo '2. Obtendo certificado SSL...'
docker exec command-certbot-1 certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d $DOMAIN \
  --non-interactive \
  --agree-tos \
  --email $EMAIL

# 3. Uncomment SSL block in nginx.conf
echo ''
echo '3. Ativando bloco HTTPS no nginx...'
python3 << 'PYEOF'
content = open('/opt/sentia/command/nginx/nginx.conf').read()
lines = content.split('\n')
new_lines = []
in_pending = False
for line in lines:
    if '# LICITA_SSL_PENDING_DNS' in line:
        in_pending = True
        new_lines.append('# SSL ativado em: ' + __import__('datetime').datetime.now().strftime('%Y-%m-%d'))
        continue
    if in_pending and line.startswith('# '):
        new_lines.append(line[2:])  # remove leading '# '
    else:
        in_pending = False
        new_lines.append(line)
open('/opt/sentia/command/nginx/nginx.conf', 'w').write('\n'.join(new_lines))
print('nginx.conf atualizado')
PYEOF

# 4. Reload nginx
echo ''
echo '4. Recarregando nginx...'
docker exec command-nginx-1 nginx -t && docker exec command-nginx-1 nginx -s reload

echo ''
echo '=== SSL ativo! Acesse: https://iesa.novagente.com.br ==='
