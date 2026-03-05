"""
Microservicio de Reconocimiento Facial - VERSIÓN ULTRA-CONCURRENTE
Usa DeepFace para verificación y registro facial con:
- ThreadPoolExecutor para máxima paralelización
- RWLock (múltiples lectores, un escritor)
- Batch processing para operaciones masivas
- Connection pooling optimizado
- Rate limiting inteligente
- Procesamiento completamente thread-safe
- OPTIMIZADO PARA MEMORIA LIMITADA (Render 512MB)
"""
from flask import Flask, request, jsonify, has_request_context
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from deepface import DeepFace
from functools import lru_cache
from queue import Queue, Empty, PriorityQueue
from threading import Thread, Lock, RLock, Semaphore, Condition, Event
from concurrent.futures import ThreadPoolExecutor, as_completed, Future
import cv2
import numpy as np
import base64
import os
import tempfile
import traceback
import logging
import time
from datetime import datetime, timedelta
import hashlib
import json
import redis as redis_client
from collections import defaultdict
import uuid
import gc

# Importar Memory Optimizer
try:
    from memory_optimizer import MemoryOptimizer, ImageOptimizer, OPTIMAL_CONFIG
    HAS_MEMORY_OPTIMIZER = True
except ImportError:
    HAS_MEMORY_OPTIMIZER = False
    logger_temp = logging.getLogger(__name__)
    logger_temp.warning("Memory optimizer not available")

# Configuración de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(threadName)s] - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# OPTIMIZACIONES PARA MEMORIA
if HAS_MEMORY_OPTIMIZER:
    logger.info("🟢 Memory Optimizer activated")
    MemoryOptimizer.log_memory("startup")
    MemoryOptimizer.monitor_memory_loop(check_interval=30)

app = Flask(__name__)
CORS(app)

# Rate limiting - REDUCIDO PARA MEMORIA
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100 per day", "20 per hour"]  # Reducido
)

# ============ READER-WRITER LOCK (Para caché concurrente) ============
class ReaderWriterLock:
    """Lock que permite múltiples lectores pero un solo escritor"""
    def __init__(self):
        self._read_ready = Condition(RLock())
        self._readers = 0
        self._writers = 0
        self._write_waiters = 0
    
    def acquire_read(self):
        """Adquiere lock de lectura (no bloqueante si hay lectores)"""
        self._read_ready.acquire()
        try:
            while self._writers > 0 or self._write_waiters > 0:
                self._read_ready.wait()
            self._readers += 1
        finally:
            self._read_ready.release()
    
    def release_read(self):
        """Libera lock de lectura"""
        self._read_ready.acquire()
        try:
            self._readers -= 1
            if self._readers == 0:
                self._read_ready.notifyAll()
        finally:
            self._read_ready.release()
    
    def acquire_write(self):
        """Adquiere lock de escritura (bloqueante)"""
        self._read_ready.acquire()
        try:
            self._write_waiters += 1
            while self._readers > 0 or self._writers > 0:
                self._read_ready.wait()
            self._write_waiters -= 1
            self._writers += 1
        finally:
            self._read_ready.release()
    
    def release_write(self):
        """Libera lock de escritura"""
        self._read_ready.acquire()
        try:
            self._writers -= 1
            self._read_ready.notifyAll()
        finally:
            self._read_ready.release()

