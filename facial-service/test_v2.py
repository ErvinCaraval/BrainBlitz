#!/usr/bin/env python3
"""
Script de prueba para facial-service v2.0
Demuestra: caché, rate limiting, métricas
"""
import requests
import time
import base64
import json
from pathlib import Path

# Configuración
API_URL = "http://localhost:5001"
TEST_IMAGE_PATH = "./test_image.jpg"  # Cambia a tu imagen de prueba

def read_image_as_base64(image_path):
    """Lee una imagen y la convierte a Base64"""
    with open(image_path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def test_health():
    """Prueba endpoint de salud"""
    print("\n=== TEST: Health Check ===")
    response = requests.get(f"{API_URL}/health")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_metrics():
    """Prueba endpoint de métricas"""
    print("\n=== TEST: Metrics ===")
    response = requests.get(f"{API_URL}/metrics")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_register(image_path, user_id="test_user_001"):
    """Prueba registro de cara"""
    print(f"\n=== TEST: Register (user: {user_id}) ===")
    
    if not Path(image_path).exists():
        print(f"❌ Archivo no encontrado: {image_path}")
        return None
    
    image_b64 = read_image_as_base64(image_path)
    
    payload = {
        "image": image_b64,
        "user_id": user_id
    }
    
    response = requests.post(f"{API_URL}/register", json=payload)
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Success: {data.get('success')}")
    print(f"Processing time: {data.get('processing_time_ms')}ms")
    
    return data

def test_cache_hit(image_path, user_id="test_user_001"):
    """Prueba que el caché funciona (mismo usuario, misma imagen)"""
    print(f"\n=== TEST: Cache Hit (misma imagen, debería ser <100ms) ===")
    
    image_b64 = read_image_as_base64(image_path)
    
    payload = {
        "image": image_b64,
        "user_id": user_id
    }
    
    start = time.time()
    response = requests.post(f"{API_URL}/register", json=payload)
    elapsed = (time.time() - start) * 1000
    
    print(f"Status: {response.status_code}")
    data = response.json()
    print(f"Success: {data.get('success')}")
    print(f"Total latency: {elapsed:.2f}ms")
    print(f"Processing time reported: {data.get('processing_time_ms')}ms")
    print(f"✓ Cache hit detected!" if elapsed < 100 else "❌ Cache miss")

def test_clear_cache():
    """Prueba limpieza de caché"""
    print("\n=== TEST: Clear Cache ===")
    response = requests.post(f"{API_URL}/cache/clear")
    print(f"Status: {response.status_code}")
    print(json.dumps(response.json(), indent=2))

def test_concurrent_requests(image_path, num_requests=3):
    """Simula múltiples usuarios simultáneos"""
    print(f"\n=== TEST: Concurrent Requests ({num_requests} usuarios) ===")
    
    if not Path(image_path).exists():
        print(f"❌ Archivo no encontrado: {image_path}")
        return
    
    import concurrent.futures
    
    image_b64 = read_image_as_base64(image_path)
    
    def register_user(user_id):
        payload = {
            "image": image_b64,
            "user_id": user_id
        }
        start = time.time()
        response = requests.post(f"{API_URL}/register", json=payload)
        elapsed = (time.time() - start) * 1000
        return {
            "user_id": user_id,
            "status": response.status_code,
            "latency_ms": elapsed,
            "success": response.json().get('success')
        }
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_requests) as executor:
        futures = [
            executor.submit(register_user, f"concurrent_user_{i}")
            for i in range(num_requests)
        ]
        
        results = [f.result() for f in concurrent.futures.as_completed(futures)]
    
    for result in sorted(results, key=lambda x: x['user_id']):
        print(f"  {result['user_id']}: {result['status']} - {result['latency_ms']:.2f}ms - {'✓' if result['success'] else '❌'}")

def run_all_tests(image_path=TEST_IMAGE_PATH):
    """Ejecuta todos los tests"""
    print("=" * 60)
    print("FACIAL-SERVICE v2.0 - TEST SUITE")
    print("=" * 60)
    
    try:
        test_health()
        test_metrics()
        
        if not Path(image_path).exists():
            print(f"\n⚠️  Archivo de prueba no encontrado: {image_path}")
            print("Para hacer tests completos, proporciona una imagen válida")
            print("Uso: python test_v2.py <ruta_imagen>")
        else:
            # Tests con imagen
            test_register(image_path, "user_test_001")
            time.sleep(1)
            test_cache_hit(image_path, "user_test_001")  # Debe ser rápido
            test_metrics()
            test_concurrent_requests(image_path, num_requests=3)
            test_metrics()
            test_clear_cache()
        
        print("\n" + "=" * 60)
        print("✓ TESTS COMPLETADOS")
        print("=" * 60)
        
    except requests.exceptions.ConnectionError:
        print(f"❌ No se puede conectar a {API_URL}")
        print("Asegúrate de que facial-service esté corriendo")

if __name__ == '__main__':
    import sys
    image_path = sys.argv[1] if len(sys.argv) > 1 else TEST_IMAGE_PATH
    run_all_tests(image_path)
