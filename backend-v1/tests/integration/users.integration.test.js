const request = require('supertest');
const express = require('express');
const usersController = require('../../controllers/usersController');
const authenticate = require('../../middleware/authenticate');

const app = express();
app.use(express.json());

// Import rate limiters
const { 
  registerLimiter, 
  passwordRecoveryLimiter, 
  profileUpdateLimiter, 
  generalUserLimiter 
} = require('../../middleware/rateLimiter');

app.post('/api/users/register', registerLimiter, usersController.register);
app.post('/api/users/login', generalUserLimiter, usersController.login);
app.post('/api/users/recover-password', passwordRecoveryLimiter, usersController.recoverPassword);
app.put('/api/users/me/profile', profileUpdateLimiter, authenticate, usersController.updateProfile);
app.get('/api/users/me/stats', generalUserLimiter, authenticate, usersController.getStats);
app.get('/api/users/me/history', generalUserLimiter, authenticate, usersController.getHistory);

jest.mock('../../middleware/authenticate', () => (req, res, next) => {
  req.user = { uid: 'test-uid' };
  next();
});
jest.mock('../../firebase', () => ({ auth: { createUser: jest.fn(), generatePasswordResetLink: jest.fn() }, db: { collection: jest.fn() } }));

describe('Users API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/users/register', () => {
    test('registers user without visualDifficulty', async () => {
      require('../../firebase').auth.createUser.mockResolvedValue({ uid: '1', email: 'a', displayName: 'c' });
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ set: jest.fn().mockResolvedValue() }) });
      const res = await request(app).post('/api/users/register').send({ email: 'a', password: 'b', displayName: 'c' });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('uid');
      expect(res.body).toHaveProperty('visualDifficulty', false);
    });

    test('registers user with visualDifficulty true', async () => {
      require('../../firebase').auth.createUser.mockResolvedValue({ uid: '1', email: 'a', displayName: 'c' });
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ set: jest.fn().mockResolvedValue() }) });
      const res = await request(app).post('/api/users/register').send({ 
        email: 'a', 
        password: 'b', 
        displayName: 'c', 
        visualDifficulty: true 
      });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('uid');
      expect(res.body).toHaveProperty('visualDifficulty', true);
    });

    test('rejects invalid visualDifficulty type', async () => {
      const res = await request(app).post('/api/users/register').send({ 
        email: 'a', 
        password: 'b', 
        displayName: 'c', 
        visualDifficulty: 'invalid' 
      });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'visualDifficulty must be a boolean value');
    });

    test('handles error', async () => {
      require('../../firebase').auth.createUser.mockRejectedValue(new Error('fail'));
      const res = await request(app).post('/api/users/register').send({ email: 'a', password: 'b', displayName: 'c' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/users/login', () => {
    test('returns 501', async () => {
      const res = await request(app).post('/api/users/login').send({ email: 'a', password: 'b' });
      expect(res.status).toBe(501);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('POST /api/users/recover-password', () => {
    test('sends reset email', async () => {
      require('../../firebase').auth.generatePasswordResetLink.mockResolvedValue();
      const res = await request(app).post('/api/users/recover-password').send({ email: 'a' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('message');
    });
    test('handles error', async () => {
      require('../../firebase').auth.generatePasswordResetLink.mockRejectedValue(new Error('fail'));
      const res = await request(app).post('/api/users/recover-password').send({ email: 'a' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/users/me/stats', () => {
    test('400 if missing uid', async () => {
      const res = await request(app).get('/api/users/me/stats');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/users/me/profile', () => {
    test('updates visualDifficulty', async () => {
      const updateMock = jest.fn().mockResolvedValue();
      const getMock = jest
        .fn()
        .mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'Test', email: 'test@test.com', stats: {} }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'Test', email: 'test@test.com', stats: {}, visualDifficulty: true }) });
      
      require('../../firebase').db.collection.mockReturnValue({ 
        doc: jest.fn(() => ({ get: getMock, update: updateMock })) 
      });

      const res = await request(app)
        .put('/api/users/me/profile')
        .send({ visualDifficulty: true });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('visualDifficulty', true);
    });

    test('updates displayName', async () => {
      const updateMock = jest.fn().mockResolvedValue();
      const getMock = jest
        .fn()
        .mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'Test', email: 'test@test.com', stats: {} }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'New Name', email: 'test@test.com', stats: {} }) });
      
      require('../../firebase').db.collection.mockReturnValue({ 
        doc: jest.fn(() => ({ get: getMock, update: updateMock })) 
      });

      const res = await request(app)
        .put('/api/users/me/profile')
        .send({ displayName: 'New Name' });
      
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('displayName', 'New Name');
    });

    test('rejects invalid visualDifficulty type', async () => {
      const res = await request(app)
        .put('/api/users/me/profile')
        .send({ visualDifficulty: 'invalid' });
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'visualDifficulty must be a boolean value');
    });

    test('returns 404 if user not found', async () => {
      require('../../firebase').db.collection.mockReturnValue({ 
        doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })) 
      });

      const res = await request(app)
        .put('/api/users/me/profile')
        .send({ displayName: 'New Name' });
      
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('error', 'User not found');
    });

    test('returns 400 if no fields to update', async () => {
      const getMock = jest.fn().mockResolvedValue({ exists: true, data: () => ({ displayName: 'Test', email: 'test@test.com', stats: {} }) });
      require('../../firebase').db.collection.mockReturnValue({ 
        doc: jest.fn(() => ({ get: getMock })) 
      });

      const res = await request(app)
        .put('/api/users/me/profile')
        .send({});
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'No valid fields to update');
    });
  });

  describe('GET /api/users/me/history', () => {
    test('returns empty array', async () => {
      const res = await request(app).get('/api/users/me/history');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
