const gamesController = require('../../controllers/gamesController');

jest.mock('../../firebase', () => ({ db: { collection: jest.fn() } }));

describe('gamesController', () => {
  let req, res;
  beforeEach(() => {
    req = { body: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('listPublicGames', () => {
    test('should return games', async () => {
      const docs = [{ id: '1', data: () => ({}) }];
      require('../../firebase').db.collection.mockReturnValue({ where: jest.fn().mockReturnThis(), get: jest.fn().mockResolvedValue({ docs }) });
      await gamesController.listPublicGames(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
    test('should handle error', async () => {
      require('../../firebase').db.collection.mockReturnValue({ where: jest.fn().mockReturnThis(), get: jest.fn().mockRejectedValue(new Error('fail')) });
      await gamesController.listPublicGames(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });
});
