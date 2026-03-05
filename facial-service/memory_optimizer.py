# Configuración de Optimización de Memoria para Facial-Service
# Para ejecutar: python api.py --max-workers=2 --cache-size=500

import os
import psutil
import gc
from functools import wraps

class MemoryOptimizer:
    """Gestor de memoria para Facial-Service"""
    
    # Límites de memoria (en MB)
    WARNING_THRESHOLD = 500  # Advertencia
    CRITICAL_THRESHOLD = 700  # Crítico
    MAX_MEMORY = 800  # Máximo absoluto
    
    @staticmethod
    def get_memory_usage():
        """Obtiene uso de memoria actual en MB"""
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024)
    
    @staticmethod
    def log_memory(label=""):
        """Loguea el uso actual de memoria"""
        usage = MemoryOptimizer.get_memory_usage()
        status = "🟢"
        if usage > MemoryOptimizer.CRITICAL_THRESHOLD:
            status = "🔴"
        elif usage > MemoryOptimizer.WARNING_THRESHOLD:
            status = "🟡"
        
        print(f"{status} Memory {label}: {usage:.1f}MB / {MemoryOptimizer.MAX_MEMORY}MB")
        return usage
    
    @staticmethod
    def cleanup_memory():
        """Fuerza limpieza de memoria"""
        gc.collect()
        MemoryOptimizer.log_memory("after cleanup")
    
    @staticmethod
    def memory_guard(func):
        """Decorator que monitorea memoria en funciones críticas"""
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_mem = MemoryOptimizer.get_memory_usage()
            
            try:
                result = func(*args, **kwargs)
                return result
            finally:
                end_mem = MemoryOptimizer.get_memory_usage()
                delta = end_mem - start_mem
                
                if delta > 50:
                    print(f"⚠️ {func.__name__} used {delta:.1f}MB")
                
                if end_mem > MemoryOptimizer.WARNING_THRESHOLD:
                    MemoryOptimizer.cleanup_memory()
        
        return wrapper
    
    @staticmethod
    def monitor_memory_loop(check_interval=30):
        """Monitorea memoria continuamente en background"""
        import threading
        
        def monitor():
            while True:
                try:
                    usage = MemoryOptimizer.get_memory_usage()
                    
                    if usage > MemoryOptimizer.CRITICAL_THRESHOLD:
                        print(f"\n🔴 CRITICAL: Memory {usage:.1f}MB > {MemoryOptimizer.CRITICAL_THRESHOLD}MB")
                        MemoryOptimizer.cleanup_memory()
                    elif usage > MemoryOptimizer.WARNING_THRESHOLD:
                        print(f"\n🟡 WARNING: Memory {usage:.1f}MB > {MemoryOptimizer.WARNING_THRESHOLD}MB")
                        MemoryOptimizer.cleanup_memory()
                    
                    import time
                    time.sleep(check_interval)
                except Exception as e:
                    print(f"Memory monitor error: {e}")
        
        thread = threading.Thread(target=monitor, daemon=True)
        thread.start()


class ImageOptimizer:
    """Optimiza procesamiento de imágenes para reducir memoria"""
    
    @staticmethod
    def compress_base64_image(base64_string, max_size=(640, 480)):
        """
        Comprime imagen Base64 antes de procesar
        Reduce tamaño en memoria ~70-80%
        """
        import cv2
        import numpy as np
        import base64
        
        try:
            # Decodificar Base64
            img_data = base64.b64decode(base64_string.split(',')[-1])
            nparr = np.frombuffer(img_data, np.uint8)
            
            # Decodificar imagen
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                return None
            
            # Obtener tamaño original
            h, w = img.shape[:2]
            
            # Si es muy grande, redimensionar
            if h > max_size[1] or w > max_size[0]:
                img = cv2.resize(img, max_size, interpolation=cv2.INTER_AREA)
            
            # Encodificar a Base64
            _, img_encoded = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            compressed_base64 = base64.b64encode(img_encoded).decode()
            
            # Limpiar
            del nparr, img_data, img_encoded, img
            gc.collect()
            
            return f"data:image/jpeg;base64,{compressed_base64}"
        
        except Exception as e:
            print(f"Image compression error: {e}")
            return None
    
    @staticmethod
    def process_image_safely(image_base64, processor_func):
        """
        Procesa imagen con limpieza automática de memoria
        """
        import tempfile
        import os
        
        temp_file = None
        try:
            # Guardar en archivo temporal para reducir memoria
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.jpg')
            
            import base64
            import cv2
            import numpy as np
            
            img_data = base64.b64decode(image_base64.split(',')[-1])
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            cv2.imwrite(temp_file.name, img)
            
            # Procesar
            result = processor_func(temp_file.name)
            
            return result
        
        finally:
            # Limpiar
            if temp_file and os.path.exists(temp_file.name):
                os.unlink(temp_file.name)
            gc.collect()


# Configuración optimizada para Docker en Render
OPTIMAL_CONFIG = {
    "max_workers": 2,  # Limitar a 2 workers para evitar overhead
    "cache_size": 500,  # Caché pequeño (500 embeddings max)
    "cache_ttl": 1800,  # TTL corto (30 minutos)
    "batch_size": 1,   # Procesar de 1 en 1
    "memory_check_interval": 30,  # Revisar cada 30 segundos
}

if __name__ == "__main__":
    # Test
    print("Memory Optimizer initialized")
    MemoryOptimizer.log_memory("startup")
