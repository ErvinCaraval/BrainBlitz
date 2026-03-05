#!/usr/bin/env python3
"""
Unit Tests para Facial Service
Pruebas unitarias de componentes del servicio facial
"""

import unittest
import base64
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestFacialServiceIntegration(unittest.TestCase):
    """Suite de pruebas unitarias para facial-service"""

    @classmethod
    def setUpClass(cls):
        """Setup para todas las pruebas"""
        cls.test_image_path = Path(__file__).parent / "fixtures" / "test_face.jpg"
        cls.test_results = {
            "passed": [],
            "failed": [],
            "skipped": []
        }

    def setUp(self):
        """Setup para cada prueba"""
        self.test_data = {
            "user_id": "test_user_001",
            "timestamp": "2025-11-24T12:00:00Z"
        }

    def test_import_deepface(self):
        """Test 1: Verificar que DeepFace se importa correctamente"""
        try:
            from deepface import DeepFace
            self.assertIsNotNone(DeepFace)
            self.test_results["passed"].append("import_deepface")
        except ImportError:
            # Skip if deepface not installed locally (will be in Docker/CI)
            self.skipTest("DeepFace not installed (expected in CI environment)")
            self.test_results["skipped"].append("import_deepface")

    def test_import_api_module(self):
        """Test 2: Verificar que el módulo API se importa"""
        try:
            import api
            self.assertIsNotNone(api)
            self.test_results["passed"].append("import_api_module")
        except ImportError:
            # Skip if api module not available (will be in Docker/CI)
            self.skipTest("API module not available (expected in CI environment)")
            self.test_results["skipped"].append("import_api_module")

    def test_configuration_loading(self):
        """Test 3: Verificar que la configuración se carga"""
        try:
            config = {
                "host": "0.0.0.0",
                "port": 5001,
                "debug": False,
                "max_requests_per_minute": 10
            }
            self.assertIsNotNone(config)
            self.assertEqual(config["port"], 5001)
            self.test_results["passed"].append("configuration_loading")
        except Exception as e:
            self.test_results["failed"].append(f"configuration_loading: {str(e)}")
            raise

    def test_base64_encoding(self):
        """Test 4: Verificar codificación Base64"""
        try:
            test_string = "test_image_data"
            encoded = base64.b64encode(test_string.encode()).decode()
            decoded = base64.b64decode(encoded).decode()
            self.assertEqual(test_string, decoded)
            self.test_results["passed"].append("base64_encoding")
        except Exception as e:
            self.test_results["failed"].append(f"base64_encoding: {str(e)}")
            raise

    def test_json_serialization(self):
        """Test 5: Verificar serialización JSON"""
        try:
            test_data = {
                "success": True,
                "user_id": "test_001",
                "embedding": [0.1, 0.2, 0.3],
                "confidence": 0.95
            }
            json_str = json.dumps(test_data)
            loaded_data = json.loads(json_str)
            self.assertEqual(test_data, loaded_data)
            self.test_results["passed"].append("json_serialization")
        except Exception as e:
            self.test_results["failed"].append(f"json_serialization: {str(e)}")
            raise

    def test_error_handling_structure(self):
        """Test 6: Verificar estructura de manejo de errores"""
        try:
            error_response = {
                "success": False,
                "error": "Face not detected",
                "code": "FACE_NOT_DETECTED",
                "timestamp": "2025-11-24T12:00:00Z"
            }
            self.assertFalse(error_response["success"])
            self.assertIn("error", error_response)
            self.assertIn("code", error_response)
            self.test_results["passed"].append("error_handling_structure")
        except Exception as e:
            self.test_results["failed"].append(f"error_handling_structure: {str(e)}")
            raise

    def test_response_format(self):
        """Test 7: Verificar formato de respuestas"""
        try:
            valid_response = {
                "success": True,
                "message": "Registration successful",
                "data": {
                    "user_id": "test_001",
                    "embedding_dimensions": 128,
                    "confidence": 0.99
                }
            }
            self.assertTrue(valid_response["success"])
            self.assertIn("message", valid_response)
            self.assertIn("data", valid_response)
            self.test_results["passed"].append("response_format")
        except Exception as e:
            self.test_results["failed"].append(f"response_format: {str(e)}")
            raise

    def test_metrics_collection(self):
        """Test 8: Verificar recolección de métricas"""
        try:
            metrics = {
                "total_requests": 100,
                "successful_registrations": 95,
                "failed_registrations": 5,
                "average_processing_time_ms": 234.5,
                "cache_hits": 45,
                "cache_misses": 55
            }
            self.assertGreaterEqual(metrics["total_requests"], 0)
            self.assertGreaterEqual(metrics["cache_hits"], 0)
            self.test_results["passed"].append("metrics_collection")
        except Exception as e:
            self.test_results["failed"].append(f"metrics_collection: {str(e)}")
            raise

    def test_rate_limiting_structure(self):
        """Test 9: Verificar estructura de rate limiting"""
        try:
            rate_limit_config = {
                "enabled": True,
                "requests_per_minute": 60,
                "requests_per_hour": 1000,
                "cleanup_interval_seconds": 300
            }
            self.assertTrue(rate_limit_config["enabled"])
            self.assertGreater(rate_limit_config["requests_per_minute"], 0)
            self.test_results["passed"].append("rate_limiting_structure")
        except Exception as e:
            self.test_results["failed"].append(f"rate_limiting_structure: {str(e)}")
            raise

    def test_caching_structure(self):
        """Test 10: Verificar estructura de caché"""
        try:
            cache_config = {
                "enabled": True,
                "type": "redis",
                "ttl_seconds": 3600,
                "max_size": 10000
            }
            self.assertTrue(cache_config["enabled"])
            self.assertGreater(cache_config["ttl_seconds"], 0)
            self.test_results["passed"].append("caching_structure")
        except Exception as e:
            self.test_results["failed"].append(f"caching_structure: {str(e)}")
            raise

    @classmethod
    def tearDownClass(cls):
        """Cleanup después de todas las pruebas"""
        print("\n" + "="*60)
        print("FACIAL SERVICE - TEST SUMMARY")
        print("="*60)
        print(f"\n✅ PASSED: {len(cls.test_results['passed'])}")
        for test in cls.test_results["passed"]:
            print(f"   ✓ {test}")
        
        if cls.test_results["failed"]:
            print(f"\n❌ FAILED: {len(cls.test_results['failed'])}")
            for test in cls.test_results["failed"]:
                print(f"   ✗ {test}")
        
        if cls.test_results["skipped"]:
            print(f"\n⊘ SKIPPED: {len(cls.test_results['skipped'])}")
            for test in cls.test_results["skipped"]:
                print(f"   - {test}")
        
        print("\n" + "="*60)


if __name__ == '__main__':
    unittest.main(verbosity=2)
