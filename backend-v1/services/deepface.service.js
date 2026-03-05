/**
 * Servicio para comunicación con el microservicio DeepFace
 * Se comunica con el servicio local de reconocimiento facial
 */
const axios = require('axios');

class DeepFaceService {
  constructor() {
    // URL del microservicio DeepFace
    // Por defecto usa localhost para desarrollo local
    // Se puede sobrescribir con la variable de entorno DEEPFACE_SERVICE_URL
    this.baseURL = process.env.DEEPFACE_SERVICE_URL || 'http://localhost:5001';
    // Timeout reducido a 45 segundos (optimizado con cache + Facenet512)
    // Antes: 90s. Ahora: 45s. Con cache habilitado, típicamente <2s
    this.timeout = 45000; // 45 segundos de timeout
    
    // Log de la URL configurada
    console.log(`🔧 DeepFace Service configurado con URL: ${this.baseURL} (timeout: ${this.timeout/1000}s)`);
  }

  /**
   * Verifica la salud del servicio DeepFace
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseURL}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      throw new Error(`DeepFace service no disponible: ${error.message}`);
    }
  }

  /**
   * Registra una cara en el sistema
   * @param {string} imageBase64 - Imagen en formato Base64
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Resultado del registro
   */
  async registerFace(imageBase64, userId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/register`,
        {
          image: imageBase64,
          user_id: userId
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          },
          // Configuración para manejar conexiones largas
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
          // Keep-alive para mantener la conexión
          httpAgent: new (require('http').Agent)({ 
            keepAlive: true,
            keepAliveMsecs: 30000
          })
        }
      );

      return {
        success: response.data.success,
        message: response.data.message,
        embedding: response.data.embedding,
        faceDetected: response.data.face_detected
      };
    } catch (error) {
      // Log detallado del error para debugging
      console.error('Error en registerFace:', {
        message: error.message,
        code: error.code,
        baseURL: this.baseURL,
        hasResponse: !!error.response,
        hasRequest: !!error.request
      });
      
      if (error.response) {
        // El servicio respondió con un error
        throw new Error(
          error.response.data?.error || 
          `Error en registro facial: ${error.response.statusText}`
        );
      } else if (error.request) {
        // La petición se hizo pero no hubo respuesta
        let errorMsg;
        if (error.code === 'ECONNREFUSED') {
          errorMsg = `No se pudo conectar al servicio facial en ${this.baseURL}. Verifica que el servicio esté ejecutándose.`;
        } else if (error.code === 'ETIMEDOUT') {
          errorMsg = `Timeout al conectar con el servicio facial en ${this.baseURL}. El servicio puede estar sobrecargado o procesando una imagen muy grande.`;
        } else if (error.code === 'ECONNRESET') {
          errorMsg = `La conexión con el servicio facial se cerró inesperadamente. Esto puede deberse a que la imagen es muy grande o el procesamiento está tardando demasiado. Intenta con una imagen más pequeña o espera un momento.`;
        } else {
          errorMsg = `El servicio de reconocimiento facial no está disponible en ${this.baseURL}. Error: ${error.code || error.message}`;
        }
        throw new Error(errorMsg);
      } else {
        // Error al configurar la petición
        throw new Error(`Error configurando petición: ${error.message}`);
      }
    }
  }

  /**
   * Verifica si dos imágenes corresponden a la misma persona
   * @param {string} img1Base64 - Primera imagen en Base64 (foto guardada)
   * @param {string} img2Base64 - Segunda imagen en Base64 (foto de login)
   * @param {number} retries - Número de reintentos (default: 2)
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async verifyFace(img1Base64, img2Base64, retries = 3) {
    let lastError;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Reintentando verificación facial (intento ${attempt + 1}/${retries + 1})...`);
          // Esperar antes de reintentar (backoff exponencial más largo)
          const waitTime = 2000 * attempt; // 2s, 4s, 6s...
          console.log(`   Esperando ${waitTime}ms antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        const response = await axios.post(
          `${this.baseURL}/verify`,
          {
            img1: img1Base64,
            img2: img2Base64
          },
          {
            timeout: this.timeout,
            headers: {
              'Content-Type': 'application/json'
            },
            // Configuración para manejar conexiones largas
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            // Keep-alive para mantener la conexión con timeout más largo
            httpAgent: new (require('http').Agent)({ 
              keepAlive: true,
              keepAliveMsecs: 60000, // 60 segundos
              timeout: 10000, // 10 segundos para establecer conexión
              // Aumentar el timeout de socket para evitar ECONNRESET
              socketTimeout: this.timeout
            })
          }
        );

        return {
          success: response.data.success,
          verified: response.data.verified,
          distance: response.data.distance,
          threshold: response.data.threshold,
          confidence: response.data.confidence,
          faceDetected: response.data.face_detected !== false
        };
      } catch (error) {
        lastError = error;
        
        // Log detallado del error para debugging
        console.error(`Error en verifyFace (intento ${attempt + 1}/${retries + 1}):`, {
          message: error.message,
          code: error.code,
          baseURL: this.baseURL,
          hasResponse: !!error.response,
          hasRequest: !!error.request
        });
        
        // Si es el último intento o el error no es recuperable, lanzar error
        if (attempt === retries) {
          if (error.response) {
            // El servicio respondió con un error
            const errorData = error.response.data;
            throw new Error(
              errorData?.error || 
              `Error en verificación facial: ${error.response.statusText}`
            );
          } else if (error.request) {
            // La petición se hizo pero no hubo respuesta
            let errorMsg;
            if (error.code === 'ECONNREFUSED') {
              errorMsg = `No se pudo conectar al servicio facial en ${this.baseURL}. Verifica que el servicio esté ejecutándose.`;
            } else if (error.code === 'ETIMEDOUT') {
              errorMsg = `Timeout al conectar con el servicio facial en ${this.baseURL}. El servicio puede estar sobrecargado o procesando una imagen muy grande.`;
            } else if (error.code === 'ECONNRESET') {
              errorMsg = `La conexión con el servicio facial se cerró inesperadamente después de ${retries + 1} intentos. Esto puede deberse a que las imágenes son muy grandes o el procesamiento está tardando demasiado. Intenta con imágenes más pequeñas.`;
            } else {
              errorMsg = `El servicio de reconocimiento facial no está disponible en ${this.baseURL}. Error: ${error.code || error.message}`;
            }
            throw new Error(errorMsg);
          } else {
            // Error al configurar la petición
            throw new Error(`Error configurando petición: ${error.message}`);
          }
        }
        
        // Si es ECONNRESET o ETIMEDOUT, reintentar
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
          continue; // Reintentar
        } else {
          // Para otros errores, no reintentar
          throw error;
        }
      }
    }
    
    // Esto no debería ejecutarse, pero por si acaso
    throw lastError || new Error('Error desconocido en verificación facial');
  }

  /**
   * Verifica si existe un registro facial para un userId en el microservicio
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async hasFaceRegistration(userId) {
    try {
      const response = await axios.get(`${this.baseURL}/user/exists`, {
        params: { user_id: userId },
        timeout: 5000
      });
      return !!(response.data && response.data.exists);
    } catch (error) {
      console.error('Error comprobando registro facial en DeepFace service:', error.message || error);
      // En caso de error asumimos que no existe (para permitir reintento en registro)
      return false;
    }
  }

  /**
   * Verifica la imagen enviada contra el registro almacenado por user_id en el microservicio
   * @param {string} userId
   * @param {string} imageBase64
   */
  async verifyFaceByUser(userId, imageBase64, retries = 2) {
    try {
      const response = await axios.post(
        `${this.baseURL}/verify/user`,
        { user_id: userId, image: imageBase64 },
        {
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' },
          maxContentLength: Infinity,
          maxBodyLength: Infinity
        }
      );

      return {
        success: response.data.success,
        verified: response.data.verified,
        distance: response.data.distance,
        threshold: response.data.threshold,
        confidence: response.data.confidence
      };
    } catch (error) {
      console.error('Error en verifyFaceByUser:', {
        message: error.message,
        hasResponse: !!error.response
      });
      if (error.response) {
        const err = error.response.data;
        throw new Error(err?.error || 'Error en verificación por usuario');
      }
      throw new Error(error.message || 'Error conectando con DeepFace service');
    }
  }

  /**
   * Elimina el registro facial asociado a userId en el microservicio
   * @param {string} userId
   */
  async deleteUser(userId) {
    try {
      const response = await axios.delete(`${this.baseURL}/user/${encodeURIComponent(userId)}`, { timeout: 10000 });
      return !!(response.data && response.data.removed);
    } catch (error) {
      console.error('Error eliminando usuario en DeepFace service:', error.message || error);
      // Lanzar para que el controlador lo reporte adecuadamente
      throw new Error(error.response?.data?.error || error.message || 'Error eliminando registro en microservicio');
    }
  }
}

module.exports = new DeepFaceService();

