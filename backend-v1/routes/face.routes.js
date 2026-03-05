const express = require('express');
const router = express.Router();

const faceController = require('../controllers/face.controller');
const { generalUserLimiter } = require('../middleware/rateLimiter');

/**
 * @route POST /api/face/register
 * @desc Registra la cara de un usuario autenticado
 * @access Private (requiere token de Firebase)
 * @body {string} image - Imagen en Base64
 * @body {string} token - Token de Firebase Auth
 */
router.post('/register', generalUserLimiter, (req, res) => {
  faceController.register(req, res);
});

/**
 * @route POST /api/face/login
 * @desc Login facial - verifica la cara del usuario
 * @access Public
 * @body {string} image - Imagen en Base64
 * @body {string} email - Email del usuario
 */
router.post('/login', generalUserLimiter, (req, res) => {
  faceController.login(req, res);
});

// Check existence of facial registration for authenticated user
router.get('/exists', generalUserLimiter, (req, res) => {
  faceController.exists(req, res);
});

// Delete facial registration for a given userId (protected)
router.delete('/:userId', generalUserLimiter, (req, res) => {
  faceController.deleteRegistration(req, res);
});

module.exports = router;

