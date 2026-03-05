#!/bin/bash

# Script para construir y empujar todas las imágenes a Docker Hub y luego
# activar el despliegue de Backend y Frontend en Render.com.
#
# Las credenciales de Docker Hub y los Webhooks de Render se cargan desde el archivo .env.
#
# REQUERIMIENTOS:
#   - Docker instalado y corriendo
#   - curl instalado
#   - Archivo .env en la misma ubicación con:
#       DOCKERHUB_USER, DOCKERHUB_PASS
#       BACKEND_DEPLOY_HOOK, FRONTEND_DEPLOY_HOOK

# NO usar set -e para que continúe aunque un script falle
# set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# --- CARGA DE VARIABLES DE ENTORNO DESDE .env ---
SCRIPT_LOCATION="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_LOCATION/.env"

if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}📄 Cargando credenciales y webhooks desde $ENV_FILE...${NC}"
    # Cargar variables.
    source "$ENV_FILE"
    
    # Exportar variables a sub-scripts
    export DOCKERHUB_USER
    export DOCKERHUB_PASS
    
    # Validación de variables críticas
    if [ -z "$DOCKERHUB_USER" ] || [ -z "$DOCKERHUB_PASS" ] || \
       [ -z "$BACKEND_DEPLOY_HOOK" ] || [ -z "$FRONTEND_DEPLOY_HOOK" ]; then
        echo -e "${RED}❌ ERROR: ¡Faltan variables críticas en el archivo .env!${NC}"
        echo "Asegúrate de que DOCKERHUB_USER, DOCKERHUB_PASS, BACKEND_DEPLOY_HOOK y FRONTEND_DEPLOY_HOOK estén definidos."
        exit 1
    fi
else
    echo -e "${RED}❌ ERROR: Archivo .env no encontrado en $SCRIPT_LOCATION. Se detendrá el script.${NC}"
    exit 1
fi
echo ""
# ----------------------------------------------------

# Definición de directorios y servicios
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
echo "📦 Iniciando proceso de construcción y push de imágenes a Docker Hub..."
echo "📍 Directorio base: $SCRIPT_DIR"
echo ""

# Arrays separados para nombres y rutas
SERVICES=("backend" "facial-service" "facial-redis" "frontend")
SCRIPT_PATHS=(
    "$SCRIPT_DIR/backend-v1/push_backend_to_dockerhub.sh"
    "$SCRIPT_DIR/facial-service/push_facial_service_to_dockerhub.sh"
    "$SCRIPT_DIR/facial-service/push_redis_to_dockerhub.sh"
    "$SCRIPT_DIR/frontend-v2/push_frontend_to_dockerhub.sh"
)
# Array para registrar si el backend y el frontend se subieron exitosamente
BACKEND_PUSH_OK=false
FRONTEND_PUSH_OK=false

# Función para enviar el webhook de despliegue
send_deploy_hook() {
    local SERVICE_NAME=$1
    local HOOK_URL=$2
    
    echo -e "${PURPLE}⚙️  Activando despliegue de $SERVICE_NAME en Render...${NC}"
    
    # curl -X POST para enviar la solicitud. -s para modo silencioso, -o /dev/null para descartar la salida.
    if curl -X POST -s -o /dev/null -w "%{http_code}" "$HOOK_URL" | grep -q "^20[0-9]"; then
        echo -e "${GREEN}  ✅ Webhook de $SERVICE_NAME enviado exitosamente (Código 2xx)${NC}"
    else
        echo -e "${RED}  ❌ Falló el envío del Webhook de $SERVICE_NAME.${NC}"
    fi
}

# Contador de éxitos y fallos
TOTAL=${#SERVICES[@]}
SUCCESS=0
FAILED=0
FAILED_SCRIPTS=()

# Ejecutar cada script de push
for i in "${!SERVICES[@]}"; do
    SERVICE="${SERVICES[$i]}"
    SCRIPT_PATH="${SCRIPT_PATHS[$i]}"
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}▶ Procesando: $SERVICE${NC}"
    echo -e "${BLUE}📄 Script: $SCRIPT_PATH${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    if [ -f "$SCRIPT_PATH" ]; then
        # Obtener el directorio del script
        SCRIPT_DIR_EXEC=$(dirname "$SCRIPT_PATH")
        # Ejecutar el script desde su directorio (no parar si falla)
        if (cd "$SCRIPT_DIR_EXEC" && bash "$(basename "$SCRIPT_PATH")" 2>&1); then
            echo ""
            echo -e "${GREEN}✅ $SERVICE - Completado exitosamente${NC}"
            ((SUCCESS++))
            
            # Marcar el estado de los servicios clave para Render
            if [ "$SERVICE" == "backend" ]; then
                BACKEND_PUSH_OK=true
            elif [ "$SERVICE" == "frontend" ]; then
                FRONTEND_PUSH_OK=true
            fi
        else
            EXIT_CODE=$?
            echo ""
            echo -e "${RED}❌ $SERVICE - Falló (código: $EXIT_CODE)${NC}"
            ((FAILED++))
            FAILED_SCRIPTS+=("$SERVICE")
        fi
    else
        echo -e "${RED}❌ Script no encontrado: $SCRIPT_PATH${NC}"
        ((FAILED++))
        FAILED_SCRIPTS+=("$SERVICE (archivo no encontrado)")
    fi
    echo ""
done

# --- Sección de Despliegue en Render ---
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}☁️  INICIANDO DESPLIEGUES EN RENDER${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

DEPLOY_INITIATED=false

if $BACKEND_PUSH_OK; then
    send_deploy_hook "Backend" "$BACKEND_DEPLOY_HOOK"
    DEPLOY_INITIATED=true
else
    echo -e "${YELLOW}⚠️  Despliegue de Backend omitido: La imagen no se subió exitosamente a Docker Hub.${NC}"
fi

echo ""

if $FRONTEND_PUSH_OK; then
    send_deploy_hook "Frontend" "$FRONTEND_DEPLOY_HOOK"
    DEPLOY_INITIATED=true
else
    echo -e "${YELLOW}⚠️  Despliegue de Frontend omitido: La imagen no se subió exitosamente a Docker Hub.${NC}"
fi

if ! $DEPLOY_INITIATED; then
    echo -e "${YELLOW}⚠️  No se inició ningún despliegue en Render.${NC}"
fi

# --- Resumen Final ---
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📊 RESUMEN FINAL DEL PROCESO COMPLETO${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "Total de servicios procesados: $TOTAL"
echo -e "${GREEN}✅ Push Exitosos: $SUCCESS${NC}"
echo -e "${RED}❌ Push Fallidos: $FAILED${NC}"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo "Servicios de Docker Hub que fallaron:"
    for failed in "${FAILED_SCRIPTS[@]}"; do
        echo -e "${RED}  • $failed${NC}"
    done
    echo ""
    # El script termina con un código de error si hubo fallos en el push
    exit 1
else
    echo ""
    echo -e "${GREEN}🎉 ¡Todos los servicios fueron empujados exitosamente y los despliegues en Render fueron notificados!${NC}"
    echo ""
    exit 0
fi