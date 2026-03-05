const authenticate = require('../../middleware/authenticate');

jest.mock('../../firebase', () => ({ auth: { verifyIdToken: jest.fn() } }));

describe('authenticate middleware', () => {
  let req, res, next;
  beforeEach(() => {
    req = { headers: {}, user: undefined };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return 401 if no token', async () => {
    req.headers = {};
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });
  test('should return 401 if token invalid', async () => {
    req.headers = { authorization: 'Bearer badtoken' };
    require('../../firebase').auth.verifyIdToken.mockRejectedValue(new Error('fail'));
    await authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });
  test('should call next if token valid', async () => {
    req.headers = { authorization: 'Bearer goodtoken' };
    require('../../firebase').auth.verifyIdToken.mockResolvedValue({ uid: '1' });
    await authenticate(req, res, next);
    expect(req.user).toEqual(expect.objectContaining({ uid: expect.any(String) }));
    expect(next).toHaveBeenCalled();
  });
});
