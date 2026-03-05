const express = require('express');
const ttsController = require('../controllers/ttsController');
const authenticate = require('../middleware/authenticate');
const { generalUserLimiter } = require('../middleware/rateLimiter');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Route to synthesize speech
router.post('/synthesize', generalUserLimiter, ttsController.synthesize);

// Route to get available voices
router.get('/voices', generalUserLimiter, ttsController.getVoices);

module.exports = router;