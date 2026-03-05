#!/bin/bash

# Script para actualizar la configuración del backend con la URL de Azure
# Uso: ./update_backend_config.sh <URL_DEL_SERVICIO>

set -e

if [ -z "$1" ]; then
    echo "❌ Error: Debes proporcionar la URL del servicio"
    echo ""
    echo "Uso: ./update_backend_config.sh <URL>"
    echo ""
    echo "Ejemplo:"
    echo "  ./update_backend_config.sh http://facial-service-ervin.guayfkfebtc3fnda.brazilsouth.azurecontainer.io:5001"
    echo ""
    exit 1
fi

SERVICE_URL=$1
BACKEND_DIR="../backend-v1"
ENV_FILE="$BACKEND_DIR/.env"

echo "=========================================="
echo "Actualizando configuración del backend"
echo "=========================================="
echo ""

# Verificar que el directorio del backend existe
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Error: No se encuentra el directorio del backend: $BACKEND_DIR"
    exit 1
fi

echo "📝 URL del servicio: $SERVICE_URL"
echo ""

# Crear o actualizar archivo .env
if [ -f "$ENV_FILE" ]; then
    echo "📄 Archivo .env encontrado, actualizando..."
    
    # Si ya existe DEEPFACE_SERVICE_URL, actualizarla
    if grep -q "DEEPFACE_SERVICE_URL" "$ENV_FILE"; then
        # Actualizar la línea existente
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|DEEPFACE_SERVICE_URL=.*|DEEPFACE_SERVICE_URL=$SERVICE_URL|" "$ENV_FILE"
        else
            # Linux
            sed -i "s|DEEPFACE_SERVICE_URL=.*|DEEPFACE_SERVICE_URL=$SERVICE_URL|" "$ENV_FILE"
        fi
        echo "✅ Variable DEEPFACE_SERVICE_URL actualizada"
    else
        # Agregar la variable al final del archivo
        echo "" >> "$ENV_FILE"
        echo "# Servicio de reconocimiento facial en Azure" >> "$ENV_FILE"
        echo "DEEPFACE_SERVICE_URL=$SERVICE_URL" >> "$ENV_FILE"
        echo "✅ Variable DEEPFACE_SERVICE_URL agregada"
    fi
else
    echo "📄 Creando archivo .env..."
    cat > "$ENV_FILE" << EOF
# Servicio de reconocimiento facial en Azure
DEEPFACE_SERVICE_URL=$SERVICE_URL
EOF
    echo "✅ Archivo .env creado"
fi

echo ""
echo "=========================================="
echo "✅ Configuración actualizada"
echo "=========================================="
echo ""
echo "📋 Contenido del archivo .env:"
echo "---"
grep "DEEPFACE_SERVICE_URL" "$ENV_FILE" || echo "DEEPFACE_SERVICE_URL=$SERVICE_URL"
echo "---"
echo ""
echo "💡 Para aplicar los cambios, reinicia tu backend"
echo ""

