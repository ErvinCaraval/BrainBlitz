#!/bin/bash

# Script de ayuda para autenticarse en Azure
# Este script te guiará en el proceso de autenticación

echo "=========================================="
echo "Autenticación en Azure"
echo "=========================================="
echo ""

# Verificar que Azure CLI está instalado
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI no está instalado."
    echo ""
    echo "📦 Instalando Azure CLI..."
    echo "   Ejecuta este comando:"
    echo "   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash"
    echo ""
    exit 1
fi

echo "✅ Azure CLI está instalado"
echo ""

# Verificar si ya está autenticado
if az account show &> /dev/null; then
    ACCOUNT=$(az account show --query name -o tsv)
    USER=$(az account show --query user.name -o tsv)
    echo "✅ Ya estás autenticado en Azure"
    echo "   Cuenta: $ACCOUNT"
    echo "   Usuario: $USER"
    echo ""
    read -p "¿Deseas autenticarte con otra cuenta? (s/n): " respuesta
    if [[ ! "$respuesta" =~ ^[Ss]$ ]]; then
        echo "✅ Manteniendo la sesión actual"
        exit 0
    fi
    echo ""
    echo "🔓 Cerrando sesión actual..."
    az logout
    echo ""
fi

echo "🔐 Iniciando proceso de autenticación..."
echo ""
echo "📝 Se abrirá una ventana del navegador para autenticarte."
echo "   Usa estas credenciales:"
echo "   Email: ervin.caravali@correounivalle.edu.co"
echo ""
echo "   Si no se abre el navegador, sigue las instrucciones en la terminal."
echo ""
read -p "Presiona Enter para continuar..."

# Iniciar sesión
az login

# Verificar que la autenticación fue exitosa
if az account show &> /dev/null; then
    echo ""
    echo "=========================================="
    echo "✅ Autenticación exitosa!"
    echo "=========================================="
    echo ""
    ACCOUNT=$(az account show --query name -o tsv)
    USER=$(az account show --query user.name -o tsv)
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    
    echo "📋 Información de la cuenta:"
    echo "   Nombre: $ACCOUNT"
    echo "   Usuario: $USER"
    echo "   Subscription ID: $SUBSCRIPTION_ID"
    echo ""
    echo "✅ Ya puedes ejecutar ./deploy_to_azure.sh"
    echo ""
else
    echo ""
    echo "❌ Error en la autenticación"
    echo "   Intenta nuevamente con: az login"
    exit 1
fi

