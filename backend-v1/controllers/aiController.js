const AIQuestionGenerator = require('../services/aiQuestionGenerator');

class AIController {
  constructor() {
    this.aiGenerator = new AIQuestionGenerator();
  }

  // Generar preguntas con IA
  async generateQuestions(req, res) {
    try {
      const { topic, difficulty = 'medium', count = 5, useAI = false } = req.body;

      if (!topic) {
        return res.status(400).json({ error: 'El tema es requerido' });
      }
      if (!useAI) {
        return res.status(400).json({ error: 'Debes activar el modo IA para generar preguntas. No se permiten preguntas locales.' });
      }
      
      // Validar que count sea un número entero positivo
      const parsedCount = parseInt(count, 10);
      if (isNaN(parsedCount) || parsedCount < 1) {
        return res.status(400).json({ error: 'El número de preguntas debe ser mayor que cero.' });
      }

      const result = await this.aiGenerator.generateQuestions(topic, difficulty, parsedCount);
      if (!result.questions || !Array.isArray(result.questions) || result.questions.length === 0) {
        return res.status(500).json({ error: 'No se pudieron generar preguntas con IA. Intenta de nuevo o revisa tu API Key.' });
      }

      res.json({
        success: true,
        topic,
        difficulty,
        count: result.questions.length,
        questions: result.questions
      });
    } catch (error) {
      console.error('❌ Error en generateQuestions:', error.message || error);
      res.status(500).json({ error: error.message || 'Error al generar preguntas con IA. Por favor, intenta de nuevo.' });
    }
  }


  getTopics(req, res) {
    try {
      const topics = this.aiGenerator.getAvailableTopics();
      res.json({
        success: true,
        topics
      });
    } catch (error) {
      console.error('❌ Error en getTopics:', error.message || error);
      res.status(500).json({ error: 'Error al obtener temas disponibles' });
    }
  }

  // Obtener niveles de dificultad
  getDifficultyLevels(req, res) {
    try {
      const levels = this.aiGenerator.getDifficultyLevels();
      res.json({
        success: true,
        levels
      });
    } catch (error) {
      console.error('❌ Error en getDifficultyLevels:', error.message || error);
      res.status(500).json({ error: 'Error al obtener niveles de dificultad' });
    }
  }

  // Generar preguntas para un juego específico
  async generateGameQuestions(req, res) {
    try {
      const { gameId, topic, difficulty = 'medium', count = 10 } = req.body;

      if (!gameId || !topic) {
        return res.status(400).json({ error: 'gameId y topic son requeridos' });
      }

      const questions = await this.aiGenerator.generateQuestionsFree(topic, difficulty, count);

      res.json({
        success: true,
        gameId,
        topic,
        difficulty,
        count: questions.questions?.length || 0,
        questions: questions.questions || []
      });
    } catch (error) {
      console.error('❌ Error en generateGameQuestions:', error.message || error);
      res.status(500).json({ error: error.message || 'Error al generar preguntas para el juego' });
    }
  }
}

module.exports = AIController;

