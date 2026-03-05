const request = require('supertest');
const express = require('express');
const voiceController = require('../../controllers/voiceController');

// Mock Firebase
jest.mock('../../firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      add: jest.fn(() => Promise.resolve({ id: 'test-doc-id' })),
      where: jest.fn(() => ({
        where: jest.fn(() => ({
          get: jest.fn(() => Promise.resolve({
            docs: [],
            forEach: jest.fn((callback) => {
              // Mock empty forEach
            })
          }))
        }))
      }))
    }))
  }
}));

// Mock rate limiter
jest.mock('../../middleware/rateLimiter', () => ({
  generalUserLimiter: (req, res, next) => next()
}));

// Mock authenticate middleware
jest.mock('../../middleware/authenticate', () => (req, res, next) => {
  req.user = { uid: 'test-user-123' };
  next();
});

const app = express();
app.use(express.json());

// Test routes
app.post('/api/voice-responses/validate', voiceController.validateVoiceResponse);
app.post('/api/voice-responses/process', voiceController.processVoiceResponse);
app.get('/api/voice-responses/stats/:userId', voiceController.getVoiceRecognitionStats);

describe('Voice Controller Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/voice-responses/validate', () => {
    it('should validate correct voice response', async () => {
      const response = await request(app)
        .post('/api/voice-responses/validate')
        .send({
          userId: 'test-user-123',
          questionId: 'test-question-456',
          voiceResponse: 'opción a',
          questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
        })
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.matchedOption).toBe('Opción A');
      expect(response.body.answerIndex).toBe(0);
      expect(response.body.confidence).toBe(1.0);
    });

    it('should reject invalid voice response', async () => {
      const response = await request(app)
        .post('/api/voice-responses/validate')
        .send({
          userId: 'test-user-123',
          questionId: 'test-question-456',
          voiceResponse: 'qwerty asdfgh zxcvbn',
          questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
        })
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.matchedOption).toBeNull();
      expect(response.body.answerIndex).toBeNull();
      expect(response.body.confidence).toBe(0.0);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/voice-responses/validate')
        .send({
          userId: 'test-user-123',
          questionId: 'test-question-456'
          // Missing voiceResponse and questionOptions
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    it('should handle empty question options', async () => {
      const response = await request(app)
        .post('/api/voice-responses/validate')
        .send({
          userId: 'test-user-123',
          questionId: 'test-question-456',
          voiceResponse: 'opción a',
          questionOptions: []
        })
        .expect(400);

      expect(response.body.error).toBeDefined();
    });
  });

  describe('POST /api/voice-responses/process', () => {
    it('should process valid voice response', async () => {
      const response = await request(app)
        .post('/api/voice-responses/process')
        .send({
          userId: 'test-user-123',
          questionId: 'test-question-456',
          voiceResponse: 'opción b',
          questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
          isCorrect: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle processing errors', async () => {
      const response = await request(app)
        .post('/api/voice-responses/process')
        .send({
          userId: 'test-user-123',
          questionId: 'test-question-456',
          voiceResponse: 'invalid response',
          questionOptions: ['Opción A', 'Opción B'],
          isCorrect: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/voice-responses/stats/:userId', () => {
    it('should return voice recognition stats', async () => {
      const response = await request(app)
        .get('/api/voice-responses/stats/test-user-123')
        .expect(200);

      expect(response.body).toHaveProperty('totalAttempts');
      expect(response.body).toHaveProperty('successfulRecognitions');
      expect(response.body).toHaveProperty('successRate');
      expect(response.body).toHaveProperty('averageConfidence');
    });

    it('should handle stats retrieval errors', async () => {
      const response = await request(app)
        .get('/api/voice-responses/stats/invalid-user')
        .expect(200);

      expect(response.body).toHaveProperty('totalAttempts');
      expect(response.body.totalAttempts).toBe(0);
    });
  });
});

describe('Voice Recognition Algorithm Tests', () => {
  const { matchVoiceResponse } = require('../../controllers/voiceController');

  it('should match exact voice response', () => {
    const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    const result = matchVoiceResponse('opción a', options);
    
    expect(result.isValid).toBe(true);
    expect(result.matchedOption).toBe('Opción A');
    expect(result.answerIndex).toBe(0);
    expect(result.confidence).toBe(1.0);
  });

  it('should match voice response with minor variations', () => {
    const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    const result = matchVoiceResponse('opcion a', options);
    
    expect(result.isValid).toBe(true);
    expect(result.matchedOption).toBe('Opción A');
    expect(result.answerIndex).toBe(0);
    expect(result.confidence).toBe(0.9);
  });

  it('should match voice response with numbers', () => {
    const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    const result = matchVoiceResponse('1', options);
    
    expect(result.isValid).toBe(true);
    expect(result.matchedOption).toBe('Opción A');
    expect(result.answerIndex).toBe(0);
    expect(result.confidence).toBe(0.9);
  });

  it('should match voice response with letter variations', () => {
    const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    const result = matchVoiceResponse('a', options);
    
    expect(result.isValid).toBe(true);
    expect(result.matchedOption).toBe('Opción A');
    expect(result.answerIndex).toBe(0);
    expect(result.confidence).toBe(0.8);
  });

  it('should handle invalid responses', () => {
    const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    const result = matchVoiceResponse('qwerty asdfgh zxcvbn', options);
    
    expect(result.isValid).toBe(false);
    expect(result.matchedOption).toBeNull();
    expect(result.answerIndex).toBeNull();
    expect(result.confidence).toBe(0.0);
  });

  it('should handle empty voice response', () => {
    const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    const result = matchVoiceResponse('', options);
    
    expect(result.isValid).toBe(false);
    expect(result.matchedOption).toBeNull();
    expect(result.answerIndex).toBeNull();
    expect(result.confidence).toBe(0.0);
  });

  it('should handle empty options array', () => {
    const options = [];
    const result = matchVoiceResponse('opción a', options);
    
    expect(result.isValid).toBe(false);
    expect(result.matchedOption).toBeNull();
    expect(result.answerIndex).toBeNull();
    expect(result.confidence).toBe(0.0);
  });

  it('should match multiple word responses', () => {
    const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    const result = matchVoiceResponse('la opción a', options);
    
    expect(result.isValid).toBe(true);
    expect(result.matchedOption).toBe('Opción A');
    expect(result.answerIndex).toBe(0);
    expect(result.confidence).toBe(0.8);
  });

  it('should handle case insensitive matching', () => {
    const options = ['Opción A', 'Opción B', 'Opción C', 'Opción D'];
    const result = matchVoiceResponse('OPCIÓN A', options);
    
    expect(result.isValid).toBe(true);
    expect(result.matchedOption).toBe('Opción A');
    expect(result.answerIndex).toBe(0);
    expect(result.confidence).toBe(1.0);
  });
});
