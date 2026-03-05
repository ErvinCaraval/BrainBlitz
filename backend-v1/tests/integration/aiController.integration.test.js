const request = require('supertest');
const express = require('express');
const AIController = require('../../controllers/aiController');

const app = express();
app.use(express.json());
const aiController = new AIController();
app.post('/api/ai/generate-questions', (req, res) => aiController.generateQuestions(req, res));
app.get('/api/ai/topics', (req, res) => aiController.getTopics(req, res));
app.get('/api/ai/difficulty-levels', (req, res) => aiController.getDifficultyLevels(req, res));

jest.mock('../../services/aiQuestionGenerator');

describe('AIController Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/ai/generate-questions', () => {
    test('400 if topic missing', async () => {
      const res = await request(app).post('/api/ai/generate-questions').send({ useAI: true });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
    test('400 if useAI false', async () => {
      const res = await request(app).post('/api/ai/generate-questions').send({ topic: 'math', useAI: false });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
    test('500 if not enough questions', async () => {
      aiController.aiGenerator.generateQuestions = jest.fn().mockResolvedValue({ questions: [1] });
      const res = await request(app).post('/api/ai/generate-questions').send({ topic: 'math', useAI: true, count: 2 });
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
    test('200 on success', async () => {
      aiController.aiGenerator.generateQuestions = jest.fn().mockResolvedValue({ questions: [1, 2] });
      const res = await request(app).post('/api/ai/generate-questions').send({ topic: 'math', useAI: true, count: 2 });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('questions');
    });
    test('500 on error', async () => {
      aiController.aiGenerator.generateQuestions = jest.fn().mockRejectedValue(new Error('fail'));
      const res = await request(app).post('/api/ai/generate-questions').send({ topic: 'math', useAI: true, count: 2 });
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
    test('400 if count=0', async () => {
      const res = await request(app).post('/api/ai/generate-questions').send({ topic: 'math', useAI: true, count: 0 });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/ai/topics', () => {
    test('200 returns topics', async () => {
      aiController.aiGenerator.getAvailableTopics = jest.fn().mockReturnValue(['math']);
      const res = await request(app).get('/api/ai/topics');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('topics');
    });
    test('500 on error', async () => {
      aiController.aiGenerator.getAvailableTopics = jest.fn(() => { throw new Error('fail'); });
      const res = await request(app).get('/api/ai/topics');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/ai/difficulty-levels', () => {
    test('200 returns levels', async () => {
      aiController.aiGenerator.getDifficultyLevels = jest.fn().mockReturnValue(['easy']);
      const res = await request(app).get('/api/ai/difficulty-levels');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('levels');
    });
    test('500 on error', async () => {
      aiController.aiGenerator.getDifficultyLevels = jest.fn(() => { throw new Error('fail'); });
      const res = await request(app).get('/api/ai/difficulty-levels');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });
});
