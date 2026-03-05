---

# 🚀 BrainBlitz
## Plataforma de Trivia Interactiva con Visión Computacional

---

## 📋 Índice

1. [Descripción del Proyecto](#descripción-del-proyecto)
2. [Arquitectura Técnica](#arquitectura-técnica)
3. [Configuración del Proyecto](#configuración-del-proyecto)
4. [Documentación Adicional](#documentación-adicional)

---

## 🚀 Inicio Rápido

### Dar permisos a los scripts
Primero, ejecuta este comando para hacer ejecutables todos los archivos `.sh`:
```bash
find . -name "*.sh" -exec chmod +x {} \;
```
**¿Qué hace?** Busca todos los archivos con extensión `.sh` en el proyecto y les da permisos de ejecución (`chmod +x`). Necesario para poder ejecutar los scripts.

### Comandos principales
```bash
# Desarrollo - Inicia todos los servicios en modo desarrollo
bash scripts/run-dev.sh

# Producción - Inicia los servicios usando imágenes de Docker Hub
bash scripts/run-prod.sh

# Limpiar - Elimina todos los contenedores, imágenes y volúmenes de Docker
bash scripts/cleanup-docker.sh

# Push - Sube todas las imágenes (backend, frontend, facial-service, redis) a Docker Hub
bash scripts/push-all-to-dockerhub.sh
```

---

## 📝 Descripción del Proyecto

**BrainBlitz** es una plataforma de trivia interactiva que integra funcionalidades avanzadas de **Visión Computacional** utilizando **Azure Computer Vision** y **DeepFace** para mejorar la experiencia de creación de preguntas y autenticación de usuarios.

### Objetivos Principales:
- ✅ Implementar autenticación biométrica mediante reconocimiento facial
- ✅ Automatizar la extracción de texto de imágenes (OCR)
- ✅ Analizar imágenes para generar preguntas automáticamente
- ✅ Detectar objetos en imágenes para crear preguntas visuales interactivas

### Tecnologías Utilizadas:
- **Backend:** Node.js, Express, Firebase
- **Frontend:** React, TailwindCSS
- **IA y Visión Computacional:**
  - Azure Computer Vision (OCR, Analyze Image, Object Detection)
  - DeepFace (Reconocimiento Facial)
  - Azure Container Instances (Despliegue de microservicios)
- **DevOps:** GitHub Actions, Docker

---

## 🏗️ Arquitectura Técnica

### Arquitectura General del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐│
│  │ FaceRegister │ │  FaceLogin   │ │ OCRQuestionCreator   ││
│  │              │ │              │ │                      ││
│  └──────────────┘ └──────────────┘ └──────────────────────┘│
│  ┌────────────────────────────┐ ┌──────────────────────────┐│
│  │ ImageAnalysisQuestionCreator│ │ObjectDetectionCreator    ││
│  │                            │ │                          ││
│  └────────────────────────────┘ └──────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js/Express)                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐│
│  │ /face/       │ │ /vision/     │ │ /vision/             ││
│  │  register    │ │  extract-text│ │  analyze-image       ││
│  │  login       │ │              │ │                      ││
│  └──────────────┘ └──────────────┘ └──────────────────────┘│
│  ┌──────────────────────────────┐                          │
│  │ /vision/detect-objects       │                          │
│  │                              │                          │
│  └──────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────┘
         │                                    │
         │                                    │
         ▼                                    ▼
┌─────────────────────┐        ┌──────────────────────────────┐
│  FACIAL SERVICE     │        │   AZURE COGNITIVE SERVICES   │
│  (DeepFace)         │        │                              │
│                     │        │  ┌────────────────────────┐  │
│  ┌───────────────┐  │        │  │ Computer Vision OCR    │  │
│  │ VGG-Face      │  │        │  │                        │  │
│  │ Embeddings    │  │        │  └────────────────────────┘  │
│  └───────────────┘  │        │  ┌────────────────────────┐  │
│                     │        │  │ Analyze Image API      │  │
│  Azure Container    │        │  │                        │  │
│  Instances          │        │  └────────────────────────┘  │
└─────────────────────┘        │  ┌────────────────────────┐  │
         │                     │  │ Object Detection API   │  │
         │                     │  │                        │  │
         ▼                     │  └────────────────────────┘  │
┌─────────────────────┐        └──────────────────────────────┘
│  FIREBASE           │
│  ┌───────────────┐  │
│  │ Auth          │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ Firestore     │  │
│  │ (Embeddings)  │  │
│  └───────────────┘  │
└─────────────────────┘
```

### Flujo de Datos por Funcionalidad

#### 1. Reconocimiento Facial

**Registro:**
```
Usuario → Cámara Web → Base64 → /api/face/register
    → Facial Service (DeepFace) → Embedding VGG-Face
    → Firebase Firestore → Confirmación
```

**Login:**
```
Usuario → Cámara Web → Base64 + Email → /api/face/login
    → Buscar Usuario en Firebase Auth
    → Obtener Embedding Almacenado
    → Facial Service (Comparación) → Verificación
    → Generar Custom Token → Autenticación Exitosa
```

#### 2. OCR - Extracción de Texto

```
Usuario → Imagen → Base64 → /api/vision/extract-text
    → Azure Computer Vision OCR API
    → Procesamiento Asíncrono (analyze → results)
    → Extracción de Texto por Líneas
    → Texto Limpio + Metadatos → Usuario
    → Pre-llenar Formulario de Pregunta
```

#### 3. Análisis de Imágenes

```
Usuario → Imagen → Base64 → /api/vision/analyze-image
    → Azure Computer Vision Analyze API
    → Extracción: Description, Tags, Categories, Objects, Colors
    → Procesamiento y Ordenamiento por Confianza
    → Resultados Estructurados → Usuario
    → Generación Automática de Pregunta
    → Pre-llenar Formulario con Sugerencias
```

#### 4. Detección de Objetos

```
Usuario → Imagen → Base64 → /api/vision/detect-objects
    → Azure Computer Vision Object Detection API
    → Detección de Objetos + Bounding Boxes
    → Filtrado por Confianza
    → Agrupación por Tipo
    → Visualización con Bounding Boxes → Usuario
    → Generación de Pregunta (Identificación o Conteo)
    → Pre-llenar Formulario
```

### Stack Tecnológico Completo

#### Backend:
- **Runtime:** Node.js v18+
- **Framework:** Express.js
- **Autenticación:** Firebase Admin SDK
- **Base de Datos:** Firebase Firestore
- **Validación:** express-validator
- **HTTP Client:** axios / node-fetch
- **Procesamiento de Imágenes:** Sharp (opcional)

#### Frontend:
- **Framework:** React 18+
- **Routing:** React Router v6
- **State Management:** Context API / Redux (opcional)
- **Styling:** TailwindCSS
- **HTTP Client:** axios
- **Media:** getUserMedia API (WebRTC)
- **Canvas:** HTML5 Canvas (para bounding boxes)

#### Servicios de IA:
- **DeepFace:** Python-based facial recognition library
- **Azure Computer Vision:** v3.2
  - OCR (Read API)
  - Analyze Image
  - Object Detection
- **Modelo Facial:** VGG-Face (embeddings de 128 dimensiones)

#### Infraestructura:
- **Hosting Backend:** Azure App Service / Cloud Run
- **Hosting Frontend:** Vercel / Netlify
- **Container Registry:** Azure Container Registry
- **Container Instances:** Azure Container Instances (facial-service)
- **Storage:** Firebase Storage (imágenes)
- **CI/CD:** GitHub Actions

#### DevOps:
- **Version Control:** Git + GitHub
- **CI/CD:** GitHub Actions (workflow automatizado)
- **Containers:** Docker
- **Monitoring:** Azure Application Insights
- **Logs:** Winston / Morgan

---

## ⚙️ Configuración del Proyecto

### Prerequisitos

```bash
# Node.js v18+
node --version

# npm v9+
npm --version

# Git
git --version

# Docker (para facial-service)
docker --version
```

### Variables de Entorno (.env)

```bash
# ==========================================
# FIREBASE CONFIGURATION
# ==========================================
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# ==========================================
# AZURE COMPUTER VISION
# ==========================================
AZURE_COMPUTER_VISION_KEY=your-azure-cv-key
AZURE_COMPUTER_VISION_ENDPOINT=https://your-region.api.cognitive.microsoft.com/

# ==========================================
# DEEPFACE FACIAL SERVICE
# ==========================================
DEEPFACE_SERVICE_URL=https://your-facial-service.azurecontainer.io

# ==========================================
# SERVER CONFIGURATION
# ==========================================
PORT=3000
NODE_ENV=production

# ==========================================
# CORS
# ==========================================
FRONTEND_URL=https://your-frontend-domain.com

# ==========================================
# RATE LIMITING
# ==========================================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Instalación Backend

```bash
# Clonar repositorio
git clone https://github.com/your-org/brainblitz.git
cd brainblitz/backend-v1

# Instalar dependencias
npm install

# Instalar dependencias específicas de Azure
npm install @azure/cognitiveservices-computervision @azure/ms-rest-js

# Instalar dependencias de Firebase
npm install firebase-admin

# Copiar y configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Ejecutar en desarrollo
npm run dev

# Ejecutar en producción
npm start
```

### Instalación Frontend

```bash
cd brainblitz/frontend-v2

# Instalar dependencias
npm install

# Instalar dependencias específicas
npm install axios react-router-dom

# Copiar y configurar variables de entorno
cp .env.example .env
# Configurar REACT_APP_API_URL

# Ejecutar en desarrollo
npm start

# Build para producción
npm run build
```

### Despliegue Facial Service (Docker)

```bash
cd brainblitz/facial-service

# Build imagen Docker
docker build -t facial-service:latest .

# Ejecutar localmente (testing)
docker run -p 5000:5000 facial-service:latest

# Push a Azure Container Registry
az acr login --name yourregistryname
docker tag facial-service:latest yourregistryname.azurecr.io/facial-service:latest
docker push yourregistryname.azurecr.io/facial-service:latest

# Desplegar en Azure Container Instances
az container create \
  --resource-group your-resource-group \
  --name facial-service \
  --image yourregistryname.azurecr.io/facial-service:latest \
  --dns-name-label facial-service-unique \
  --ports 5000
```

### Configuración de Azure Computer Vision

1. **Crear Recurso en Azure Portal:**
   - Ir a Azure Portal → Create Resource
   - Buscar "Computer Vision"
   - Crear recurso en región deseada
   - Obtener Key y Endpoint

2. **Configurar Variables de Entorno:**
   ```bash
   AZURE_COMPUTER_VISION_KEY=your-key-here
   AZURE_COMPUTER_VISION_ENDPOINT=https://your-region.api.cognitive.microsoft.com/
   ```

3. **Verificar Conectividad:**
   ```bash
   curl -X POST "https://your-region.api.cognitive.microsoft.com/vision/v3.2/analyze?visualFeatures=Description" \
     -H "Ocp-Apim-Subscription-Key: your-key" \
     -H "Content-Type: application/octet-stream" \
     --data-binary @test-image.jpg
   ```

---

## 📚 Documentación Adicional

### Endpoints API

Documentación completa disponible en:
- **Swagger UI:** `https://api.brainblitz.com/api-docs`
- **Postman Collection:** Disponible en `/docs/postman`

### Testing

```bash
# Ejecutar tests unitarios
npm test

# Ejecutar tests de integración
npm run test:integration

# Generar reporte de cobertura
npm run test:coverage
```

### Contribución

Para contribuir al proyecto:

1. Fork el repositorio
2. Crear rama desde `main`: `git checkout -b feature/nueva-funcionalidad`
3. Hacer cambios y commit: `git commit -m "feat: descripción"`
4. Push a tu fork: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request hacia `main`

### Soporte

- **Issues:** https://github.com/your-org/brainblitz/issues
- **Discussions:** https://github.com/your-org/brainblitz/discussions
- **Email:** support@brainblitz.com

---

## 📄 Licencia

Este proyecto está licenciado bajo MIT License - ver archivo [LICENSE](LICENSE) para detalles.


---

**Última Actualización:** 5 Marzo 2026  
**Versión del Documento:** 2.0  
**Estado del Proyecto:** En Desarrollo Activo 🚀
