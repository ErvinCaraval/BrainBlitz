const request = require('supertest');
const express = require('express');
const gamesController = require('../../controllers/gamesController');

const app = express();
app.use(express.json());
app.get('/api/games', gamesController.listPublicGames);

jest.mock('../../firebase', () => ({ db: { collection: jest.fn() } }));

describe('Games API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('GET /api/games', () => {
    test('returns games', async () => {
      const docs = [{ id: '1', data: () => ({}) }];
      require('../../firebase').db.collection.mockReturnValue({ where: jest.fn().mockReturnThis(), get: jest.fn().mockResolvedValue({ docs }) });
      const res = await request(app).get('/api/games');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
    test('handles error', async () => {
      require('../../firebase').db.collection.mockReturnValue({ where: jest.fn().mockReturnThis(), get: jest.fn().mockRejectedValue(new Error('fail')) });
      const res = await request(app).get('/api/games');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
