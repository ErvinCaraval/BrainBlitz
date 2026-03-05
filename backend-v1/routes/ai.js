const express = require('express');
const AIController = require('../controllers/aiController');
const { aiLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
const aiController = new AIController();

// Generar preguntas con IA
router.post('/generate-questions', aiLimiter, (req, res) => {
  aiController.generateQuestions(req, res);
});

// Obtener temas disponibles
router.get('/topics', (req, res) => {
  aiController.getTopics(req, res);
});

// Obtener niveles de dificultad
router.get('/difficulty-levels', (req, res) => {
  aiController.getDifficultyLevels(req, res);
});

// Generar preguntas para un juego específico
router.post('/generate-game-questions', aiLimiter, (req, res) => {
  aiController.generateGameQuestions(req, res);
});

module.exports = router;

