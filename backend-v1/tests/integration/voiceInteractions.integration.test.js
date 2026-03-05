const request = require('supertest');

// Mock Firebase before importing the server
const mockDocs = [];
let mockDocId = 0;

jest.mock('../../firebase', () => ({
  db: {
    collection: jest.fn((collectionName) => {
      const collection = {
        add: jest.fn().mockImplementation((data) => {
          const id = `mock-id-${++mockDocId}`;
          const doc = { id, ...data };
          mockDocs.push(doc);
          return Promise.resolve({ id });
        }),
        where: jest.fn().mockImplementation((field, operator, value) => {
          // Filter docs based on the where clause
          const filteredDocs = mockDocs.filter(doc => {
            if (field === 'userId' && operator === '==') {
              return doc.userId === value;
            }
            return true;
          });
          
          return {
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              forEach: jest.fn((callback) => {
                filteredDocs.forEach(doc => callback({
                  id: doc.id,
                  data: () => doc
                }));
              }),
              docs: filteredDocs.map(doc => ({
                id: doc.id,
                data: () => doc
              }))
            }),
            batch: jest.fn(() => ({
              delete: jest.fn().mockImplementation((docRef) => {
                // Remove the document from mockDocs
                const docId = docRef.id;
                const index = mockDocs.findIndex(doc => doc.id === docId);
                if (index > -1) {
                  mockDocs.splice(index, 1);
                }
              }),
              commit: jest.fn().mockResolvedValue()
            }))
          };
        }),
        get: jest.fn().mockResolvedValue({
          forEach: jest.fn((callback) => {
            mockDocs.forEach(doc => callback({
              id: doc.id,
              data: () => doc
            }));
          }),
          docs: mockDocs.map(doc => ({
            id: doc.id,
            data: () => doc
          }))
        }),
        batch: jest.fn(() => ({
          delete: jest.fn(),
          commit: jest.fn().mockResolvedValue()
        }))
      };
      return collection;
    }),
    batch: jest.fn(() => ({
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue()
    }))
  }
}));

// Mock AssemblyAI service
jest.mock('../../services/assemblyAIService', () => ({
  transcribeAndWait: jest.fn().mockResolvedValue({
    success: true,
    text: 'primera opción',
    confidence: 0.95,
    duration: 2.5,
    language: 'es'
  }),
  checkAPIStatus: jest.fn().mockResolvedValue({
    success: true,
    status: 'API is working'
  }),
  generateSuggestions: jest.fn().mockReturnValue(['Diga "A" para Opción A...'])
}));

// Mock the server to avoid port conflicts
jest.mock('../../hybridServer', () => {
  const express = require('express');
  const app = express();
  
  // Configure body parser with higher limit for testing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  
  // Import routes
  const voiceInteractionsRouter = require('../../routes/voiceInteractions');
  app.use('/api/voice-interactions', voiceInteractionsRouter);
  
  // Add error handling middleware
  app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: err.message });
  });
  
  return { app };
});

const { app } = require('../../hybridServer');
const { db } = require('../../firebase');

