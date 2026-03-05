const request = require('supertest');
const express = require('express');
const questionsController = require('../../controllers/questionsController');
const authenticate = require('../../middleware/authenticate');

const app = express();
app.use(express.json());
app.get('/api/questions', questionsController.getAll);
app.post('/api/questions', authenticate, questionsController.create);
app.post('/api/questions/bulk', authenticate, questionsController.bulkCreate);
app.put('/api/questions/:id', authenticate, questionsController.update);
app.delete('/api/questions/:id', authenticate, questionsController.remove);

jest.mock('../../middleware/authenticate', () => (req, res, next) => next());
jest.mock('../../firebase', () => ({ db: { collection: jest.fn() } }));

describe('Questions API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/questions', () => {
    test('returns questions', async () => {
      const docs = [{ id: '1', data: () => ({}) }];
      require('../../firebase').db.collection.mockReturnValue({ get: jest.fn().mockResolvedValue({ docs }) });
      const res = await request(app).get('/api/questions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
    test('handles error', async () => {
      require('../../firebase').db.collection.mockReturnValue({ get: jest.fn().mockRejectedValue(new Error('fail')) });
      const res = await request(app).get('/api/questions');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/questions', () => {
    test('creates question', async () => {
      require('../../firebase').db.collection.mockReturnValue({ add: jest.fn().mockResolvedValue({ id: '123' }) });
      const res = await request(app).post('/api/questions').send({ text: 'Q', options: [], correctAnswerIndex: 0, category: '', explanation: '' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });
    test('handles error', async () => {
      require('../../firebase').db.collection.mockReturnValue({ add: jest.fn().mockRejectedValue(new Error('fail')) });
      const res = await request(app).post('/api/questions').send({ text: 'Q' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/questions/bulk', () => {
    test('bulk create', async () => {
      const batch = { set: jest.fn(), commit: jest.fn().mockResolvedValue() };
      require('../../firebase').db.batch = jest.fn().mockReturnValue(batch);
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn() });
      const res = await request(app).post('/api/questions/bulk').send({ questions: [{ text: 'Q1' }] });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
    });
    test('handles error', async () => {
      require('../../firebase').db.batch = jest.fn(() => { throw new Error('fail'); });
      const res = await request(app).post('/api/questions/bulk').send({ questions: [{ text: 'Q1' }] });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
    });
  });

  describe('PUT /api/questions/:id', () => {
    test('updates question', async () => {
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ update: jest.fn().mockResolvedValue() }) });
      const res = await request(app).put('/api/questions/1').send({ text: 'Q' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
    test('handles error', async () => {
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ update: jest.fn().mockRejectedValue(new Error('fail')) }) });
      const res = await request(app).put('/api/questions/1').send({ text: 'Q' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('DELETE /api/questions/:id', () => {
    test('deletes question', async () => {
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ delete: jest.fn().mockResolvedValue() }) });
      const res = await request(app).delete('/api/questions/1');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
    test('handles error', async () => {
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ delete: jest.fn().mockRejectedValue(new Error('fail')) }) });
      const res = await request(app).delete('/api/questions/1');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
