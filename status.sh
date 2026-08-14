#!/bin/bash
echo '=== Estima.IA Status ==='
echo ''
echo 'Containers:'
docker compose -f /opt/sentia/estima-ia/docker-compose.yml ps
echo ''
echo 'App health:'
docker exec estimaia-app wget -qO- http://localhost:3000/api/health 2>/dev/null || echo 'Aguardando...'
echo ''
echo 'Banco - tabelas:'
docker exec estimaia-postgres psql -U estimaia -d estimaia -c '\dt' 2>/dev/null | tail -15
echo ''
echo 'Usuarios:'
docker exec estimaia-postgres psql -U estimaia -d estimaia -c 'SELECT nome, email, perfil FROM usuarios;' 2>/dev/null
echo ''
echo 'DNS:'
dig +short licita.novagente.com.br 2>/dev/null || echo 'Nao resolvido'
