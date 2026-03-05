#!/bin/bash

# Script para diagnosticar problemas con API Keys de IA

echo "🔍 Diagnosticando configuración de API Keys..."
echo ""

# Cargar variables del .env
if [ -f "backend-v1/.env" ]; then
    export $(grep -v '^#' backend-v1/.env | xargs)
    echo "✅ Archivo .env cargado"
else
    echo "❌ No se encontró backend-v1/.env"
    exit 1
fi

echo ""
echo "📋 Estado de API Keys:"
echo "================================"

# Verificar GROQ_API_KEY
if [ -z "$GROQ_API_KEY" ]; then
    echo "❌ GROQ_API_KEY: NO CONFIGURADA"
else
    KEY_PREVIEW="${GROQ_API_KEY:0:10}..."
    KEY_LENGTH=${#GROQ_API_KEY}
    if [[ "$GROQ_API_KEY" == gsk_* ]]; then
        echo "✅ GROQ_API_KEY: Configurada ($KEY_LENGTH caracteres)"
        echo "   Preview: $KEY_PREVIEW"
    else
        echo "⚠️  GROQ_API_KEY: Formato incorrecto (no comienza con 'gsk_')"
        echo "   Formato actual: ${GROQ_API_KEY:0:20}..."
    fi
fi

echo ""

# Verificar GROQ_MODEL
if [ -z "$GROQ_MODEL" ]; then
    echo "⚠️  GROQ_MODEL: NO CONFIGURADA (usando por defecto)"
else
    echo "✅ GROQ_MODEL: $GROQ_MODEL"
fi

echo ""

# Verificar OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY: NO CONFIGURADA (no habrá fallback)"
else
    KEY_PREVIEW="${OPENAI_API_KEY:0:10}..."
    KEY_LENGTH=${#OPENAI_API_KEY}
    if [[ "$OPENAI_API_KEY" == sk_* ]]; then
        echo "✅ OPENAI_API_KEY: Configurada ($KEY_LENGTH caracteres)"
        echo "   Preview: $KEY_PREVIEW"
    else
        echo "⚠️  OPENAI_API_KEY: Formato incorrecto (no comienza con 'sk_')"
    fi
fi

echo ""
echo "================================"
echo ""

# Probar conexión a Groq
if [ ! -z "$GROQ_API_KEY" ]; then
    echo "🧪 Probando conexión a Groq..."
    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST https://api.groq.com/openai/v1/chat/completions \
        -H "Authorization: Bearer $GROQ_API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"model": "gpt-4-1106-preview", "messages": [{"role": "user", "content": "test"}], "max_tokens": 10}' \
        2>&1)
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    case $HTTP_CODE in
        200)
            echo "✅ Conexión a Groq: OK (200)"
            ;;
        401)
            echo "❌ Conexión a Groq: FALLA (401 - Invalid API Key)"
            echo "   Acción: Genera una nueva key en https://console.groq.com"
            ;;
        429)
            echo "⚠️  Conexión a Groq: Límite de rate (429)"
            echo "   Acción: Espera un momento e intenta de nuevo"
            ;;
        *)
            echo "❌ Conexión a Groq: FALLA ($HTTP_CODE)"
            echo "   Respuesta: $(echo "$BODY" | head -c 100)..."
            ;;
    esac
else
    echo "⚠️  Groq no configurado, saltando prueba"
fi

echo ""
echo "================================"
echo ""
echo "✨ Recomendaciones:"
echo ""

if [[ "$GROQ_API_KEY" != gsk_* ]]; then
    echo "1. Actualiza GROQ_API_KEY en backend-v1/.env"
    echo "   - Ve a https://console.groq.com"
    echo "   - Crea una nueva API Key"
    echo "   - Copia exactamente (sin espacios)"
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "2. Configura OPENAI_API_KEY como fallback"
    echo "   - Ve a https://platform.openai.com/account/api-keys"
    echo "   - Crea o copia una key existente"
    echo "   - Añade a backend-v1/.env"
fi

if [ -z "$GROQ_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo "3. ⚠️  SIN API KEYS CONFIGURADAS"
    echo "   - Necesitas al menos una de Groq o OpenAI"
fi

echo ""
echo "🚀 Después de actualizar .env, reinicia el servidor:"
echo "   bash scripts/run-dev.sh"
echo ""
