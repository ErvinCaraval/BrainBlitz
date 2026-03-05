/**
 * Controlador para autenticación facial
 * Maneja registro y login facial
 */
const deepfaceService = require('../services/deepface.service');
const { auth } = require('../firebase');
const { cleanupMemory, logMemoryUsage } = require('../utils/memoryOptimizer');

class FaceController {
  /**
   * Registra la cara de un usuario
   * POST /api/face/register
   */
  async register(req, res) {
    try {
      logMemoryUsage('Face Register Start');
      const { image, token } = req.body;

      // Validaciones
      if (!image) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere una imagen en Base64'
        });
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Se requiere un token de autenticación'
        });
      }

      // Verificar token de Firebase
      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(token);
      } catch (error) {
        return res.status(401).json({
          success: false,
          error: 'Token inválido o expirado'
        });
      }

      const userId = decodedToken.uid;
      console.log(`📸 DEBUG: Registro iniciado - userId=${userId} (type=${typeof userId})`);

      // Verificar si el usuario ya tiene registro facial (consulta al microservicio Redis)
      const hasRegistration = await deepfaceService.hasFaceRegistration(userId);
      console.log(`   DEBUG: hasRegistration=${hasRegistration}`);
      if (hasRegistration) {
        return res.status(400).json({
          success: false,
          error: 'El usuario ya tiene un registro facial. Elimina el registro anterior para crear uno nuevo.'
        });
      }

      // Enviar imagen al microservicio DeepFace para validación y generación de embeddings
      let registerResult;
      try {
        console.log(`   DEBUG: Llamando registerFace con userId=${userId}`);
        registerResult = await deepfaceService.registerFace(image, userId);
        console.log(`   DEBUG: registerFace completado, result.success=${registerResult.success}`);
      } catch (error) {
        console.error(`❌ Error en registerFace: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      if (!registerResult.success) {
        return res.status(400).json({
          success: false,
          error: registerResult.message || 'Error en el registro facial'
        });
      }

      if (!registerResult.faceDetected) {
        return res.status(400).json({
          success: false,
          error: 'No se detectó una cara en la imagen. Por favor, asegúrate de que tu rostro sea claramente visible.'
        });
      }

      // Nota: ahora la persistencia de cara se realiza en el microservicio (Redis).
      // `deepfaceService.registerFace` ya guarda el embedding por `user_id` en el servicio facial.

      // Clean up memory after processing
      cleanupMemory();
      logMemoryUsage('Face Register End');
      
      res.status(201).json({
        success: true,
        message: 'Registro facial completado exitosamente',
        userId,
        registeredAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error en registro facial:', error);
      cleanupMemory();
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  }

  /**
   * Login facial
   * POST /api/face/login
   */
  async login(req, res) {
    try {
      const { image, email } = req.body;

      // Validaciones
      if (!image) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere una imagen en Base64'
        });
      }

      if (!email) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere el email del usuario'
        });
      }

      // Obtener usuario por email
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(email);
      } catch (error) {
        return res.status(404).json({
          success: false,
          error: 'Usuario no encontrado'
        });
      }

      const userId = userRecord.uid;
      console.log(`🔐 DEBUG: Login iniciado - email=${email}, userId=${userId} (type=${typeof userId})`);

      // Verificar si el usuario tiene registro facial (consulta al microservicio Redis)
      const hasRegistration = await deepfaceService.hasFaceRegistration(userId);
      console.log(`   DEBUG: hasRegistration=${hasRegistration}`);
      if (!hasRegistration) {
        return res.status(400).json({
          success: false,
          error: 'El usuario no tiene un registro facial. Por favor, regístrate primero.'
        });
      }

      // Enviar la imagen al microservicio para verificación contra el embedding guardado por user_id
      let verifyResult;
      try {
        console.log(`   DEBUG: Llamando verifyFaceByUser con userId=${userId}`);
        verifyResult = await deepfaceService.verifyFaceByUser(userId, image);
        console.log(`   DEBUG: verifyFaceByUser completado, result.verified=${verifyResult.verified}`);
      } catch (error) {
        console.error(`❌ Error en verifyFaceByUser: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: error.message
        });
      }

      if (!verifyResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Error en la verificación facial'
        });
      }

      // Verificar si las caras coinciden
      if (!verifyResult.verified) {
        return res.status(401).json({
          success: false,
          verified: false,
          error: 'Las caras no coinciden. Acceso denegado.',
          confidence: verifyResult.confidence
        });
      }

      // Login exitoso - generar token personalizado de Firebase
      let customToken;
      try {
        customToken = await auth.createCustomToken(userId);
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Error generando token de autenticación'
        });
      }

      res.status(200).json({
        success: true,
        verified: true,
        message: 'Login facial exitoso',
        userId,
        customToken,
        confidence: verifyResult.confidence,
        distance: verifyResult.distance
      });
    } catch (error) {
      console.error('Error en login facial:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error interno del servidor'
      });
    }
  }

  /**
   * Comprueba si el usuario autenticado tiene registro facial
   * GET /api/face/exists
   * - token en header Authorization: Bearer <idToken>
   */
  async exists(req, res) {
    try {
      // Obtener token desde Authorization header o query/body
      const authHeader = req.headers['authorization'] || '';
      let token = null;
      if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
      token = token || req.query.token || req.body?.token;

      if (!token) {
        return res.status(401).json({ success: false, error: 'Se requiere token de autenticación' });
      }

      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
      }

      const userId = decodedToken.uid;
      const exists = await deepfaceService.hasFaceRegistration(userId);
      return res.status(200).json({ success: true, exists: !!exists });
    } catch (error) {
      console.error('Error en exists facial:', error);
      return res.status(500).json({ success: false, error: 'Error comprobando registro facial' });
    }
  }

  /**
   * Elimina el registro facial del usuario autenticado
   * DELETE /api/face/:userId
   * - Se requiere token Authorization: Bearer <idToken> y el uid debe coincidir con :userId
   */
  async deleteRegistration(req, res) {
    try {
      const { userId } = req.params;
      if (!userId) return res.status(400).json({ success: false, error: 'Se requiere userId' });

      const authHeader = req.headers['authorization'] || '';
      let token = null;
      if (authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
      token = token || req.body?.token || req.query?.token;

      if (!token) return res.status(401).json({ success: false, error: 'Se requiere token de autenticación' });

      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(token);
      } catch (err) {
        return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
      }

      if (decodedToken.uid !== userId) {
        return res.status(403).json({ success: false, error: 'No autorizado para eliminar este registro' });
      }

      // Llamar al microservicio para eliminar
      try {
        const removed = await deepfaceService.deleteUser(userId);
        return res.status(200).json({ success: true, removed });
      } catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Error eliminando registro facial' });
      }
    } catch (error) {
      console.error('Error en deleteRegistration:', error);
      return res.status(500).json({ success: false, error: 'Error eliminando registro facial' });
    }
  }
}

module.exports = new FaceController();

