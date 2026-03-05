

const AIController = require('../../controllers/aiController');
const AIQuestionGenerator = require('../../services/aiQuestionGenerator');

describe('AIController', () => {
  let req, res, controller;

  beforeEach(() => {
    controller = new AIController();
    req = { body: {}, user: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateQuestions', () => {
    test('should return 400 if topic is missing', async () => {
      req.body = { useAI: true };
      await controller.generateQuestions(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    test('should return 400 if useAI is false', async () => {
      req.body = { topic: 'math', useAI: false };
      await controller.generateQuestions(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

      test('should return 400 if count is 0 and verify error message', async () => {
        req.body = { topic: 'math', useAI: true, count: 0 };
        await controller.generateQuestions(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: 'El número de preguntas debe ser mayor que cero.' });
      });

    test('should return 200 even if not enough questions (now allows partial results)', async () => {
      req.body = { topic: 'math', useAI: true, count: 5 };
      // El nuevo comportamiento retorna lo que pudo generar (tolerance > 50%)
      controller.aiGenerator.generateQuestions = jest.fn().mockResolvedValue({ questions: [1, 2, 3] });
      await controller.generateQuestions(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, questions: expect.any(Array) }));
    });

    test('should return 500 if very few questions (less than 50% of target)', async () => {
      req.body = { topic: 'math', useAI: true, count: 5 };
      // Si solo obtiene 1 pregunta de 5 (20%), falla
      controller.aiGenerator.generateQuestions = jest.fn().mockRejectedValue(new Error('La IA no generó suficientes preguntas'));
      await controller.generateQuestions(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    test('should return 200 and questions on success', async () => {
      req.body = { topic: 'math', useAI: true, count: 2 };
      controller.aiGenerator.generateQuestions = jest.fn().mockResolvedValue({ questions: [1, 2] });
      await controller.generateQuestions(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, questions: expect.any(Array) }));
    });

    test('should handle internal error', async () => {
      req.body = { topic: 'math', useAI: true, count: 2 };
      controller.aiGenerator.generateQuestions = jest.fn().mockRejectedValue(new Error('fail'));
      await controller.generateQuestions(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('getTopics', () => {
    test('should return topics', () => {
      controller.aiGenerator.getAvailableTopics = jest.fn().mockReturnValue(['math', 'science']);
      controller.getTopics(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, topics: expect.any(Array) }));
    });

    test('should handle error', () => {
      controller.aiGenerator.getAvailableTopics = jest.fn(() => { throw new Error('fail'); });
      controller.getTopics(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('getDifficultyLevels', () => {
    test('should return levels', () => {
      controller.aiGenerator.getDifficultyLevels = jest.fn().mockReturnValue(['easy', 'hard']);
      controller.getDifficultyLevels(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, levels: expect.any(Array) }));
    });

    test('should handle error', () => {
      controller.aiGenerator.getDifficultyLevels = jest.fn(() => { throw new Error('fail'); });
      controller.getDifficultyLevels(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });
});
