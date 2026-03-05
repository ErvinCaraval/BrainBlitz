const usersController = require('../../controllers/usersController');

jest.mock('../../firebase', () => ({ auth: { createUser: jest.fn(), generatePasswordResetLink: jest.fn() }, db: { collection: jest.fn() } }));

describe('usersController', () => {
  let req, res;
  beforeEach(() => {
    req = { body: {}, params: {}, user: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getHistory', () => {
    test('should return empty array', async () => {
      await usersController.getHistory(req, res);
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe('register', () => {
    test('should register user without visualDifficulty', async () => {
      req.body = { email: 'a', password: 'b', displayName: 'c' };
      require('../../firebase').auth.createUser.mockResolvedValue({ uid: '1', email: 'a', displayName: 'c' });
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ set: jest.fn().mockResolvedValue() }) });
      await usersController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        uid: expect.any(String), 
        email: expect.any(String), 
        displayName: expect.any(String),
        visualDifficulty: false
      }));
    });

    test('should register user with visualDifficulty true', async () => {
      req.body = { email: 'a', password: 'b', displayName: 'c', visualDifficulty: true };
      require('../../firebase').auth.createUser.mockResolvedValue({ uid: '1', email: 'a', displayName: 'c' });
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ set: jest.fn().mockResolvedValue() }) });
      await usersController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        uid: expect.any(String), 
        email: expect.any(String), 
        displayName: expect.any(String),
        visualDifficulty: true
      }));
    });

    test('should register user with visualDifficulty false', async () => {
      req.body = { email: 'a', password: 'b', displayName: 'c', visualDifficulty: false };
      require('../../firebase').auth.createUser.mockResolvedValue({ uid: '1', email: 'a', displayName: 'c' });
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ set: jest.fn().mockResolvedValue() }) });
      await usersController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        uid: expect.any(String), 
        email: expect.any(String), 
        displayName: expect.any(String),
        visualDifficulty: false
      }));
    });

    test('should reject invalid visualDifficulty type', async () => {
      req.body = { email: 'a', password: 'b', displayName: 'c', visualDifficulty: 'invalid' };
      await usersController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        error: 'visualDifficulty must be a boolean value'
      }));
    });

    test('should handle error', async () => {
      require('../../firebase').auth.createUser.mockRejectedValue(new Error('fail'));
      await usersController.register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('login', () => {
    test('should return 501', async () => {
      await usersController.login(req, res);
      expect(res.status).toHaveBeenCalledWith(501);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('recoverPassword', () => {
    test('should send reset email', async () => {
      req.body = { email: 'a' };
      require('../../firebase').auth.generatePasswordResetLink.mockResolvedValue();
      await usersController.recoverPassword(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
    test('should handle error', async () => {
      require('../../firebase').auth.generatePasswordResetLink.mockRejectedValue(new Error('fail'));
      await usersController.recoverPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('updateProfile', () => {
    test('should return 401 if no user', async () => {
      req.user = undefined;
      await usersController.updateProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication required' }));
    });

    test('should update visualDifficulty', async () => {
      req.user = { uid: 'u1' };
      req.body = { visualDifficulty: true };
      
      const updateMock = jest.fn().mockResolvedValue();
      const getMock = jest
        .fn()
        .mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'Test', email: 'test@test.com', stats: {} }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'Test', email: 'test@test.com', stats: {}, visualDifficulty: true }) });
      
      require('../../firebase').db.collection.mockReturnValue({ 
        doc: jest.fn(() => ({ get: getMock, update: updateMock })) 
      });
      
      await usersController.updateProfile(req, res);
      expect(updateMock).toHaveBeenCalledWith({ visualDifficulty: true });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        uid: 'u1', 
        visualDifficulty: true 
      }));
    });

    test('should update displayName', async () => {
      req.user = { uid: 'u1' };
      req.body = { displayName: 'New Name' };
      
      const updateMock = jest.fn().mockResolvedValue();
      const getMock = jest
        .fn()
        .mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'Test', email: 'test@test.com', stats: {} }) })
        .mockResolvedValueOnce({ exists: true, data: () => ({ displayName: 'New Name', email: 'test@test.com', stats: {} }) });
      
      require('../../firebase').db.collection.mockReturnValue({ 
        doc: jest.fn(() => ({ get: getMock, update: updateMock })) 
      });
      
      await usersController.updateProfile(req, res);
      expect(updateMock).toHaveBeenCalledWith({ displayName: 'New Name' });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        uid: 'u1', 
        displayName: 'New Name' 
      }));
    });

    test('should reject invalid visualDifficulty type', async () => {
      req.user = { uid: 'u1' };
      req.body = { visualDifficulty: 'invalid' };
      
      await usersController.updateProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        error: 'visualDifficulty must be a boolean value'
      }));
    });

    test('should return 404 if user not found', async () => {
      req.user = { uid: 'u1' };
      req.body = { displayName: 'New Name' };
      
      require('../../firebase').db.collection.mockReturnValue({ 
        doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: false }) })) 
      });
      
      await usersController.updateProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'User not found' }));
    });

    test('should return 400 if no fields to update', async () => {
      req.user = { uid: 'u1' };
      req.body = {};
      
      const getMock = jest.fn().mockResolvedValue({ exists: true, data: () => ({ displayName: 'Test', email: 'test@test.com', stats: {} }) });
      require('../../firebase').db.collection.mockReturnValue({ 
        doc: jest.fn(() => ({ get: getMock })) 
      });
      
      await usersController.updateProfile(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'No valid fields to update' }));
    });
  });

  describe('getStats', () => {
    test('should return 400 if missing uid', async () => {
      req.user = undefined;
      req.query = {};
      await usersController.getStats(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    test('should create user if not exists', async () => {
      req.user = { uid: 'u1', name: 'Test User', email: 'test@example.com' };
      req.query = {};
      // Mock Firestore doc get to return not exists, then exists
      const setMock = jest.fn().mockResolvedValue();
      const getMock = jest
        .fn()
        .mockResolvedValueOnce({ exists: false })
        .mockResolvedValueOnce({ exists: true, data: () => ({ stats: { gamesPlayed: 1, wins: 2, correctAnswers: 3 }, displayName: 'Test User', email: 'test@example.com' }) });
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn(() => ({ get: getMock, set: setMock })) });
      await usersController.getStats(req, res);
      expect(setMock).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u1', stats: { gamesPlayed: 1, wins: 2, correctAnswers: 3 } }));
    });

    test('should handle Firestore error', async () => {
      req.user = { uid: 'u2' };
      req.query = {};
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn(() => ({ get: jest.fn().mockRejectedValue(new Error('fail')) })) });
      await usersController.getStats(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    test('should use default stats if missing', async () => {
      req.user = { uid: 'u3' };
      req.query = {};
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn(() => ({ get: jest.fn().mockResolvedValue({ exists: true, data: () => ({}) }) })) });
      await usersController.getStats(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ uid: 'u3', stats: { gamesPlayed: 0, wins: 0, correctAnswers: 0 } }));
    });
  });
});
