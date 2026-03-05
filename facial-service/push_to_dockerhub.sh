#!/bin/bash

# Script para construir y subir la imagen del servicio facial a Docker Hub
# Usuario: ervincaravaliibarra

set -e  # Salir si hay algún error

# Configuración
DOCKER_USERNAME="ervincaravaliibarra"
IMAGE_NAME="facial-service"
IMAGE_TAG="latest"
FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"

echo "=========================================="
echo "Construyendo imagen Docker..."
echo "=========================================="

# Construir la imagen
docker build -t ${FULL_IMAGE_NAME} -f Dockerfile .

echo ""
echo "=========================================="
echo "Iniciando sesión en Docker Hub..."
echo "=========================================="

# Iniciar sesión en Docker Hub
echo "94092232381" | docker login -u ${DOCKER_USERNAME} --password-stdin

echo ""
echo "=========================================="
echo "Subiendo imagen a Docker Hub..."
echo "=========================================="

# Subir la imagen
docker push ${FULL_IMAGE_NAME}

echo ""
echo "=========================================="
echo "¡Imagen subida exitosamente!"
echo "Imagen: ${FULL_IMAGE_NAME}"
echo "=========================================="

# Cerrar sesión (opcional, por seguridad)
docker logout

echo "Sesión cerrada."

