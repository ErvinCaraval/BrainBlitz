#!/bin/bash

# Script para limpiar TODAS las imágenes, contenedores y volúmenes de Docker
# Generados por docker-compose.

echo "🧹 Limpiando Docker COMPLETAMENTE..."
echo ""

# Detener todos los contenedores en ejecución
echo "⏹️  Deteniendo contenedores..."
cd "$(dirname "$0")/.." || exit
docker compose -f docker/docker-compose.yml down -v 2>/dev/null || true

# Esperar un momento
sleep 2

# Detener cualquier contenedor restante
echo "🛑 Deteniendo TODOS los contenedores..."
docker stop $(docker ps -aq) 2>/dev/null || true

# Eliminar todos los contenedores
echo "🗑️  Eliminando TODOS los contenedores..."
docker rm -f $(docker ps -aq) 2>/dev/null || true

# Eliminar volúmenes
echo "💾 Eliminando TODOS los volúmenes..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true
docker volume prune -f 2>/dev/null || true

# Eliminar TODAS las imágenes
echo "🖼️  Eliminando TODAS las imágenes de Docker..."
docker rmi -f $(docker images -q) 2>/dev/null || true

# Eliminar imágenes sin etiqueta
echo "🧹 Limpiando imágenes sin etiqueta..."
docker image prune -af 2>/dev/null || true

# Eliminar redes no utilizadas
echo "🌐 Eliminando redes..."
docker network prune -f 2>/dev/null || true

# Limpiar caché de compilación
echo "⚙️  Limpiando caché de compilación..."
docker builder prune -af 2>/dev/null || true

echo ""
echo "✅ Limpieza TOTAL completada!"
echo ""
echo "Estado actual de Docker:"
docker system df