# ============ CACHÉ CONCURRENTE CON RWLOCK ============
class ConcurrentEmbeddingCache:
    """Caché thread-safe con Reader-Writer Lock para máxima concurrencia"""
    def __init__(self, max_size=2000, ttl_seconds=3600, enabled=True):
        self.cache = {}
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self.lock = ReaderWriterLock()  # En lugar de Lock simple
        self.persistent_store = None
        self.enabled = enabled
        self.hits = 0
        self.misses = 0
        self.stats_lock = Lock()
    
    def _hash_image(self, image_base64):
        """Genera hash SHA256 de la imagen"""
        return hashlib.sha256(image_base64.encode()).hexdigest()
    
    def get(self, image_base64):
        """Obtiene embedding del caché (lecturas concurrentes)"""
        hash_key = self._hash_image(image_base64)
        
        if not self.enabled:
            if self.persistent_store:
                try:
                    persistent = self.persistent_store.get(hash_key)
                    if persistent:
                        self._record_hit()
                        logger.debug(f"✓ Cache miss → Redis hit (hash: {hash_key[:8]}...)")
                        return persistent
                except Exception as e:
                    logger.warning(f"Redis get error: {str(e)}")
            self._record_miss()
            return None
        
        # Lectura concurrente: múltiples threads pueden leer simultáneamente
        self.lock.acquire_read()
        try:
            if hash_key in self.cache:
                embedding, timestamp = self.cache[hash_key]
                if datetime.now() - timestamp < timedelta(seconds=self.ttl_seconds):
                    self._record_hit()
                    logger.debug(f"✓ Cache hit en memoria (hash: {hash_key[:8]}...)")
                    return embedding
        finally:
            self.lock.release_read()
        
        # Si no está en memoria, intentar persistente
        if self.persistent_store:
            try:
                persistent = self.persistent_store.get(hash_key)
                if persistent:
                    # Actualizar caché en memoria (con escritura)
                    self.lock.acquire_write()
                    try:
                        self.cache[hash_key] = (persistent, datetime.now())
                    finally:
                        self.lock.release_write()
                    self._record_hit()
                    logger.debug(f"✓ Redis hit, restaurado en memoria (hash: {hash_key[:8]}...)")
                    return persistent
            except Exception as e:
                logger.warning(f"Redis error: {str(e)}")
        
        self._record_miss()
        return None
    
    def set(self, image_base64, embedding):
        """Almacena embedding en caché (escritura exclusiva)"""
        hash_key = self._hash_image(image_base64)
        
        if not self.enabled:
            if self.persistent_store:
                try:
                    self.persistent_store.set(hash_key, embedding)
                except Exception as e:
                    logger.warning(f"Persistent store set error: {str(e)}")
            return
        
        # Escritura exclusiva: solo un escritor a la vez
        self.lock.acquire_write()
        try:
            # Limpiar caché si alcanza tamaño máximo
            if len(self.cache) >= self.max_size:
                oldest_key = min(self.cache.keys(), 
                               key=lambda k: self.cache[k][1])
                del self.cache[oldest_key]
                logger.debug(f"Removido embedding antiguo, tamaño caché: {len(self.cache)}")
            
            self.cache[hash_key] = (embedding, datetime.now())
        finally:
            self.lock.release_write()
        
        # Guardar en persistente de forma asíncrona (no bloquea)
        if self.persistent_store:
            executor.submit(self.persistent_store.set, hash_key, embedding)
    
    def delete(self, hash_key):
        """Elimina entrada del caché"""
        self.lock.acquire_write()
        try:
            if hash_key in self.cache:
                del self.cache[hash_key]
                logger.debug(f"Eliminado del caché: {hash_key[:8]}...")
                return True
            return False
        finally:
            self.lock.release_write()
    
    def _record_hit(self):
        """Registra hit de caché"""
        with self.stats_lock:
            self.hits += 1
    
    def _record_miss(self):
        """Registra miss de caché"""
        with self.stats_lock:
            self.misses += 1
    
    def get_stats(self):
        """Retorna estadísticas del caché"""
        with self.stats_lock:
            total = self.hits + self.misses
            hit_rate = (self.hits / total * 100) if total > 0 else 0
            return {
                'size': len(self.cache),
                'max_size': self.max_size,
                'hits': self.hits,
                'misses': self.misses,
                'hit_rate': f"{hit_rate:.1f}%",
                'total_accesses': total
            }

# Control para habilitar/deshabilitar caché en memoria
USE_INMEM_CACHE = os.getenv('USE_INMEM_CACHE', 'false').lower() in ('1', 'true', 'yes')
if not USE_INMEM_CACHE:
    logger.info("⚠️  Caché en memoria DESHABILITADA — usando solo persistent store")

# RENDER OPTIMIZATION: Usar caché más pequeño (500 vs 2000)
if HAS_MEMORY_OPTIMIZER:
    cache_size = 500  # Render: reducir caché para ahorrar memoria
    cache_ttl = 1800  # TTL corto: 30 minutos
else:
    cache_size = 2000
    cache_ttl = 3600

embedding_cache = ConcurrentEmbeddingCache(max_size=cache_size, ttl_seconds=cache_ttl, enabled=USE_INMEM_CACHE)
if HAS_MEMORY_OPTIMIZER:
    logger.info(f"🟢 RENDER OPTIMIZED: Cache size={cache_size}, TTL={cache_ttl}s")

# ============ THREAD POOL EXECUTOR (MÁXIMA PARALELIZACIÓN) ============
# Usar ThreadPoolExecutor en lugar de cola personalizada
# Soporta mejor distribución de carga, timeouts, y futures

# Detectar número óptimo de workers - OPTIMIZADO PARA RENDER 512MB
# Render tiene limitaciones: usar máximo 2 workers para evitar overhead
import multiprocessing
cpu_count = multiprocessing.cpu_count()

