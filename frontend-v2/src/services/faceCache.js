/**
 * Servicio de caching local para embeddings faciales
 * Almacena embeddings en IndexedDB para rápida verificación de login
 */

const DB_NAME = 'BrainBlitzFaceDB';
const DB_VERSION = 1;
const STORE_NAME = 'faceEmbeddings';

/**
 * Abre la base de datos IndexedDB
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'email' });
      }
    };
  });
}

/**
 * Guarda embeddings faciales en cache local
 * @param {string} email - Email del usuario
 * @param {Array} embeddings - Array de embeddings
 * @param {object} metadata - Información adicional (timestamp, etc)
 */
export async function cacheFaceEmbeddings(email, embeddings, metadata = {}) {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const data = {
      email,
      embeddings,
      timestamp: Date.now(),
      ...metadata
    };

    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => {
        console.log(`✓ Embeddings cacheados para ${email}`);
        resolve(data);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error cacheando embeddings:', error);
    throw error;
  }
}

/**
 * Obtiene embeddings faciales del cache local
 * @param {string} email - Email del usuario
 * @returns {object|null} Datos con embeddings o null
 */
export async function getCachedFaceEmbeddings(email) {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(email);
      request.onsuccess = () => {
        const data = request.result;
        if (data) {
          console.log(`✓ Embeddings encontrados en cache para ${email}`);
          resolve(data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error obteniendo embeddings del cache:', error);
    return null;
  }
}

/**
 * Elimina embeddings faciales del cache local
 * @param {string} email - Email del usuario
 */
export async function deleteCachedFaceEmbeddings(email) {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.delete(email);
      request.onsuccess = () => {
        console.log(`✓ Embeddings eliminados del cache para ${email}`);
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error eliminando embeddings del cache:', error);
    throw error;
  }
}

/**
 * Limpia todo el cache local
 */
export async function clearFaceCache() {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => {
        console.log('✓ Cache facial limpiado completamente');
        resolve(true);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('Error limpiando cache:', error);
    throw error;
  }
}

/**
 * Obtiene información del cache (tamaño, cantidad de entradas)
 */
export async function getFaceCacheInfo() {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const countRequest = store.count();
      countRequest.onsuccess = () => {
        const count = countRequest.result;
        console.log(`ℹ Cache: ${count} embeddings almacenados`);
        resolve({
          count,
          dbName: DB_NAME,
          storeName: STORE_NAME
        });
      };
      countRequest.onerror = () => reject(countRequest.error);
    });
  } catch (error) {
    console.error('Error obteniendo info del cache:', error);
    return { count: 0, error: error.message };
  }
}
