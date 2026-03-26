#!/usr/bin/env bash
# deploy.sh — atualiza o ConcurseAI em produção
# Uso: ./deploy.sh
set -euo pipefail

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

echo "==> Puxando código mais recente..."
git pull origin main

echo "==> Rebuilding e subindo containers..."
$COMPOSE up -d --build

echo "==> Aguardando banco de dados ficar pronto..."
$COMPOSE exec backend python manage.py wait_for_db 2>/dev/null || sleep 5

echo "==> Rodando migrations..."
$COMPOSE exec backend python manage.py migrate --noinput

echo "==> Coletando arquivos estáticos..."
$COMPOSE exec backend python manage.py collectstatic --noinput

echo "==> Status dos containers:"
$COMPOSE ps

echo ""
echo "Deploy concluído."
