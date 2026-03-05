const express = require('express');
const router = express.Router();
const assemblyAIController = require('../controllers/assemblyAIController');
const authenticate = require('../middleware/authenticate');
const { generalUserLimiter } = require('../middleware/rateLimiter');

// [HU8] Text-to-Speech
router.post('/tts', authenticate, generalUserLimiter, assemblyAIController.textToSpeech);

// [HU8] Speech-to-Text
router.post('/stt', authenticate, generalUserLimiter, assemblyAIController.speechToText);

// [HU8] Procesar audio base64
router.post('/process-audio', authenticate, generalUserLimiter, assemblyAIController.processAudio);

// [HU8] Obtener voces disponibles
router.get('/voices', authenticate, generalUserLimiter, assemblyAIController.getVoices);

// [HU8] Verificar estado del servicio
router.get('/status', assemblyAIController.getStatus);

module.exports = router;