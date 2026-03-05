const express = require('express');
const router = express.Router();

const usersController = require('../controllers/usersController');
const authenticate = require('../middleware/authenticate');
const { 
  registerLimiter, 
  passwordRecoveryLimiter, 
  profileUpdateLimiter, 
  generalUserLimiter 
} = require('../middleware/rateLimiter');

// Aplicar rate limiting específico para cada endpoint
router.post('/register', registerLimiter, usersController.register);
router.post('/login', generalUserLimiter, usersController.login); 
router.post('/recover-password', passwordRecoveryLimiter, usersController.recoverPassword);
router.put('/me/profile', profileUpdateLimiter, authenticate, usersController.updateProfile);
router.get('/me/stats', generalUserLimiter, authenticate, usersController.getStats);
router.get('/me/history', generalUserLimiter, authenticate, usersController.getHistory);

module.exports = router;
