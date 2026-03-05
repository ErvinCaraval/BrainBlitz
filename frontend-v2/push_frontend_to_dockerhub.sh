#!/bin/bash

# Script para construir y subir frontend-v2 a Docker Hub
# Uso: ./push_frontend_to_dockerhub.sh [tag]..

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
DOCKER_USERNAME="${DOCKERHUB_USER:-ervincaravaliibarra}"
IMAGE_NAME="frontend-v2"
IMAGE_FULL="$DOCKER_USERNAME/$IMAGE_NAME"
TAG="${1:-latest}"
TAG_FULL="$IMAGE_FULL:$TAG"
TAG_LATEST="$IMAGE_FULL:latest"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Frontend-v2 Docker Hub Push Script${NC}"
echo -e "${BLUE}========================================${NC}"

# Verificar que Docker está instalado
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Error: Docker no está instalado${NC}"
    exit 1
fi

# Verificar que estamos en el directorio correcto.
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json no encontrado${NC}"
    echo -e "${YELLOW}   Ejecuta este script desde la carpeta frontend-v2${NC}"
    exit 1
fi

# Verificar que Dockerfile existe
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}❌ Error: Dockerfile no encontrado${NC}"
    exit 1
fi

echo -e "${BLUE}Información:${NC}"
echo -e "  Docker Username: ${YELLOW}$DOCKER_USERNAME${NC}"
echo -e "  Image Name: ${YELLOW}$IMAGE_FULL${NC}"
echo -e "  Tag: ${YELLOW}$TAG${NC}"
echo ""

# Step 1: Build
echo -e "${BLUE}📦 Paso 1: Construyendo imagen Docker...${NC}"
docker build \
    --tag "$TAG_FULL" \
    --tag "$TAG_LATEST" \
    --label "version=$TAG" \
    --label "build.date=$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
    --label "vcs.ref=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
    .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Imagen construida exitosamente${NC}"
else
    echo -e "${RED}❌ Error al construir la imagen${NC}"
    exit 1
fi

# Step 2: Login a Docker Hub
echo ""
echo -e "${BLUE}🔐 Paso 2: Autenticándose con Docker Hub...${NC}"
if [ -z "$DOCKERHUB_PASS" ]; then
    echo -e "${YELLOW}   DOCKERHUB_PASS no configurada${NC}"
    echo -e "${YELLOW}   Por favor, ejecuta: docker login${NC}"
    docker login
else
    echo -e "${YELLOW}   Usando DOCKERHUB_PASS desde variable de entorno${NC}"
    echo "$DOCKERHUB_PASS" | docker login -u "$DOCKER_USERNAME" --password-stdin
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Autenticación exitosa${NC}"
else
    echo -e "${RED}❌ Error de autenticación${NC}"
    exit 1
fi

# Step 3: Push
echo ""
echo -e "${BLUE}📤 Paso 3: Subiendo imágenes a Docker Hub...${NC}"
echo -e "${YELLOW}   Subiendo: $TAG_FULL${NC}"
docker push "$TAG_FULL"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ $TAG_FULL subida exitosamente${NC}"
else
    echo -e "${RED}❌ Error al subir $TAG_FULL${NC}"
    exit 1
fi

# Subir también con tag latest si no es latest
if [ "$TAG" != "latest" ]; then
    echo -e "${YELLOW}   Subiendo: $TAG_LATEST${NC}"
    docker push "$TAG_LATEST"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $TAG_LATEST subida exitosamente${NC}"
    else
        echo -e "${RED}❌ Error al subir $TAG_LATEST${NC}"
        exit 1
    fi
fi

# Step 4: Verificar imágenes
echo ""
echo -e "${BLUE}🔍 Paso 4: Verificando imágenes locales...${NC}"
docker images | grep "$IMAGE_FULL" | head -5

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   ✅ ¡Proceso completado exitosamente!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Próximos pasos:${NC}"
echo -e "  1. Verificar en Docker Hub: https://hub.docker.com/r/$DOCKER_USERNAME/$IMAGE_NAME"
echo -e "  2. Usar la imagen: ${YELLOW}docker pull $TAG_FULL${NC}"
echo -e "  3. Ejecutar: ${YELLOW}docker run -p 80:80 $TAG_FULL${NC}"
echo ""
