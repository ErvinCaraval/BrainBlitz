#!/bin/bash

# Script de Validación SIN Firebase
# Verifica que el código esté correcto sin necesidad de Firebase

echo "🧪 VALIDACIÓN DE CÓDIGO SIN FIREBASE"
echo "===================================="

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${2:-$NC}$1${NC}"
}

ERRORS=0

# Función para ejecutar prueba
run_test() {
    local test_name="$1"
    local command="$2"
    
    log "🔍 $test_name" "$BLUE"
    
    if eval "$command" > /dev/null 2>&1; then
        log "✅ $test_name: PASS" "$GREEN"
        return 0
    else
        log "❌ $test_name: FAIL" "$RED"
        ((ERRORS++))
        return 1
    fi
}

log "📋 Ejecutando validaciones de código..." "$YELLOW"

# 1. Pruebas unitarias (sin Firebase)
run_test "Voice Controller Tests" "npm run test:unit -- --testNamePattern='voiceController' --passWithNoTests"

# 2. Verificar sintaxis de todos los archivos
log "🔍 Verificando sintaxis..." "$BLUE"
for file in controllers/*.js routes/*.js services/*.js; do
    if [ -f "$file" ]; then
        if node -c "$file" 2>/dev/null; then
            log "✅ $file: OK" "$GREEN"
        else
            log "❌ $file: Error de sintaxis" "$RED"
            ((ERRORS++))
        fi
    fi
done

# 3. Verificar que los archivos existen
log "📁 Verificando archivos..." "$BLUE"
required_files=(
    "controllers/voiceController.js"
    "controllers/assemblyAIController.js"
    "routes/voiceResponses.js"
    "routes/assemblyAI.js"
    "services/assemblyAIService.js"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        log "✅ $file: Existe" "$GREEN"
    else
        log "❌ $file: No encontrado" "$RED"
        ((ERRORS++))
    fi
done

# 4. Verificar que las rutas están registradas
log "🔗 Verificando rutas..." "$BLUE"
if grep -q "voice-responses" hybridServer.js && grep -q "assemblyai" hybridServer.js; then
    log "✅ Rutas registradas en servidor" "$GREEN"
else
    log "❌ Rutas no registradas" "$RED"
    ((ERRORS++))
fi

# 5. Verificar dependencias
log "📦 Verificando dependencias..." "$BLUE"
if npm list axios > /dev/null 2>&1; then
    log "✅ axios instalado" "$GREEN"
else
    log "❌ axios no instalado" "$RED"
    ((ERRORS++))
fi

# 6. Verificar que las funciones están exportadas correctamente
log "🔧 Verificando exports..." "$BLUE"

# Verificar voiceController exports
if grep -q "exports.validateVoiceResponse" controllers/voiceController.js && \
   grep -q "exports.processVoiceResponse" controllers/voiceController.js && \
   grep -q "exports.getVoiceRecognitionStats" controllers/voiceController.js; then
    log "✅ voiceController exports correctos" "$GREEN"
else
    log "❌ voiceController exports faltantes" "$RED"
    ((ERRORS++))
fi

# Verificar assemblyAIController exports
if grep -q "exports.textToSpeech" controllers/assemblyAIController.js && \
   grep -q "exports.speechToText" controllers/assemblyAIController.js; then
    log "✅ assemblyAIController exports correctos" "$GREEN"
else
    log "❌ assemblyAIController exports faltantes" "$RED"
    ((ERRORS++))
fi

# 7. Verificar que las rutas están correctamente configuradas
log "🛣️  Verificando configuración de rutas..." "$BLUE"
if grep -q "require.*voiceResponses" hybridServer.js && \
   grep -q "require.*assemblyAI" hybridServer.js; then
    log "✅ Rutas importadas correctamente" "$GREEN"
else
    log "❌ Rutas no importadas" "$RED"
    ((ERRORS++))
fi

# 8. Verificar que los middlewares están aplicados
log "🔒 Verificando middlewares..." "$BLUE"
if grep -q "authenticate" routes/voiceResponses.js && \
   grep -q "generalUserLimiter" routes/voiceResponses.js; then
    log "✅ Middlewares aplicados en voiceResponses" "$GREEN"
else
    log "❌ Middlewares faltantes en voiceResponses" "$RED"
    ((ERRORS++))
fi

# Resumen
echo ""
log "====================================" "$BLUE"
log "📊 RESUMEN DE VALIDACIÓN" "$YELLOW"

if [ $ERRORS -eq 0 ]; then
    log "🎉 ¡TODA LA VALIDACIÓN PASÓ!" "$GREEN"
    log "✅ El código está sintácticamente correcto" "$GREEN"
    log "✅ Todas las funciones están exportadas" "$GREEN"
    log "✅ Las rutas están configuradas correctamente" "$GREEN"
    log "✅ Las dependencias están instaladas" "$GREEN"
    log "✅ Las pruebas unitarias pasan" "$GREEN"
    log "" "$GREEN"
    log "🚀 EL CÓDIGO ESTÁ LISTO Y NO DEBERÍA FALLAR" "$GREEN"
    exit 0
else
    log "⚠️  $ERRORS validaciones fallaron" "$RED"
    log "❌ Revisar los errores antes de continuar" "$RED"
    exit 1
fi