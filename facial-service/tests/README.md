# Facial Service - Test Suite

Pruebas comprehensivas para el servicio de reconocimiento facial (DeepFace).

## 📋 Estructura

```
tests/
├── __init__.py                 # Inicializador del módulo
├── test_unit.py              # Pruebas unitarias (10 tests)
├── test_integration.py       # Pruebas de integración (10 tests)
├── RUN_TESTS.sh             # Script runner de pruebas
└── fixtures/                # Datos de prueba
    └── test_face.jpg        # Imagen de prueba (opcional)
```

## 🧪 Pruebas Unitarias (test_unit.py)

| # | Test | Descripción |
|---|------|-------------|
| 1 | `test_import_deepface` | Verifica que DeepFace se importa correctamente |
| 2 | `test_import_api_module` | Verifica que el módulo API se importa |
| 3 | `test_configuration_loading` | Verifica que la configuración se carga |
| 4 | `test_base64_encoding` | Verifica codificación Base64 |
| 5 | `test_json_serialization` | Verifica serialización JSON |
| 6 | `test_error_handling_structure` | Verifica estructura de errores |
| 7 | `test_response_format` | Verifica formato de respuestas |
| 8 | `test_metrics_collection` | Verifica recolección de métricas |
| 9 | `test_rate_limiting_structure` | Verifica estructura de rate limiting |
| 10 | `test_caching_structure` | Verifica estructura de caché |

## 🔗 Pruebas de Integración (test_integration.py)

| # | Test | Descripción |
|---|------|-------------|
| 1 | `test_health_endpoint_exists` | Verifica que /health es accesible |
| 2 | `test_register_endpoint_structure` | Verifica estructura de /register |
| 3 | `test_verify_endpoint_structure` | Verifica estructura de /verify |
| 4 | `test_compare_endpoint_structure` | Verifica estructura de /compare |
| 5 | `test_metrics_endpoint_fields` | Verifica campos de /metrics |
| 6 | `test_error_response_structure` | Verifica estructura de errores |
| 7 | `test_success_response_structure` | Verifica estructura de éxito |
| 8 | `test_embedding_format` | Verifica formato de embeddings |
| 9 | `test_confidence_score_range` | Verifica rango de confianza |
| 10 | `test_request_timeout_handling` | Verifica manejo de timeouts |

## 🚀 Ejecutar Pruebas

### Con Script Bash (Recomendado)

```bash
cd facial-service
chmod +x tests/RUN_TESTS.sh
./tests/RUN_TESTS.sh
```

### Manualmente

```bash
# Pruebas unitarias
python3 tests/test_unit.py -v

# Pruebas de integración
python3 tests/test_integration.py -v

# Con pytest (si está instalado)
pytest tests/ -v
```

## ✅ Resultados Esperados

```
========================================
Facial Service - Test Summary
========================================

✅ PASSED: 20
📊 TOTAL: 20

========================================
```

## 🔄 Integración con CI/CD

Las pruebas se ejecutan automáticamente en:

1. **GitHub Actions** (workflow: `test.yml`)
   - Corre en cada push a `main` y `develop`
   - Corre en cada pull request

2. **Flujo de ejecución:**
   - Backend tests (Node.js)
   - Vision tests (Node.js)
   - Facial tests (Python) ← Aquí van estas pruebas

## 📊 Cobertura

Cada test valida:
- ✅ Importación de módulos
- ✅ Configuración
- ✅ Validación de datos
- ✅ Formato de respuestas
- ✅ Manejo de errores
- ✅ Métricas
- ✅ Rate limiting
- ✅ Caché
- ✅ Timeouts
- ✅ Embeddings

## 🛠️ Dependencias

```bash
# Instalar dependencias
pip3 install -r requirements.txt

# Dependencias principales
- deepface
- tensorflow
- numpy
- opencv-python
- pytest (opcional, para correr tests)
```

## 📝 Notas

- Los tests están diseñados para NO requerir conexión a servidor
- Todas las validaciones son sincrácticas (no asincrónicas)
- Compatible con Python 3.8+
- No modifica estado del sistema
- Seguro para CI/CD

## 🔍 Debug

Si una prueba falla:

```bash
# Ver output detallado
python3 tests/test_unit.py -v

# Con traceback completo
python3 -m pytest tests/ -v --tb=long

# Solo un test específico
python3 -m pytest tests/test_unit.py::TestFacialServiceIntegration::test_import_deepface -v
```

## 📞 Soporte

Para más información, revisa:
- `/facial-service/api.py` - Implementación del servicio
- `/backend-v1/.github/workflows/test.yml` - Configuración de CI/CD
- `/README.md` - Documentación del proyecto
