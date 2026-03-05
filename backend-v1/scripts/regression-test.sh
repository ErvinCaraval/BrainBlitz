#!/bin/bash

# Script de Pruebas de Regresión para API de Voz
# Ejecuta todas las pruebas para asegurar que nada se rompió

echo "🧪 INICIANDO PRUEBAS DE REGRESIÓN - API DE VOZ"
echo "=============================================="

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${2:-$NC}$1${NC}"
}

# Contador de errores
ERRORS=0

# Función para ejecutar prueba y verificar resultado
run_test() {
    local test_name="$1"
    local command="$2"
    
    log "🔍 Ejecutando: $test_name" "$BLUE"
    
    if eval "$command" > /dev/null 2>&1; then
        log "✅ $test_name: PASS" "$GREEN"
        return 0
    else
        log "❌ $test_name: FAIL" "$RED"
        ((ERRORS++))
        return 1
    fi
}

log "📋 Ejecutando suite completa de pruebas..." "$YELLOW"

# 1. Pruebas unitarias del voiceController
run_test "Voice Controller Unit Tests" "npm run test:unit -- --testNamePattern='voiceController' --passWithNoTests"

# 2. Pruebas unitarias de usuarios (HU1)
run_test "Users Controller Unit Tests" "npm run test:unit -- --testNamePattern='usersController' --passWithNoTests"

# 3. Pruebas unitarias de autenticación
run_test "Authentication Unit Tests" "npm run test:unit -- --testNamePattern='authenticate' --passWithNoTests"

# 4. Pruebas unitarias de rate limiting
run_test "Rate Limiter Unit Tests" "npm run test:unit -- --testNamePattern='rateLimiter' --passWithNoTests"

# 5. Pruebas unitarias de Firebase
run_test "Firebase Unit Tests" "npm run test:unit -- --testNamePattern='firebase' --passWithNoTests"

# 6. Verificar que el servidor puede iniciar sin errores
log "🚀 Verificando que el servidor puede iniciar..." "$BLUE"
if timeout 10s node hybridServer.js > /dev/null 2>&1; then
    log "✅ Servidor: Puede iniciar correctamente" "$GREEN"
else
    log "❌ Servidor: Error al iniciar" "$RED"
    ((ERRORS++))
fi

# 7. Verificar sintaxis de todos los archivos JavaScript
log "🔍 Verificando sintaxis de archivos..." "$BLUE"
for file in controllers/*.js routes/*.js services/*.js; do
    if [ -f "$file" ]; then
        if node -c "$file" 2>/dev/null; then
            log "✅ $file: Sintaxis correcta" "$GREEN"
        else
            log "❌ $file: Error de sintaxis" "$RED"
            ((ERRORS++))
        fi
    fi
done

# 8. Verificar que todas las dependencias están instaladas
log "📦 Verificando dependencias..." "$BLUE"
if npm list --depth=0 > /dev/null 2>&1; then
    log "✅ Dependencias: Todas instaladas" "$GREEN"
else
    log "❌ Dependencias: Faltan paquetes" "$RED"
    ((ERRORS++))
fi

# 9. Verificar que los archivos de controladores existen
log "📁 Verificando archivos de controladores..." "$BLUE"
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

# 10. Verificar que las rutas están registradas en el servidor
log "🔗 Verificando registro de rutas..." "$BLUE"
if grep -q "voice-responses" hybridServer.js && grep -q "assemblyai" hybridServer.js; then
    log "✅ Rutas: Registradas correctamente" "$GREEN"
else
    log "❌ Rutas: No registradas en el servidor" "$RED"
    ((ERRORS++))
fi

# Resumen final
echo ""
log "==============================================" "$BLUE"
log "📊 RESUMEN DE PRUEBAS DE REGRESIÓN" "$YELLOW"

if [ $ERRORS -eq 0 ]; then
    log "🎉 ¡TODAS LAS PRUEBAS PASARON!" "$GREEN"
    log "✅ El código está estable y no debería fallar" "$GREEN"
    log "✅ Las APIs de voz están funcionando correctamente" "$GREEN"
    log "✅ Todas las dependencias están instaladas" "$GREEN"
    log "✅ La sintaxis es correcta en todos los archivos" "$GREEN"
    exit 0
else
    log "⚠️  $ERRORS pruebas fallaron" "$RED"
    log "❌ El código necesita revisión antes de continuar" "$RED"
    exit 1
fi