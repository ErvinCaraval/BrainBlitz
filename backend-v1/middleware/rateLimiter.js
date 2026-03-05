const rateLimit = require('express-rate-limit');

// Rate limiter para registro de usuarios
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos fallidos de registro por IP cada 15 minutos
  message: {
    error: 'Demasiados intentos de registro. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // ✅ Solo contar requests FALLIDOS
});

// ✅ SECURITY FIX: Rate limiter para login (verificación de credenciales)
// Protege contra ataques de fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // máximo 1000 intentos fallidos de login por IP cada 15 minutos
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // ✅ Solo contar requests FALLIDOS
});

// Rate limiter para recuperación de contraseña
const passwordRecoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 3, // máximo 3 intentos fallidos de recuperación por IP cada 15 minutos
  message: {
    error: 'Demasiados intentos de recuperación de contraseña. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // ✅ Solo contar requests FALLIDOS
});

// Rate limiter para actualización de perfil
const profileUpdateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // máximo 10 actualizaciones por IP cada 5 minutos
  message: {
    error: 'Demasiadas actualizaciones de perfil. Intenta de nuevo en 5 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter general para endpoints de usuarios
const generalUserLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // máximo 200 requests por IP cada 15 minutos
  message: {
    error: 'Demasiadas peticiones. Intenta de nuevo en 15 minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req, res) => {
    // No aplicar rate limit a GET requests (queries)
    return req.method === 'GET';
  }
});

// Rate limiter específico para endpoints de IA (más permisivo)
// Las solicitudes a IA son costosas computacionalmente pero no deben estar severamente limitadas
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 50, // máximo 50 solicitudes de IA por IP cada 10 minutos
  message: {
    error: 'Demasiadas solicitudes de generación de preguntas. Por favor espera 10 minutos antes de intentar nuevamente.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Usar IP del cliente real (si está detrás de proxy)
    return req.ip || req.connection.remoteAddress || '127.0.0.1';
  },
  handler: (req, res, options) => {
    // Handler personalizado para errores de rate limit en IA
    console.warn(`⚠️ Rate limit hit for AI request from IP ${req.ip}`);
    res.status(options.statusCode || 429).json({
      error: options.message.error || 'Too many requests'
    });
  },
  // En desarrollo, ser más permisivo
  skip: (req, res) => {
    // En desarrollo, no aplicar rate limiting a localhost
    if (process.env.NODE_ENV === 'development') {
      const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';
      if (isLocalhost) {
        console.log('📝 Skipping rate limit for localhost in development mode');
        return true;
      }
    }
    return false;
  }
});

module.exports = {
  registerLimiter,
  loginLimiter,
  passwordRecoveryLimiter,
  profileUpdateLimiter,
  generalUserLimiter,
  aiLimiter
};
