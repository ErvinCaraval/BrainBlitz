const request = require('supertest');
const express = require('express');
const authenticate = require('../../middleware/authenticate');

const app = express();
app.use(express.json());
app.get('/protected', authenticate, (req, res) => res.json({ ok: true, user: req.user }));

jest.mock('../../firebase', () => ({ auth: { verifyIdToken: jest.fn() } }));

describe('Authenticate Middleware Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('401 if no token', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
  test('401 if token invalid', async () => {
    require('../../firebase').auth.verifyIdToken.mockRejectedValue(new Error('fail'));
    const res = await request(app).get('/protected').set('Authorization', 'Bearer badtoken');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
  test('200 if token valid', async () => {
    require('../../firebase').auth.verifyIdToken.mockResolvedValue({ uid: '1' });
    const res = await request(app).get('/protected').set('Authorization', 'Bearer goodtoken');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('user');
  });
});
