#!/bin/bash
# 🚀 Quick Start Guide - Facial Service v2.0

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  🚀 Facial Service v2.0 - Quick Start                      ║"
echo "║     Escalable • Caché • Rate Limiting • Producción Ready   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Prerequisites
echo -e "${BLUE}Step 1: Verificando prerrequisitos...${NC}"
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi
echo "✅ Docker disponible"

if ! command -v curl &> /dev/null; then
    echo "❌ curl no está instalado"
    exit 1
fi
echo "✅ curl disponible"

echo ""

# Step 2: Validate implementation
echo -e "${BLUE}Step 2: Validando implementación...${NC}"
if [ ! -f "api.py" ]; then
    echo "❌ api.py no encontrado"
    exit 1
fi
echo "✅ api.py presente"

if [ ! -f "docker-compose.yml" ]; then
    echo "❌ docker-compose.yml no encontrado"
    exit 1
fi
echo "✅ docker-compose.yml presente"

if [ ! -f "Dockerfile" ]; then
    echo "❌ Dockerfile no encontrado"
    exit 1
fi
echo "✅ Dockerfile presente"

echo ""

# Step 3: Start service
echo -e "${BLUE}Step 3: Iniciando servicio...${NC}"
echo "⏳ Esto puede tomar 1-2 minutos la primera vez..."
echo ""

docker compose up --build 

echo ""
echo "⏳ Esperando a que el servicio esté listo (healthcheck)..."
sleep 5

# Wait for health check
max_attempts=12
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:5001/health > /dev/null 2>&1; then
        echo "✅ Servicio listo!"
        break
    fi
    attempt=$((attempt + 1))
    echo "⏳ Intento $attempt/$max_attempts..."
    sleep 5
done

if [ $attempt -ge $max_attempts ]; then
    echo "❌ Timeout - El servicio no está respondiendo"
    echo "Para ver los logs:"
    echo "  docker logs facial-recognition-service"
    exit 1
fi

echo ""

# Step 4: Show status
echo -e "${BLUE}Step 4: Estado del servicio${NC}"
echo ""

echo "🔗 Health Check:"
curl -s http://localhost:5001/health | jq . 2>/dev/null || curl -s http://localhost:5001/health
echo ""

echo "📊 Metrics:"
curl -s http://localhost:5001/metrics | jq . 2>/dev/null || curl -s http://localhost:5001/metrics
echo ""

# Step 5: Summary
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  ✅ Facial Service v2.0 está corriendo                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo -e "${YELLOW}📝 Próximos pasos:${NC}"
echo ""
echo "1️⃣  Ver logs en vivo:"
echo "    docker logs -f facial-recognition-service"
echo ""
echo "2️⃣  Registrar un usuario:"
echo "    curl -X POST http://localhost:5001/register \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"image\": \"data:image/jpeg;base64,...\", \"user_id\": \"user_1\"}'"
echo ""
echo "3️⃣  Verificar caras:"
echo "    curl -X POST http://localhost:5001/verify \\"
echo "      -H 'Content-Type: application/json' \\"
echo "      -d '{\"img1\": \"...\", \"img2\": \"...\"}'"
echo ""
echo "4️⃣  Ejecutar tests (si tienes una imagen):"
echo "    python test_v2.py /ruta/a/imagen.jpg"
echo ""
echo "5️⃣  Monitorear performance:"
echo "    watch -n 1 'curl -s http://localhost:5001/metrics | jq .'"
echo ""
echo "6️⃣  Limpiar caché (si es necesario):"
echo "    curl -X POST http://localhost:5001/cache/clear"
echo ""
echo "7️⃣  Parar el servicio:"
echo "    docker compose down"
echo ""

echo -e "${YELLOW}📚 Documentación:${NC}"
echo "  - README_v2.0.md          → Guía completa"
echo "  - IMPROVEMENTS_v2.0.md    → Detalles técnicos"
echo "  - COMPARISON_v1_vs_v2.md  → Comparación v1 vs v2"
echo "  - CHEATSHEET.md           → Referencia rápida"
echo ""

echo "🎯 API Base URL: http://localhost:5001"
echo ""
echo "Endpoints disponibles:"
echo "  GET  /health       - Estado del servicio"
echo "  GET  /metrics      - Métricas en tiempo real"
echo "  POST /register     - Registrar una cara"
echo "  POST /verify       - Verificar dos caras"
echo "  POST /cache/clear  - Limpiar caché"
echo ""
