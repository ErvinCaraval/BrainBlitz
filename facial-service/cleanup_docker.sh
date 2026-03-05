#!/bin/bash

# Script para eliminar todas las imágenes y contenedores Docker en la máquina local

set -e  # Salir si hay algún error

echo "=========================================="
echo "Limpiando contenedores Docker..."
echo "=========================================="

# Detener todos los contenedores en ejecución
echo "Deteniendo contenedores en ejecución..."
docker stop $(docker ps -aq) 2>/dev/null || echo "No hay contenedores en ejecución"

# Eliminar todos los contenedores
echo "Eliminando todos los contenedores..."
docker rm $(docker ps -aq) 2>/dev/null || echo "No hay contenedores para eliminar"

echo ""
echo "=========================================="
echo "Limpiando imágenes Docker..."
echo "=========================================="

# Eliminar todas las imágenes
echo "Eliminando todas las imágenes..."
docker rmi $(docker images -q) 2>/dev/null || echo "No hay imágenes para eliminar"

echo ""
echo "=========================================="
echo "Limpiando sistema Docker (volúmenes, redes, caché)..."
echo "=========================================="

# Limpiar volúmenes huérfanos
echo "Eliminando volúmenes huérfanos..."
docker volume prune -f

# Limpiar redes no utilizadas
echo "Eliminando redes no utilizadas..."
docker network prune -f

# Limpiar todo el sistema (imágenes, contenedores, volúmenes, redes, caché)
echo "Limpiando todo el sistema Docker..."
docker system prune -a -f --volumes

echo ""
echo "=========================================="
echo "¡Limpieza completada!"
echo "=========================================="
echo ""
echo "Estado actual:"
docker ps -a
docker images
docker volume ls

