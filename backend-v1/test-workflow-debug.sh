#!/bin/bash
echo "🔍 DIAGNÓSTICO DEL WORKFLOW TEST.YML,,"
echo "====================================="
echo ""
echo "1. Verificando directorio actual.:"
pwd
echo ""
echo "2. Verificando estructura de directorios:"
ls -la
echo ""
echo "3. Verificando package.json:"
if [ -f "package.json" ]; then
    echo "✅ package.json encontrado"
    echo "Scripts disponibles:"
    npm run | grep -E "(coverage|test)"
else
    echo "❌ package.json no encontrado"
fi
echo ""
echo "4. Verificando si estamos en backend-v1:"
if [ -d "backend-v1" ]; then
    echo "✅ Directorio backend-v1 encontrado"
    echo "Contenido de backend-v1:"
    ls -la backend-v1/
    echo ""
    echo "Verificando package.json en backend-v1:"
    if [ -f "backend-v1/package.json" ]; then
        echo "✅ package.json encontrado en backend-v1"
        echo "Scripts disponibles en backend-v1:"
        cd backend-v1 && npm run | grep -E "(coverage|test)" && cd ..
    else
        echo "❌ package.json no encontrado en backend-v1"
    fi
else
    echo "❌ Directorio backend-v1 no encontrado"
fi
echo ""
echo "5. Verificando workflow test.yml:"
if [ -f ".github/workflows/test.yml" ]; then
    echo "✅ test.yml encontrado"
    echo "Comandos de cobertura en el workflow:"
    grep -n "coverage" .github/workflows/test.yml
else
    echo "❌ test.yml no encontrado"
fi
