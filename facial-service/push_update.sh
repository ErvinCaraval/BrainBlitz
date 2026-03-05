#!/bin/bash
# Script para actualizar facial-service en DockerHub
# Uso: ./push_to_dockerhub.sh v2.0

set -e

VERSION=${1:-v2.0}
IMAGE_NAME="ervincaravaliibarra/facial-service"
TAG="${IMAGE_NAME}:${VERSION}"
LATEST="${IMAGE_NAME}:latest"

echo "🚀 Facial Service - Build & Push"
echo "=================================="
echo "Image: $TAG"
echo "Latest: $LATEST"
echo ""

# 1. Build imagen
echo "1️⃣ Building Docker image..."
docker build -t "$TAG" -t "$LATEST" .

if [ $? -eq 0 ]; then
    echo "✓ Build exitoso"
else
    echo "❌ Error en build"
    exit 1
fi

echo ""
echo "2️⃣ Pushing to DockerHub..."

# 2. Push versión específica
docker push "$TAG"
if [ $? -eq 0 ]; then
    echo "✓ Push de $TAG exitoso"
else
    echo "❌ Error en push de $TAG"
    exit 1
fi

# 3. Push latest
docker push "$LATEST"
if [ $? -eq 0 ]; then
    echo "✓ Push de $LATEST exitoso"
else
    echo "❌ Error en push de $LATEST"
    exit 1
fi

echo ""
echo "=================================="
echo "✓ Facial Service $VERSION publicado"
echo "  - $TAG"
echo "  - $LATEST"
echo "=================================="
