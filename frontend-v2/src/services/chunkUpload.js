/**
 * Servicio para enviar imágenes en chunks (fragmentos)
 * Permite enviar imágenes grandes sin bloquear la conexión
 */

/**
 * Envía una imagen en chunks al servidor
 * @param {string} imageBase64 - Imagen en Base64
 * @param {string} endpoint - Endpoint del servidor
 * @param {object} headers - Headers adicionales
 * @param {object} metadata - Datos adicionales (email, token, etc)
 * @param {number} chunkSize - Tamaño de cada chunk en bytes (default: 5KB)
 * @param {function} onProgress - Callback de progreso
 * @returns {Promise<object>} Respuesta del servidor
 */
export async function sendImageInChunks(
  imageBase64,
  endpoint,
  headers = {},
  metadata = {},
  chunkSize = 5120,
  onProgress = null
) {
  try {
    // Separar el prefijo de data URI si existe
    let base64Data = imageBase64;
    if (imageBase64.includes(',')) {
      base64Data = imageBase64.split(',')[1];
    }

    const totalChunks = Math.ceil(base64Data.length / chunkSize);
    console.log(`📦 Enviando imagen en ${totalChunks} chunks de ${chunkSize}B cada uno`);

    // Inicializar sesión de upload
    const sessionId = generateSessionId();
    const initResponse = await fetch(`${endpoint}/init-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        sessionId,
        totalChunks,
        totalSize: base64Data.length,
        ...metadata
      })
    });

    if (!initResponse.ok) {
      throw new Error('Error inicializando upload');
    }

    // Enviar cada chunk
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, base64Data.length);
      const chunk = base64Data.slice(start, end);

      const chunkResponse = await fetch(`${endpoint}/upload-chunk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify({
          sessionId,
          chunkIndex: i,
          chunkData: chunk,
          isLastChunk: i === totalChunks - 1
        })
      });

      if (!chunkResponse.ok) {
        throw new Error(`Error enviando chunk ${i + 1}/${totalChunks}`);
      }

      // Notificar progreso
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      if (onProgress) {
        onProgress({
          chunksProcessed: i + 1,
          totalChunks,
          percentage: progress
        });
      }

      console.log(`✓ Chunk ${i + 1}/${totalChunks} enviado (${progress}%)`);
    }

    // Finalizar upload
    const finalResponse = await fetch(`${endpoint}/finalize-upload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({ sessionId, ...metadata })
    });

    if (!finalResponse.ok) {
      throw new Error('Error finalizando upload');
    }

    const result = await finalResponse.json();
    console.log('✓ Upload completado exitosamente');
    return result;
  } catch (error) {
    console.error('Error en sendImageInChunks:', error);
    throw error;
  }
}

/**
 * Genera un ID único para la sesión de upload
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Versión simplificada: envía imagen como un único request
 * pero reporta progreso simulado
 */
export async function sendImageWithProgress(
  imageBase64,
  endpoint,
  headers = {},
  metadata = {},
  onProgress = null
) {
  try {
    const controller = new AbortController();
    
    // Preparar payload
    const payload = JSON.stringify({
      image: imageBase64,
      ...metadata
    });

    // Crear XMLHttpRequest para trackear progreso real
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Trackear progreso de upload
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          if (onProgress) {
            onProgress({
              loaded: event.loaded,
              total: event.total,
              percentage: progress
            });
          }
          console.log(`📤 Progreso de upload: ${progress}%`);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (e) {
            reject(new Error('Error parseando respuesta'));
          }
        } else {
          reject(new Error(`Error: ${xhr.status} ${xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Error de conexión'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelado'));
      });

      // Configurar headers
      xhr.open('POST', endpoint);
      xhr.setRequestHeader('Content-Type', 'application/json');
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Enviar
      xhr.send(payload);
    });
  } catch (error) {
    console.error('Error en sendImageWithProgress:', error);
    throw error;
  }
}
