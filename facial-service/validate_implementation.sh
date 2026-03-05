#!/bin/bash
# Script de validación post-implementación
# Verifica que todos los cambios se han aplicado correctamente

echo "🔍 Validando implementación de Facial Service v2.0..."
echo "=================================================="
echo ""

# Verificar archivos principales
echo "1️⃣ Verificando archivos principales..."
files=(
    "api.py"
    "Dockerfile"
    "docker-compose.yml"
    "requirements.txt"
    "test_v2.py"
    ".env.example"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ❌ $file (FALTA)"
    fi
done

echo ""
echo "2️⃣ Verificando documentación..."
docs=(
    "README_v2.0.md"
    "IMPROVEMENTS_v2.0.md"
    "COMPARISON_v1_vs_v2.md"
    "CHEATSHEET.md"
    "IMPLEMENTATION_SUMMARY.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        echo "   ✅ $doc"
    else
        echo "   ❌ $doc (FALTA)"
    fi
done

echo ""
echo "3️⃣ Validando sintaxis Python..."
if python3 -m py_compile api.py 2>/dev/null; then
    echo "   ✅ api.py - Sintaxis correcta"
else
    echo "   ❌ api.py - Error de sintaxis"
fi

if python3 -m py_compile test_v2.py 2>/dev/null; then
    echo "   ✅ test_v2.py - Sintaxis correcta"
else
    echo "   ❌ test_v2.py - Error de sintaxis"
fi

echo ""
echo "4️⃣ Verificando características principales en api.py..."

features=(
    "EmbeddingCache" "Caché"
    "ProcessingQueue" "Cola"
    "flask_limiter" "Rate Limiting"
    "logging" "Logging"
    "/health" "Health endpoint"
    "/metrics" "Metrics endpoint"
    "/cache/clear" "Cache clear endpoint"
    "cleanup_temp_files" "Limpieza de archivos"
)

for ((i=0; i<${#features[@]}; i+=2)); do
    keyword="${features[$i]}"
    name="${features[$((i+1))]}"
    if grep -q "$keyword" api.py; then
        echo "   ✅ $name"
    else
        echo "   ❌ $name (NO ENCONTRADO)"
    fi
done

echo ""
echo "5️⃣ Información de archivos..."
echo "   api.py:"
echo "     - Líneas: $(wc -l < api.py)"
echo "     - Tamaño: $(ls -lh api.py | awk '{print $5}')"
echo ""
echo "   requirements.txt:"
echo "     - Líneas: $(wc -l < requirements.txt)"
echo "     - Dependencias: $(grep -c '^' requirements.txt)"
echo ""

echo ""
echo "6️⃣ Verificando Docker configuration..."
if grep -q "max-size" docker-compose.yml; then
    echo "   ✅ Docker logging rotación"
else
    echo "   ❌ Docker logging rotación"
fi

if grep -q "deploy:" docker-compose.yml; then
    echo "   ✅ Docker resource limits"
else
    echo "   ❌ Docker resource limits"
fi

if grep -q "healthcheck:" docker-compose.yml; then
    echo "   ✅ Docker healthcheck"
else
    echo "   ❌ Docker healthcheck"
fi

echo ""
echo "=================================================="
echo "✅ Validación completada"
echo "=================================================="
echo ""
echo "📝 Próximos pasos:"
echo "   1. docker compose up --build"
echo "   2. curl http://localhost:5001/health"
echo "   3. python test_v2.py <imagen.jpg>"
echo ""
