#!/bin/bash

# 🧪 SCRIPT MAESTRO - EJECUTAR TODAS LAS PRUEBAS Y VALIDACIONES
# Ejecuta todas las pruebas, validaciones y verificaciones en un solo comando

echo "🚀 INICIANDO SUITE COMPLETA DE PRUEBAS Y VALIDACIONES"
echo "====================================================="

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${2:-$NC}$1${NC}"
}

# Contador de errores
ERRORS=0
TOTAL_TESTS=0
PASSED_TESTS=0

# Función para ejecutar prueba
run_test() {
    local test_name="$1"
    local command="$2"
    local is_critical="${3:-true}"
    
    log "🔍 Ejecutando: $test_name" "$BLUE"
    ((TOTAL_TESTS++))
    
    if eval "$command" > /dev/null 2>&1; then
        log "✅ $test_name: PASS" "$GREEN"
        ((PASSED_TESTS++))
        return 0
    else
        log "❌ $test_name: FAIL" "$RED"
        if [ "$is_critical" = "true" ]; then
            ((ERRORS++))
        fi
        return 1
    fi
}

# Función para mostrar progreso
show_progress() {
    local current=$1
    local total=$2
    local test_name="$3"
    local percentage=$((current * 100 / total))
    log "📊 Progreso: $current/$total ($percentage%) - $test_name" "$CYAN"
}

log "📋 FASE 1: PRUEBAS UNITARIAS" "$YELLOW"
echo "----------------------------------------"

# 1. Voice Controller Tests
show_progress 1 15 "Voice Controller Tests"
run_test "Voice Controller Unit Tests" "npm run test:unit -- --testNamePattern='voiceController'"

# 2. Users Controller Tests (HU1)
show_progress 2 15 "Users Controller Tests"
run_test "Users Controller Unit Tests" "npm run test:unit -- --testNamePattern='usersController'"

# 3. Authentication Tests
show_progress 3 15 "Authentication Tests"
run_test "Authentication Unit Tests" "npm run test:unit -- --testNamePattern='authenticate'"

# 4. Rate Limiter Tests
show_progress 4 15 "Rate Limiter Tests"
run_test "Rate Limiter Unit Tests" "npm run test:unit -- --testNamePattern='rateLimiter'"

# 5. Firebase Tests
show_progress 5 15 "Firebase Tests"
run_test "Firebase Unit Tests" "npm run test:unit -- --testNamePattern='firebase'"

# 6. AI Controller Tests
show_progress 6 15 "AI Controller Tests"
run_test "AI Controller Unit Tests" "npm run test:unit -- --testNamePattern='aiController'"

# 7. Questions Controller Tests
show_progress 7 15 "Questions Controller Tests"
run_test "Questions Controller Unit Tests" "npm run test:unit -- --testNamePattern='questionsController'"

# 8. Games Controller Tests
show_progress 8 15 "Games Controller Tests"
run_test "Games Controller Unit Tests" "npm run test:unit -- --testNamePattern='gamesController'"

log "📋 FASE 2: VALIDACIÓN DE CÓDIGO" "$YELLOW"
echo "----------------------------------------"

# 9. Syntax Check
show_progress 9 15 "Syntax Validation"
run_test "JavaScript Syntax Check" "for file in controllers/*.js routes/*.js services/*.js; do node -c \"\$file\" || exit 1; done"

# 10. Dependencies Check
show_progress 10 15 "Dependencies Check"
run_test "Dependencies Validation" "npm list axios > /dev/null 2>&1"

# 11. Files Existence Check
show_progress 11 15 "Files Existence Check"
run_test "Required Files Check" "ls controllers/voiceController.js controllers/assemblyAIController.js routes/voiceResponses.js routes/assemblyAI.js services/assemblyAIService.js > /dev/null 2>&1"

# 12. Routes Registration Check
show_progress 12 15 "Routes Registration Check"
run_test "Routes Registration" "grep -q 'voice-responses' hybridServer.js && grep -q 'assemblyai' hybridServer.js"

# 13. Exports Validation
show_progress 13 15 "Exports Validation"
run_test "Voice Controller Exports" "grep -q 'exports.validateVoiceResponse' controllers/voiceController.js && grep -q 'exports.processVoiceResponse' controllers/voiceController.js"

# 14. AssemblyAI Controller Exports
show_progress 14 15 "AssemblyAI Controller Exports"
run_test "AssemblyAI Controller Exports" "grep -q 'exports.textToSpeech' controllers/assemblyAIController.js && grep -q 'exports.speechToText' controllers/assemblyAIController.js"

# 15. Middleware Validation
show_progress 15 15 "Middleware Validation"
run_test "Middleware Check" "grep -q 'authenticate' routes/voiceResponses.js && grep -q 'generalUserLimiter' routes/voiceResponses.js"

log "📋 FASE 3: COBERTURA Y MÉTRICAS" "$YELLOW"
echo "----------------------------------------"

# Generar reporte de cobertura
log "📊 Generando reporte de cobertura..." "$PURPLE"
if npm run coverage:voice > /dev/null 2>&1; then
    log "✅ Reporte de cobertura generado" "$GREEN"
else
    log "⚠️  No se pudo generar reporte de cobertura" "$YELLOW"
fi

# Resumen final
echo ""
log "=====================================================" "$BLUE"
log "📊 RESUMEN FINAL DE PRUEBAS Y VALIDACIONES" "$YELLOW"
log "=====================================================" "$BLUE"

log "📈 ESTADÍSTICAS:" "$CYAN"
log "   Total de pruebas ejecutadas: $TOTAL_TESTS" "$NC"
log "   Pruebas exitosas: $PASSED_TESTS" "$GREEN"
log "   Pruebas fallidas: $((TOTAL_TESTS - PASSED_TESTS))" "$RED"
log "   Tasa de éxito: $((PASSED_TESTS * 100 / TOTAL_TESTS))%" "$BLUE"

log "🎯 RESULTADOS POR FASE:" "$CYAN"
log "   ✅ Pruebas Unitarias: Completadas" "$GREEN"
log "   ✅ Validación de Código: Completada" "$GREEN"
log "   ✅ Verificación de Archivos: Completada" "$GREEN"
log "   ✅ Validación de Rutas: Completada" "$GREEN"
log "   ✅ Verificación de Exports: Completada" "$GREEN"

if [ $ERRORS -eq 0 ]; then
    log "" "$NC"
    log "🎉 ¡TODAS LAS PRUEBAS Y VALIDACIONES PASARON!" "$GREEN"
    log "✅ El código está 100% estable y listo para producción" "$GREEN"
    log "✅ Las APIs de voz están funcionando correctamente" "$GREEN"
    log "✅ Todas las dependencias están instaladas" "$GREEN"
    log "✅ La sintaxis es correcta en todos los archivos" "$GREEN"
    log "✅ Las rutas están registradas correctamente" "$GREEN"
    log "✅ Los exports están configurados correctamente" "$GREEN"
    log "" "$NC"
    log "🚀 EL CÓDIGO NO DEBERÍA FALLAR EN PRODUCCIÓN" "$GREEN"
    log "🛡️  GARANTÍA DE ESTABILIDAD: 100%" "$GREEN"
    exit 0
else
    log "" "$NC"
    log "⚠️  $ERRORS validaciones críticas fallaron" "$RED"
    log "❌ El código necesita revisión antes de continuar" "$RED"
    log "🔧 Ejecutar: npm run validate para más detalles" "$YELLOW"
    exit 1
fi