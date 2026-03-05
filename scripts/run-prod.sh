#!/bin/bash

# Script para ejecutar docker-compose.prod.yml (usando imágenes de Docker Hub)

echo "Iniciando ambiente de producción con imágenes de Docker Hub..."
echo ""
echo "Imágenes a utilizar:"
echo "  ✓ ervincaravaliibarra/facial-service:latest"
echo "  ✓ ervincaravaliibarra/facial-service-redis:latest"
echo "  ✓ ervincaravaliibarra/backend-v1:latest"
echo "  ✓ ervincaravaliibarra/frontend-v2:latest"
echo ""

# Ejecutar docker-compose.prod.yml
cd "$(dirname "$0")/.." || exit
docker compose -f docker/docker-compose.prod.yml up --build -d

