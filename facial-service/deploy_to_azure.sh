#!/bin/bash

# Script para desplegar el servicio facial en Azure Container Instances
# Requiere: Azure CLI instalado y autenticado

set -e  # Salir si hay algún error

# Configuración
DOCKER_IMAGE="ervincaravaliibarra/facial-service:latest"
RESOURCE_GROUP="facial-service-rg"
CONTAINER_NAME="facial-service-ervin"
LOCATION="brazilsouth"  # Cambia según tu preferencia
DNS_NAME_LABEL="facial-service-ervin"  # Debe ser único globalmente

echo "=========================================="
echo "Desplegando servicio facial en Azure"
echo "=========================================="
echo ""

# Verificar que Azure CLI está instalado
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI no está instalado."
    echo "   Instala con: curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    exit 1
fi

## Load .env if present (export variables)
if [ -f ".env" ]; then
    set -a
    # shellcheck source=/dev/null
    source .env
    set +a
fi

# Verificar autenticación
echo "🔐 Verificando autenticación en Azure..."
if ! az account show &> /dev/null; then
        echo "❌ No estás autenticado en Azure."
        echo ""
        echo "💡 Para autenticarte, ejecuta:"
        echo "   ./azure_login.sh"
        echo ""
        echo "   O manualmente:"
        echo "   az login"
        echo ""
        exit 1
fi

ACCOUNT=$(az account show --query name -o tsv)
echo "✅ Autenticado como: $ACCOUNT"
echo ""

# Crear grupo de recursos si no existe
echo "📦 Verificando grupo de recursos..."
if ! az group show --name $RESOURCE_GROUP &> /dev/null; then
    echo "   Creando grupo de recursos: $RESOURCE_GROUP"
    az group create --name $RESOURCE_GROUP --location $LOCATION
    echo "✅ Grupo de recursos creado"
else
    echo "✅ Grupo de recursos ya existe"
fi
echo ""

# Eliminar contenedor existente si existe (para actualizar)
echo "🗑️  Verificando contenedor existente..."
if az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME &> /dev/null; then
    echo "   Eliminando contenedor existente..."
    az container delete --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --yes
    echo "   Esperando a que se elimine..."
    sleep 10
fi
echo ""

# Desplegar el contenedor
echo "🚀 Desplegando contenedor en Azure Container Instances..."
echo "   Imagen: $DOCKER_IMAGE"
echo "   Nombre: $CONTAINER_NAME"
echo "   Región: $LOCATION"
echo ""

az container create \
    --resource-group $RESOURCE_GROUP \
    --name $CONTAINER_NAME \
    --image $DOCKER_IMAGE \
    --os-type Linux \
    --dns-name-label $DNS_NAME_LABEL \
    --ports 5001 \
    --cpu 2 \
    --memory 4 \
    --registry-login-server docker.io \
    --registry-username "${DOCKERHUB_USER:-ervincaravaliibarra}" \
    --registry-password "${DOCKERHUB_PASS:-}" \
    --environment-variables \
        FLASK_ENV=production \
        PYTHONUNBUFFERED=1 \
        USE_REDIS=true \
        REDIS_URL="${REDIS_URL:-}" \
    --restart-policy Always

echo ""
echo "=========================================="
echo "✅ Contenedor desplegado exitosamente!"
echo "=========================================="
echo ""

# Obtener información del contenedor
echo "📋 Información del contenedor:"
FQDN=$(az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query ipAddress.fqdn -o tsv)
IP_ADDRESS=$(az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query ipAddress.ip -o tsv)
STATE=$(az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query containers[0].instanceView.currentState.state -o tsv)

echo "   FQDN: $FQDN"
echo "   IP: $IP_ADDRESS"
echo "   Estado: $STATE"
echo ""

# URLs disponibles
echo "🌐 URLs disponibles:"
echo "   http://$FQDN:5001/health"
echo "   http://$IP_ADDRESS:5001/health"
echo ""

# Esperar a que el contenedor esté listo
echo "⏳ Esperando a que el contenedor esté listo..."
sleep 15

# Probar conexión
echo "🔍 Probando conexión..."
if curl -f -s "http://$FQDN:5001/health" > /dev/null 2>&1; then
    echo "✅ Servicio respondiendo correctamente!"
    echo ""
    echo "=========================================="
    echo "✅ DESPLIEGUE COMPLETADO"
    echo "=========================================="
    echo ""
    echo "📝 Configuración para tu proyecto:"
    echo "   Agrega esta variable de entorno en tu backend:"
    echo "   DEEPFACE_SERVICE_URL=http://$FQDN:5001"
    echo ""
    echo "   O usa la IP directa:"
    echo "   DEEPFACE_SERVICE_URL=http://$IP_ADDRESS:5001"
    echo ""
else
    echo "⚠️  El servicio aún no está respondiendo."
    echo "   Espera unos minutos y prueba manualmente:"
    echo "   curl http://$FQDN:5001/health"
    echo ""
    echo "   O verifica el estado con:"
    echo "   az container show --resource-group $RESOURCE_GROUP --name $CONTAINER_NAME --query containers[0].instanceView.currentState"
    echo ""
fi

