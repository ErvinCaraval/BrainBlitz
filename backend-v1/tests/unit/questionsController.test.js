const questionsController = require('../../controllers/questionsController');

jest.mock('../../firebase', () => ({ db: { batch: jest.fn(), collection: jest.fn() } }));

describe('questionsController', () => {
  let req, res;
  beforeEach(() => {
    req = { body: {}, params: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('bulkCreate', () => {
    test('should return 400 if no questions', async () => {
      req.body = { questions: [] };
      await questionsController.bulkCreate(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: expect.any(String) }));
    });
    test('should return 200 on success', async () => {
      req.body = { questions: [{ text: 'Q1' }] };
      const batch = { set: jest.fn(), commit: jest.fn().mockResolvedValue() };
      require('../../firebase').db.batch.mockReturnValue(batch);
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn() });
      await questionsController.bulkCreate(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
    test('should handle error', async () => {
      req.body = { questions: [{ text: 'Q1' }] };
      require('../../firebase').db.batch.mockImplementation(() => { throw new Error('fail'); });
      await questionsController.bulkCreate(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: expect.any(String) }));
    });
  });

  describe('getAll', () => {
    test('should return questions', async () => {
      const docs = [{ id: '1', data: () => ({}) }];
      require('../../firebase').db.collection.mockReturnValue({ get: jest.fn().mockResolvedValue({ docs }) });
      await questionsController.getAll(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.any(Array));
    });
    test('should handle error', async () => {
      require('../../firebase').db.collection.mockReturnValue({ get: jest.fn().mockRejectedValue(new Error('fail')) });
      await questionsController.getAll(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('create', () => {
    test('should create question', async () => {
      req.body = { text: 'Q', options: ['a', 'b'], correctAnswerIndex: 0, category: '', explanation: '' };
      require('../../firebase').db.collection.mockReturnValue({ add: jest.fn().mockResolvedValue({ id: '123' }) });
      await questionsController.create(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        id: expect.any(String),
        question: expect.objectContaining({ text: 'Q' })
      }));
    });
    test('should return 400 for invalid payload', async () => {
      req.body = { text: '', options: ['only'], correctAnswerIndex: 0 };
      await questionsController.create(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
    test('should handle error', async () => {
      req.body = { text: 'Q', options: ['a', 'b'], correctAnswerIndex: 0, category: '', explanation: '' };
      require('../../firebase').db.collection.mockReturnValue({ add: jest.fn().mockRejectedValue(new Error('fail')) });
      await questionsController.create(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('update', () => {
    test('should update question', async () => {
      req.params = { id: '1' };
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ update: jest.fn().mockResolvedValue() }) });
      await questionsController.update(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
    test('should handle error', async () => {
      req.params = { id: '1' };
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ update: jest.fn().mockRejectedValue(new Error('fail')) }) });
      await questionsController.update(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });

  describe('remove', () => {
    test('should delete question', async () => {
      req.params = { id: '1' };
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ delete: jest.fn().mockResolvedValue() }) });
      await questionsController.remove(req, res);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
    });
    test('should handle error', async () => {
      req.params = { id: '1' };
      require('../../firebase').db.collection.mockReturnValue({ doc: jest.fn().mockReturnValue({ delete: jest.fn().mockRejectedValue(new Error('fail')) }) });
      await questionsController.remove(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });
  });
});