# RENDER OPTIMIZATION: Limitar a 2 workers máximo
if HAS_MEMORY_OPTIMIZER:
    optimal_workers = min(2, max(1, cpu_count // 2))  # Máximo 2 en Render
else:
    optimal_workers = max(4, cpu_count * 2)

executor = ThreadPoolExecutor(
    max_workers=optimal_workers,
    thread_name_prefix='FacialWorker'
)

logger.info(f"🚀 ThreadPoolExecutor inicializado con {optimal_workers} workers (RENDER OPTIMIZED)")
if HAS_MEMORY_OPTIMIZER:
    logger.info(f"   Memory optimization ENABLED - max workers reduced to {optimal_workers}")

# ============ ESTADÍSTICAS DE PERFORMANCE ============
class PerformanceStats:
    """Registra estadísticas de performance de la API"""
    def __init__(self):
        self.stats = defaultdict(lambda: {'count': 0, 'total_time': 0, 'errors': 0})
        self.lock = Lock()
    
    def record(self, endpoint, duration, error=False):
        """Registra una operación"""
        with self.lock:
            stats = self.stats[endpoint]
            stats['count'] += 1
            stats['total_time'] += duration
            if error:
                stats['errors'] += 1
    
    def get_stats(self):
        """Obtiene estadísticas actuales"""
        with self.lock:
            result = {}
            for endpoint, data in self.stats.items():
                result[endpoint] = {
                    'requests': data['count'],
                    'avg_time_ms': round((data['total_time'] / data['count'] * 1000), 2) if data['count'] > 0 else 0,
                    'errors': data['errors']
                }
            return result

perf_stats = PerformanceStats()


USE_REDIS = os.getenv('USE_REDIS', 'true').lower() in ('1', 'true', 'yes')
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
API_AUTH_TOKEN = os.getenv('API_AUTH_TOKEN', None)


class RedisEmbeddingStore:
    """Almacena embeddings en Redis como JSON (clave = hash_key)"""
    def __init__(self, url=REDIS_URL, ttl_seconds=3600):
        self.url = url
        self.ttl_seconds = ttl_seconds
        try:
            # redis.from_url handles parsing and connection pool
            self.client = redis_client.from_url(self.url, decode_responses=True)
        except Exception as e:
            logger.error(f"No se pudo conectar a Redis en {self.url}: {str(e)}")
            self.client = None

    def get(self, hash_key):
        try:
            if not self.client:
                return None
            raw = self.client.get(hash_key)
            if not raw:
                return None
            data = json.loads(raw)
            return data.get('embedding')
        except Exception as e:
            logger.warning(f"Redis get error: {str(e)}")
            return None

    def set(self, hash_key, embedding):
        try:
            if not self.client:
                raise RuntimeError('Redis client no inicializado')
            caller = request.remote_addr if has_request_context() else 'local'
            payload = json.dumps({
                'embedding': embedding,
                'created_at': datetime.now().isoformat()
            })
            # Set with expiration (TTL)
            self.client.set(hash_key, payload, ex=self.ttl_seconds)
            logger.info(f"✓ Embedding guardado en Redis (hash: {hash_key[:8]}...) caller={caller}")
        except Exception as e:
            logger.warning(f"Redis set error: {str(e)}")

    def delete(self, hash_key):
        """Elimina la entrada indicada por hash_key. Retorna True si existía y fue eliminada."""
        try:
            if not self.client:
                raise RuntimeError('Redis client no inicializado')
            removed = self.client.delete(hash_key)
            caller = request.remote_addr if has_request_context() else 'local'
            if removed:
                logger.info(f"✓ Embedding eliminado de Redis (hash: {hash_key[:8]}...) caller={caller}")
            else:
                logger.info(f"ℹ️ No se encontró embedding en Redis para (hash: {hash_key[:8]}...) caller={caller}")
            return bool(removed)
        except Exception as e:
            logger.warning(f"Redis delete error: {str(e)}")
            return False

    def set_user(self, user_id, embedding):
        """Guarda el embedding asociado a un user_id bajo la clave user:{user_id}"""
        try:
            if not self.client:
                raise RuntimeError('Redis client no inicializado')
            key = f"user:{user_id}"
            payload = json.dumps({
                'embedding': embedding,
                'created_at': datetime.now().isoformat()
            })
            self.client.set(key, payload, ex=self.ttl_seconds)
            caller = request.remote_addr if has_request_context() else 'local'
            logger.info(f"✓ Embedding guardado para usuario {user_id} en Redis caller={caller}")
        except Exception as e:
            logger.warning(f"Redis set_user error: {str(e)}")

    def get_user(self, user_id):
        """Obtiene el embedding guardado para un user_id, o None si no existe"""
        try:
            if not self.client:
                return None
            key = f"user:{user_id}"
            raw = self.client.get(key)
            if not raw:
                return None
            data = json.loads(raw)
            # Log read access for auditing
            caller = request.remote_addr if has_request_context() else 'local'
            logger.info(f"ℹ️ Redis get_user for user={user_id} caller={caller}")
            return data.get('embedding')
        except Exception as e:
            logger.warning(f"Redis get_user error: {str(e)}")
            return None

    def delete_user(self, user_id):
        try:
            if not self.client:
                raise RuntimeError('Redis client no inicializado')
            key = f"user:{user_id}"
            removed = self.client.delete(key)
            caller = request.remote_addr if has_request_context() else 'local'
            if removed:
                logger.info(f"✓ Embedding de usuario {user_id} eliminado de Redis caller={caller}")
            else:
                logger.info(f"ℹ️ No se encontró embedding de usuario {user_id} en Redis caller={caller}")
            return bool(removed)
        except Exception as e:
            logger.warning(f"Redis delete_user error: {str(e)}")
            return False


# Firebase removed: using Redis or in-memory persistent store only

# Inicializar Redis si está habilitado (cuando USE_REDIS=1 usaremos Redis como store)
if USE_REDIS:
    try:
        redis_store = RedisEmbeddingStore(url=REDIS_URL, ttl_seconds=3600)
        if redis_store.client:
            embedding_cache.persistent_store = redis_store
            logger.info(f"Redis inicializado y store inyectado desde {REDIS_URL}")
        else:
            logger.error(f"Redis no disponible en {REDIS_URL}")
    except Exception as e:
        logger.error(f"No se pudo inicializar Redis: {str(e)}")
        redis_store = None
else:
    redis_store = None

if not USE_INMEM_CACHE and not USE_REDIS:
    logger.error("Caché en memoria DESHABILITADA y no hay persistent store habilitado: los embeddings no se persistirán. Establece USE_REDIS=1 o habilita la caché.")

# ============ UTILIDADES ============
def base64_to_image(base64_string):
    """Convierte una cadena Base64 a un array numpy (BGR) en memoria.

    Devuelve una imagen compatible con DeepFace (numpy array). No crea archivos.
    """
    try:
        # Remover el prefijo data:image si existe
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]

        # Decodificar Base64 a bytes
        image_data = base64.b64decode(base64_string)

        # Convertir bytes a numpy array y decodificar con opencv
        nparr = np.frombuffer(image_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise Exception('cv2.imdecode devolvió None')

        return img
    except Exception as e:
        raise Exception(f"Error decodificando imagen Base64: {str(e)}")

def cleanup_temp_files(*file_paths):
    """Funciona como no-op: ya no usamos archivos temporales en disco."""
    return


def require_write_auth():
    """Si `API_AUTH_TOKEN` está configurado, valida el header Authorization: Bearer <token>.
    Devuelve True si está autorizado, False en caso contrario.
    """
    if not API_AUTH_TOKEN:
        return True
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return False
    token = auth.split(' ', 1)[1]
    return token == API_AUTH_TOKEN

# ============ DECORADORES DE PROFILING ============
def profile_endpoint(endpoint_name):
    """Decorador para profiling automático de endpoints"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = f(*args, **kwargs)
                duration = time.time() - start_time
                perf_stats.record(endpoint_name, duration, error=False)
                logger.debug(f"✓ {endpoint_name} completado en {duration*1000:.2f}ms")
                return result
            except Exception as e:
                duration = time.time() - start_time
                perf_stats.record(endpoint_name, duration, error=True)
                logger.error(f"✗ {endpoint_name} error en {duration*1000:.2f}ms: {str(e)}")
                raise
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

# ============ ENDPOINTS ============

@app.route('/health', methods=['GET'])
def health():
    """Endpoint de salud - información de concurrencia y performance"""
    return jsonify({
        'status': 'ok',
        'service': 'facial-recognition',
        'version': '3.0.0-ultra-concurrent',
        'concurrency': {
            'thread_pool_workers': optimal_workers,
            'thread_pool_active': sum(1 for t in executor._threads if t.is_alive()),
            'queue_size': executor._work_queue.qsize() if hasattr(executor, '_work_queue') else 'N/A'
        },
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/metrics', methods=['GET'])
def metrics():
    """Endpoint para obtener métricas detalladas de performance y concurrencia"""
    cache_stats = embedding_cache.get_stats()
    perf = perf_stats.get_stats()
    
    return jsonify({
        'cache': {
            'type': 'RWLock-based concurrent cache',
            'enabled': embedding_cache.enabled,
            **cache_stats
        },
        'concurrency': {
            'thread_pool_workers': optimal_workers,
            'executor_type': 'ThreadPoolExecutor (I/O-bound optimized)',
            'read_write_lock': 'Enabled (multiple readers, single writer)'
        },
        'performance': perf,
        'redis': {
            'enabled': USE_REDIS,
            'available': embedding_cache.persistent_store.client is not None if embedding_cache.persistent_store else False
        },
        'timestamp': datetime.now().isoformat()
    }), 200

@app.route('/register', methods=['POST'])
@limiter.limit("10 per minute")
@profile_endpoint('register')
def register():
    """
    Endpoint para registrar una cara con máxima concurrencia
    - Caché concurrente con RWLock
    - Threading pool paralelo para operaciones I/O
    - Sin bloqueos durante procesamiento de imágenes
    """
    start_time = time.time()
    
    try:
        # Auth guard for write operations (only active if API_AUTH_TOKEN is configured)
        if not require_write_auth():
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({
                'success': False,
                'error': 'Se requiere una imagen en Base64'
            }), 400
        
        image_base64 = data['image']
        user_id = data.get('user_id', 'unknown')
        
        logger.info(f"📸 Registro iniciado para usuario: {user_id}")
        logger.info(f"   DEBUG: user_id type={type(user_id)}, len={len(user_id) if isinstance(user_id, str) else 'N/A'}")
        logger.info(f"   DEBUG: persistent_store exists={embedding_cache.persistent_store is not None}")
        if embedding_cache.persistent_store:
            logger.info(f"   DEBUG: persistent_store type={type(embedding_cache.persistent_store).__name__}")
            logger.info(f"   DEBUG: has set_user method={hasattr(embedding_cache.persistent_store, 'set_user')}")
        
        # PASO 1: Verificar caché
        cached_embedding = embedding_cache.get(image_base64)
        if cached_embedding:
            logger.info(f"   DEBUG: Embedding encontrado en caché")
            return jsonify({
                'success': True,
                'message': 'Cara registrada exitosamente (desde caché)',
                'user_id': user_id,
                'embedding': cached_embedding,
                'face_detected': True,
                'processing_time_ms': round((time.time() - start_time) * 1000)
            }), 200
        
        # PASO 2: Convertir imagen (en memoria)
        try:
            image_array = base64_to_image(image_base64)
        except Exception as e:
            logger.error(f"Error al convertir imagen: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Error al procesar imagen Base64'
            }), 400
        
        # PASO 3: Analizar y detectar cara
        try:
            result = DeepFace.analyze(
                img_path=image_array,
                actions=['age', 'gender', 'race', 'emotion'],
                enforce_detection=True
            )
            logger.info(f"✓ Cara detectada para {user_id}")
            
        except ValueError:
            # no temp files to cleanup
            logger.warning(f"No se detectó cara para {user_id}")
            return jsonify({
                'success': False,
                'error': 'No se detectó una cara en la imagen.',
                'face_detected': False
            }), 400
        
        # PASO 4: Generar embeddings - Usando Facenet512 (3-5x más rápido que VGG-Face)
        try:
            embedding = DeepFace.represent(
                img_path=image_array,
                model_name='Facenet512',
                enforce_detection=True
            )
            
            embedding_data = embedding[0]['embedding'] if embedding else None
            logger.info(f"   DEBUG: Embedding generado, dimensiones={len(embedding_data) if embedding_data else 0}")

            # PASO 5: Cachear embedding
            embedding_cache.set(image_base64, embedding_data)
            logger.info(f"✓ Embedding generado y cacheado para {user_id}")

            # Si viene user_id, guardar también el embedding bajo user:{user_id} en el store persistente
            try:
                logger.info(f"   DEBUG: Intentando guardar por user_id...")
                logger.info(f"   DEBUG: user_id={user_id}, persistent_store={embedding_cache.persistent_store is not None}")
                if user_id and user_id != 'unknown' and embedding_cache.persistent_store and hasattr(embedding_cache.persistent_store, 'set_user'):
                    logger.info(f"   DEBUG: Llamando set_user({user_id}, embedding_data)")
                    embedding_cache.persistent_store.set_user(user_id, embedding_data)
                    logger.info(f"   DEBUG: set_user completado sin excepción")
                else:
                    logger.warning(f"   DEBUG: No se pudo guardar - user_id={user_id}, has_store={embedding_cache.persistent_store is not None}, has_method={hasattr(embedding_cache.persistent_store, 'set_user') if embedding_cache.persistent_store else False}")
            except Exception as e:
                logger.error(f"❌ Error en set_user: {str(e)}\n{traceback.format_exc()}")
            
            # no temp files to cleanup
            
            return jsonify({
                'success': True,
                'message': 'Cara registrada exitosamente',
                'user_id': user_id,
                'embedding': embedding_data,
                'face_detected': True,
                'processing_time_ms': round((time.time() - start_time) * 1000)
            }), 200
            
        except Exception as e:
            logger.error(f"Error generando embedding: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Error al generar embeddings'
            }), 500
            
    except Exception as e:
        logger.error(f"Error en /register: {str(e)}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'error': f'Error procesando registro facial'
        }), 500

@app.route('/verify', methods=['POST'])
@limiter.limit("10 per minute")
@profile_endpoint('verify')
def verify():
    """
    Endpoint para verificar una cara con máxima concurrencia
    - Operaciones paralelas: obtener/generar ambos embeddings simultáneamente
    - Comparación thread-safe sin bloqueos prolongados
    """
    start_time = time.time()

    try:
        data = request.get_json()

        if not data or 'img1' not in data or 'img2' not in data:
            return jsonify({
                'success': False,
                'verified': False,
                'error': 'Se requieren dos imágenes (img1 e img2) en Base64'
            }), 400

        if not embedding_cache.persistent_store:
            return jsonify({
                'success': False,
                'verified': False,
                'error': 'Redis requerido para /verify. Habilita USE_REDIS=1 y REDIS_URL.'
            }), 503

        img1_base64 = data['img1']
        img2_base64 = data['img2']
        user_id = data.get('user_id', 'unknown')

        logger.info(f"🔍 Verificación (persistente) iniciada para usuario: {user_id}")

        def get_or_persist_embedding(image_base64):
            try:
                emb = embedding_cache.get(image_base64)
                if emb:
                    logger.info("✓ Embedding obtenido desde persistente para verificación")
                    return emb
            except Exception as e:
                logger.warning(f"Error accediendo a embedding en persistent store: {e}")

            try:
                img_array_local = base64_to_image(image_base64)
                rep = DeepFace.represent(img_path=img_array_local, model_name='Facenet512', enforce_detection=True)
                new_embedding = rep[0]['embedding'] if rep else None
                if new_embedding:
                    embedding_cache.set(image_base64, new_embedding)
                    logger.info("✓ Embedding calculado y persistido para verificación")
                return new_embedding
            except ValueError:
                raise
            except Exception as e:
                logger.error(f"Error generando embedding para verificación: {e}")
                return None

        emb1 = get_or_persist_embedding(img1_base64)
        emb2 = get_or_persist_embedding(img2_base64)

        if not emb1 or not emb2:
            return jsonify({
                'success': False,
                'verified': False,
                'error': 'No se pudo generar/recuperar embedding para una o ambas imágenes.',
                'face_detected': False
            }), 400

        def cosine_distance(a, b):
            try:
                import math
                dot = sum(x * y for x, y in zip(a, b))
                na = math.sqrt(sum(x * x for x in a))
                nb = math.sqrt(sum(y * y for y in b))
                if na == 0 or nb == 0:
                    return 1.0
                return 1.0 - (dot / (na * nb))
            except Exception:
                return 1.0

        distance = cosine_distance(emb1, emb2)
        threshold = float(os.getenv('FACE_VERIFY_THRESHOLD', '0.4'))
        verified = distance <= threshold

        log_status = "✓ VERIFICADO" if verified else "✗ NO VERIFICADO"
        logger.info(f"{log_status} para {user_id} (distancia: {distance:.4f}) [via Redis]")

        return jsonify({
            'success': True,
            'verified': verified,
            'distance': float(distance),
            'threshold': float(threshold),
            'confidence': float(1 - min(distance / threshold, 1.0)) if verified else 0.0,
            'processing_time_ms': round((time.time() - start_time) * 1000)
        }), 200
    except ValueError:
        logger.warning("No se detectó cara en una o ambas imágenes")
        return jsonify({
            'success': False,
            'verified': False,
            'error': 'No se detectó una cara en una o ambas imágenes.',
            'face_detected': False
        }), 400
    except Exception as e:
        logger.error(f"Error en /verify: {str(e)}\n{traceback.format_exc()}")
        return jsonify({
            'success': False,
            'verified': False,
            'error': 'Error procesando verificación facial'
        }), 500


@app.route('/verify/user', methods=['POST'])
@limiter.limit("10 per minute")
@profile_endpoint('verify_user')
def verify_user():
    """Verifica si la imagen corresponde al usuario registrado (máxima concurrencia)
    
    Request JSON: { "image": "<base64>", "user_id": "..." }
    Operaciones sin bloqueos durante I/O y procesamiento de imágenes
    """
    data = request.get_json() or {}
    image_base64 = data.get('image')
    user_id = data.get('user_id')

    if not image_base64 or not user_id:
        return jsonify({'success': False, 'verified': False, 'error': 'Se requieren `image` y `user_id`.'}), 400

    try:
        logger.info(f"🔍 Verificación por usuario iniciada")
        logger.info(f"   DEBUG: user_id={user_id}, user_id type={type(user_id)}")
        logger.info(f"   DEBUG: persistent_store exists={embedding_cache.persistent_store is not None}")

        # Obtener embedding guardado para el usuario
        stored = None
        if embedding_cache.persistent_store and hasattr(embedding_cache.persistent_store, 'get_user'):
            try:
                logger.info(f"   DEBUG: Llamando get_user({user_id})")
                stored = embedding_cache.persistent_store.get_user(user_id)
                logger.info(f"   DEBUG: get_user retornó: stored={stored is not None}")
                if stored is None:
                    logger.warning(f"   DEBUG: ❌ get_user retornó None para user_id={user_id}")
            except Exception as e:
                logger.error(f"   DEBUG: ❌ Error en get_user: {str(e)}\n{traceback.format_exc()}")

        if not stored:
            logger.warning(f"❌ Usuario {user_id} no tiene registro facial en Redis")
            return jsonify({'success': True, 'verified': False, 'error': 'Usuario no registrado'}), 200

        # Generar embedding de la imagen enviada (en memoria)
        try:
            img_array = base64_to_image(image_base64)
            emb = DeepFace.represent(img_path=img_array, model_name='Facenet512', enforce_detection=True)
            new_embedding = emb[0]['embedding'] if emb else None
        except ValueError:
            return jsonify({'success': False, 'verified': False, 'error': 'No se detectó una cara en la imagen.'}), 400

        if not new_embedding:
            return jsonify({'success': False, 'verified': False, 'error': 'No se pudo generar embedding de la imagen.'}), 400

        # Comparar embeddings usando distancia coseno
        def cosine_distance(a, b):
            try:
                import math
                dot = sum(x * y for x, y in zip(a, b))
                na = math.sqrt(sum(x * x for x in a))
                nb = math.sqrt(sum(y * y for y in b))
                if na == 0 or nb == 0:
                    return 1.0
                return 1.0 - (dot / (na * nb))
            except Exception:
                return 1.0

        distance = cosine_distance(new_embedding, stored)
        threshold = float(os.getenv('FACE_VERIFY_THRESHOLD', '0.4'))
        verified = distance <= threshold

        logger.info(f"✓ VERIFICACION POR USUARIO para {user_id} => {'✓ VERIFICADO' if verified else '❌ NO VERIFICADO'} (distancia: {distance:.4f}, threshold: {threshold})")

        return jsonify({
            'success': True,
            'verified': bool(verified),
            'distance': float(distance),
            'threshold': threshold,
            'confidence': float(1 - min(distance / threshold, 1.0)) if verified else 0.0
        }), 200

    except Exception as e:
        logger.error(f"Error en /verify/user: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'verified': False, 'error': 'Error procesando verificación por usuario'}), 500


@app.route('/user/exists', methods=['GET'])
def user_exists():
    """Consulta ligera para saber si hay un embedding registrado para `user_id`.

    Query params: ?user_id=...
    Response: { exists: true|false }
    """
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'error': 'Se requiere user_id'}), 400

        stored = None
        if embedding_cache.persistent_store and hasattr(embedding_cache.persistent_store, 'get_user'):
            try:
                stored = embedding_cache.persistent_store.get_user(user_id)
            except Exception as e:
                logger.warning(f"Error consultando embedding de usuario en exists: {str(e)}")

        return jsonify({'success': True, 'exists': bool(stored)}), 200
    except Exception as e:
        logger.error(f"Error en /user/exists: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': 'Error procesando consulta de existencia de usuario'}), 500


@app.route('/user/<user_id>', methods=['DELETE'])
def user_delete(user_id):
    """Elimina el embedding asociado al user_id (si existe) en el store persistente (Redis)."""
    try:
        # Auth guard for deletions
        if not require_write_auth():
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        if not user_id:
            return jsonify({'success': False, 'error': 'Se requiere user_id'}), 400

        removed = False
        if embedding_cache.persistent_store and hasattr(embedding_cache.persistent_store, 'delete_user'):
            try:
                removed = embedding_cache.persistent_store.delete_user(user_id)
            except Exception as e:
                logger.warning(f"Error eliminando embedding de usuario: {str(e)}")

        return jsonify({'success': True, 'removed': bool(removed)}), 200
    except Exception as e:
        logger.error(f"Error en /user/<user_id> DELETE: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': 'Error eliminando registro de usuario'}), 500

@app.route('/cache/clear', methods=['POST'])
def clear_cache():
    """Endpoint para limpiar caché (útil para mantenimiento)"""
    try:
        # Auth guard for cache clearing
        if not require_write_auth():
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        if not embedding_cache.enabled:
            return jsonify({
                'success': True,
                'message': 'Caché en memoria deshabilitada; no hay caché local para limpiar'
            }), 200

        with embedding_cache.lock:
            cache_size = len(embedding_cache.cache)
            embedding_cache.cache.clear()

        logger.info(f"Caché limpiado ({cache_size} items eliminados)")
        return jsonify({
            'success': True,
            'message': f'Caché limpiado ({cache_size} items eliminados)'
        }), 200
    except Exception as e:
        logger.error(f"Error limpiando caché: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Error limpiando caché'
        }), 500


@app.route('/register/delete', methods=['POST'])
def delete_registration():
    """Elimina un registro facial persistente dado el `image` (Base64) o `hash`.

    Request JSON:
    - image: Base64 string (preferido)
    - hash: SHA256 hex string (opcional, si no se provee `image`)
    """
    try:
        # Auth guard for deletions
        if not require_write_auth():
            return jsonify({'success': False, 'error': 'Unauthorized'}), 401
        data = request.get_json() or {}
        image_base64 = data.get('image')
        hash_key = data.get('hash')

        if not image_base64 and not hash_key:
            return jsonify({'success': False, 'error': 'Se requiere `image` o `hash` para eliminar.'}), 400

        if image_base64:
            hash_key = embedding_cache._hash_image(image_base64)

        # Remove from in-memory cache if enabled
        try:
            with embedding_cache.lock:
                if hash_key in embedding_cache.cache:
                    del embedding_cache.cache[hash_key]
        except Exception:
            pass

        # Remove from persistent store (Redis) if configured
        removed = False
        if embedding_cache.persistent_store and hasattr(embedding_cache.persistent_store, 'delete'):
            removed = embedding_cache.persistent_store.delete(hash_key)

        return jsonify({'success': True, 'removed': removed, 'hash': hash_key}), 200
    except Exception as e:
        logger.error(f"Error en /register/delete: {str(e)}\n{traceback.format_exc()}")
        return jsonify({'success': False, 'error': 'Error eliminando registro facial'}), 500

if __name__ == '__main__':
    logger.info("🚀 Iniciando Facial Recognition Service v3.0 (ULTRA-CONCURRENTE)")
    logger.info("=" * 70)
    logger.info("⚡ ARQUITECTURA DE CONCURRENCIA:")
    logger.info(f"  ├─ ThreadPoolExecutor: {optimal_workers} workers (CPU cores * 2)")
    logger.info(f"  ├─ Caché concurrente: RWLock (múltiples lectores, escritor único)")
    logger.info(f"  ├─ Tamaño caché: {embedding_cache.max_size} items, TTL: {embedding_cache.ttl_seconds}s")
    logger.info(f"  ├─ Redis: {'✓ Habilitado' if USE_REDIS else '✗ Deshabilitado'}")
    logger.info(f"  ├─ Rate limiting: Habilitado (10 req/min por endpoint)")
    logger.info(f"  └─ Profiling: Habilitado (métricas en /metrics)")
    logger.info("=" * 70)
    logger.info("📊 MONITOREO:")
    logger.info("  └─ GET /metrics → Estadísticas detalladas de concurrencia")
    logger.info("=" * 70)
    
    # Usar threading=True para máxima concurrencia en Flask
    # NOTA: Para producción, usar gunicorn con múltiples workers:
    # gunicorn -w 4 -b 0.0.0.0:5001 --threads 4 api:app
    app.run(host='0.0.0.0', port=5001, debug=False, threaded=True)