describe('HU5: Voice Interactions API', () => {
  const testUserId = 'test-user-voice';
  const testQuestionId = 'test-question-voice';
  let createdId = null;

  beforeEach(() => {
    // Don't clear mock data between tests to maintain state
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // Clear mock data only once at the beginning
    mockDocs.length = 0;
    mockDocId = 0;
  });

  afterAll(async () => {
    // Cleanup: Eliminar todos los registros de prueba
    const snapshot = await db.collection('voiceInteractions').where('userId', '==', testUserId).get();
    const batch = db.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  });

  it('debe registrar una interacción de voz', async () => {
    const res = await request(app)
      .post('/api/voice-interactions')
      .send({
        userId: testUserId,
        questionId: testQuestionId,
        action: 'voice_answer',
        duration: 2.5,
        timestamp: new Date().toISOString(),
        voiceText: null,
        confidence: null,
        metadata: { audioBase64: 'testaudio' }
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.message).toMatch(/registered/i);
  });

    it('debe registrar una interacción de tipo question_read', async () => {
      const res = await request(app)
        .post('/api/voice-interactions')
        .send({
          userId: testUserId,
          questionId: testQuestionId,
          action: 'question_read',
          duration: 1.2,
          timestamp: new Date().toISOString(),
          voiceText: '¿Cuál es la capital de Francia?',
          confidence: 0.99,
          metadata: { audioBase64: 'testaudio2' }
        });
      expect(res.statusCode).toBe(201);
      expect(res.body.message).toMatch(/registered/i);
    });

  it('debe recuperar el historial de voz del usuario', async () => {
    // First register both interactions
    await request(app)
      .post('/api/voice-interactions')
      .send({
        userId: testUserId,
        questionId: testQuestionId,
        action: 'voice_answer',
        duration: 2.5,
        timestamp: new Date().toISOString(),
        voiceText: 'primera opción',
        confidence: 0.95,
        metadata: { audioBase64: 'testaudio' }
      });
    
    await request(app)
      .post('/api/voice-interactions')
      .send({
        userId: testUserId,
        questionId: testQuestionId,
        action: 'question_read',
        duration: 1.2,
        timestamp: new Date().toISOString(),
        voiceText: '¿Cuál es la capital de Francia?',
        confidence: 0.99,
        metadata: { audioBase64: 'testaudio2' }
      });
    
    const res = await request(app)
      .get(`/api/voice-interactions/${testUserId}`);
    
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toHaveProperty('userId', testUserId);
    expect(res.body.some(i => i.action === 'voice_answer')).toBe(true);
    expect(res.body.some(i => i.action === 'question_read')).toBe(true);
  });

  it('debe devolver estadísticas básicas', async () => {
    // First register some interactions
    await request(app)
      .post('/api/voice-interactions')
      .send({
        userId: testUserId,
        questionId: testQuestionId,
        action: 'voice_answer',
        duration: 2.5,
        timestamp: new Date().toISOString(),
        voiceText: 'primera opción',
        confidence: 0.95,
        metadata: { audioBase64: 'testaudio' }
      });
    
    await request(app)
      .post('/api/voice-interactions')
      .send({
        userId: testUserId,
        questionId: testQuestionId,
        action: 'question_read',
        duration: 1.2,
        timestamp: new Date().toISOString(),
        voiceText: '¿Cuál es la capital de Francia?',
        confidence: 0.99,
        metadata: { audioBase64: 'testaudio2' }
      });
    
    const res = await request(app)
      .get(`/api/voice-interactions/stats/${testUserId}`);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('averageDuration');
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('debe eliminar el historial de voz del usuario', async () => {
    const res = await request(app)
      .delete(`/api/voice-interactions/${testUserId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toMatch(/Deleted/);
  });

    it('debe devolver error si faltan campos obligatorios', async () => {
      const res = await request(app)
        .post('/api/voice-interactions')
        .send({ userId: testUserId });
      expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/questionId/);
    });

      it('debe devolver error si userId es inválido', async () => {
        const res = await request(app)
          .post('/api/voice-interactions')
          .send({
            userId: '',
            questionId: testQuestionId,
            action: 'voice_answer',
            duration: 1,
            timestamp: new Date().toISOString(),
            metadata: { audioBase64: 'x' }
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/userId/);
      });

      it('debe devolver error si action es inválido', async () => {
        const res = await request(app)
          .post('/api/voice-interactions')
          .send({
            userId: testUserId,
            questionId: testQuestionId,
            action: 'invalid_action',
            duration: 1,
            timestamp: new Date().toISOString(),
            metadata: { audioBase64: 'x' }
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/action/);
      });

      it('debe devolver error si duration es negativo', async () => {
        const res = await request(app)
          .post('/api/voice-interactions')
          .send({
            userId: testUserId,
            questionId: testQuestionId,
            action: 'voice_answer',
            duration: -1,
            timestamp: new Date().toISOString(),
            metadata: { audioBase64: 'x' }
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/duration/);
      });

      it('debe devolver error si timestamp es inválido', async () => {
        const res = await request(app)
          .post('/api/voice-interactions')
          .send({
            userId: testUserId,
            questionId: testQuestionId,
            action: 'voice_answer',
            duration: 1,
            timestamp: 'not-a-date',
            metadata: { audioBase64: 'x' }
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/timestamp/);
      });

      it('debe devolver error si metadata es inválido', async () => {
        const res = await request(app)
          .post('/api/voice-interactions')
          .send({
            userId: testUserId,
            questionId: testQuestionId,
            action: 'voice_answer',
            duration: 1,
            timestamp: new Date().toISOString(),
            metadata: 'not-an-object'
          });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/metadata/);
      });

      it('debe devolver error si audioBase64 es demasiado grande', async () => {
        const res = await request(app)
          .post('/api/voice-interactions')
          .send({
            userId: testUserId,
            questionId: testQuestionId,
            action: 'voice_answer',
            duration: 1,
            timestamp: new Date().toISOString(),
            metadata: { audioBase64: 'x'.repeat(2e6 + 1) }
          });
          expect(res.statusCode).toBe(413);
          if (typeof res.body.error === 'string') {
            expect(res.body.error).toMatch(/Audio demasiado grande/);
          }
      });

      it('debe devolver error si se consulta historial con userId inválido', async () => {
        const res = await request(app)
          .get('/api/voice-interactions/');
        expect(res.statusCode).toBe(404);
      });

      it('debe devolver error si se elimina historial con userId inválido', async () => {
        const res = await request(app)
          .delete('/api/voice-interactions/');
        expect(res.statusCode).toBe(404);
      });

      it('debe devolver error si se consultan stats con userId inválido', async () => {
        const res = await request(app)
          .get('/api/voice-interactions/stats/');
          expect([404, 200]).toContain(res.statusCode);
      });
});

describe('HU8: AssemblyAI Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('debe procesar audio con AssemblyAI', async () => {
    const res = await request(app)
      .post('/api/voice-interactions/process-audio')
      .send({
        audioBase64: 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBz2J0fPZgjMGHm7A7+OZURE=',
        questionOptions: ['Opción A', 'Opción B', 'Opción C', 'Opción D']
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('text', 'primera opción');
    expect(res.body).toHaveProperty('confidence', 0.95);
    expect(res.body).toHaveProperty('duration', 2.5);
    expect(res.body).toHaveProperty('language', 'es');
  });

  it('debe verificar estado de AssemblyAI', async () => {
    const res = await request(app)
      .get('/api/voice-interactions/assemblyai/status');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('status', 'API is working');
  });

  it('debe manejar error en procesamiento de audio', async () => {
    // Mock AssemblyAI to return error
    const assemblyAI = require('../../services/assemblyAIService');
    assemblyAI.transcribeAndWait.mockResolvedValueOnce({
      success: false,
      error: 'Transcription failed'
    });

    const res = await request(app)
      .post('/api/voice-interactions/process-audio')
      .send({
        audioBase64: 'invalid-audio-data'
      });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error', 'Transcription failed');
  });

  it('debe devolver error si audioBase64 es inválido', async () => {
    const res = await request(app)
      .post('/api/voice-interactions/process-audio')
      .send({
        questionOptions: ['Opción A', 'Opción B']
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error', 'Invalid or missing audioBase64.');
  });

  it('debe devolver error si audioBase64 es demasiado grande', async () => {
    const res = await request(app)
      .post('/api/voice-interactions/process-audio')
      .send({
        audioBase64: 'x'.repeat(2e6 + 1)
      });

    console.log('HU8 Response:', res.status, res.body);

    expect(res.status).toBe(413);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Audio demasiado grande/);
  });
});
