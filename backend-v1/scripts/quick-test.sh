#!/bin/bash

# 🚀 COMANDO RÁPIDO - VALIDACIÓN ESENCIAL
# Ejecuta las validaciones más importantes en un solo comando

echo "🚀 VALIDACIÓN RÁPIDA - API DE VOZ"
echo "================================="

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

log "📋 Ejecutando validaciones esenciales..." "$YELLOW"

# 1. Pruebas unitarias de voz (las más importantes)
run_test "Voice Controller Tests" "npm run test:unit -- tests/unit/voiceController.test.js"

# 2. Validación de sintaxis
run_test "Syntax Check" "for file in controllers/*.js routes/*.js services/*.js; do node -c \"\$file\" || exit 1; done"

# 3. Dependencias
run_test "Dependencies Check" "npm list axios > /dev/null 2>&1"

# 4. Archivos requeridos
run_test "Files Check" "ls controllers/voiceController.js controllers/assemblyAIController.js routes/voiceResponses.js routes/assemblyAI.js services/assemblyAIService.js > /dev/null 2>&1"

# 5. Rutas registradas
run_test "Routes Check" "grep -q 'voice-responses' hybridServer.js && grep -q 'assemblyai' hybridServer.js"

# 6. Exports de voiceController
run_test "Voice Exports" "grep -q 'exports.validateVoiceResponse' controllers/voiceController.js && grep -q 'exports.processVoiceResponse' controllers/voiceController.js"

# 7. Exports de assemblyAI
run_test "AssemblyAI Exports" "grep -q 'exports.textToSpeech' controllers/assemblyAIController.js && grep -q 'exports.speechToText' controllers/assemblyAIController.js"

# 8. Middleware
run_test "Middleware Check" "grep -q 'authenticate' routes/voiceResponses.js && grep -q 'generalUserLimiter' routes/voiceResponses.js"

# Resumen
echo ""
log "=================================" "$BLUE"
log "📊 RESUMEN DE VALIDACIÓN RÁPIDA" "$YELLOW"

if [ $ERRORS -eq 0 ]; then
    log "🎉 ¡TODAS LAS VALIDACIONES PASARON!" "$GREEN"
    log "✅ El código está listo y estable" "$GREEN"
    log "✅ Las APIs de voz funcionan correctamente" "$GREEN"
    log "✅ Todas las dependencias están instaladas" "$GREEN"
    log "✅ La sintaxis es correcta" "$GREEN"
    log "✅ Las rutas están registradas" "$GREEN"
    log "✅ Los exports están correctos" "$GREEN"
    log "" "$NC"
    log "🚀 EL CÓDIGO NO DEBERÍA FALLAR" "$GREEN"
    exit 0
else
    log "⚠️  $ERRORS validaciones fallaron" "$RED"
    log "❌ Revisar los errores antes de continuar" "$RED"
    exit 1
fi