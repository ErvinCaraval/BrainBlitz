const request = require('supertest');

// Mock Firebase before importing the server
const mockUsers = [];
const mockVoiceInteractions = [];

jest.mock('../../firebase', () => ({
  db: {
    collection: jest.fn((collectionName) => {
      if (collectionName === 'users') {
        return {
          doc: jest.fn((uid) => ({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => mockUsers.find(u => u.uid === uid) || {
                uid,
                email: 'test@example.com',
                displayName: 'Test User',
                visualDifficulty: false,
                stats: {}
              }
            }),
            update: jest.fn().mockImplementation(async (data) => {
              const userIndex = mockUsers.findIndex(u => u.uid === uid);
              if (userIndex !== -1) {
                mockUsers[userIndex] = { ...mockUsers[userIndex], ...data };
              }
            })
          })),
          get: jest.fn().mockResolvedValue({
            forEach: jest.fn((callback) => {
              mockUsers.forEach(user => callback({
                id: user.uid,
                data: () => user
              }));
            })
          }),
          where: jest.fn().mockImplementation((field, operator, value) => {
            const filteredUsers = mockUsers.filter(user => {
              if (field === 'visualDifficulty' && operator === '==') {
                return user.visualDifficulty === value;
              }
              return true;
            });
            
            return {
              get: jest.fn().mockResolvedValue({
                forEach: jest.fn((callback) => {
                  filteredUsers.forEach(user => callback({
                    id: user.uid,
                    data: () => user
                  }));
                })
              })
            };
          })
        };
      } else if (collectionName === 'voiceInteractions') {
        return {
          where: jest.fn().mockImplementation((field, operator, value) => {
            let filteredInteractions = mockVoiceInteractions;
            
            if (field === 'userId' && operator === '==') {
              filteredInteractions = mockVoiceInteractions.filter(interaction => 
                interaction.userId === value
              );
            } else if (field === 'timestamp' && operator === '>=') {
              const startDate = new Date(value);
              filteredInteractions = filteredInteractions.filter(interaction => 
                new Date(interaction.timestamp) >= startDate
              );
            } else if (field === 'timestamp' && operator === '<=') {
              const endDate = new Date(value);
              filteredInteractions = filteredInteractions.filter(interaction => 
                new Date(interaction.timestamp) <= endDate
              );
            }
            
            return {
              where: jest.fn().mockReturnThis(),
              get: jest.fn().mockResolvedValue({
                forEach: jest.fn((callback) => {
                  filteredInteractions.forEach(interaction => callback({
                    id: interaction.id,
                    data: () => interaction
                  }));
                })
              })
            };
          }),
          get: jest.fn().mockResolvedValue({
            forEach: jest.fn((callback) => {
              mockVoiceInteractions.forEach(interaction => callback({
                id: interaction.id,
                data: () => interaction
              }));
            })
          })
        };
      }
    })
  }
}));

// Mock authentication middleware
jest.mock('../../middleware/authenticate', () => (req, res, next) => {
  req.user = { uid: 'test-user-123' };
  next();
});

// Mock rate limiter
jest.mock('../../middleware/rateLimiter', () => ({
  generalUserLimiter: (req, res, next) => next()
}));

// Mock the server to avoid port conflicts
jest.mock('../../hybridServer', () => {
  const express = require('express');
  const app = express();
  
  // Configure body parser
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));
  
  // Import routes
  const adminAccessibilityRouter = require('../../routes/adminAccessibility');
  app.use('/api/admin', adminAccessibilityRouter);
  
  return { app };
});

const { app } = require('../../hybridServer');

describe('HU7: Admin Accessibility API', () => {
  beforeEach(() => {
    // Clear mock data before each test
    mockUsers.length = 0;
    mockVoiceInteractions.length = 0;
    jest.clearAllMocks();
  });

  describe('GET /api/admin/accessibility', () => {
    it('debe obtener configuración de accesibilidad del usuario', async () => {
      // Add mock user data
      mockUsers.push({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        visualDifficulty: true,
        stats: { gamesPlayed: 5 }
      });

      const res = await request(app)
        .get('/api/admin/accessibility');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('visualDifficulty', true);
      expect(res.body).toHaveProperty('email', 'test@example.com');
      expect(res.body).toHaveProperty('displayName', 'Test User');
    });
  });

  describe('PUT /api/admin/accessibility', () => {
    it('debe actualizar configuración de accesibilidad del usuario', async () => {
      // Add mock user data
      mockUsers.push({
        uid: 'test-user-123',
        email: 'test@example.com',
        displayName: 'Test User',
        visualDifficulty: false
      });

      const res = await request(app)
        .put('/api/admin/accessibility')
        .send({ visualDifficulty: true });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('visualDifficulty', true);
    });

    it('debe devolver error si visualDifficulty no es booleano', async () => {
      const res = await request(app)
        .put('/api/admin/accessibility')
        .send({ visualDifficulty: 'true' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'visualDifficulty debe ser booleano');
    });
  });

  describe('GET /api/admin/accessibility/stats', () => {
    it('debe obtener estadísticas de accesibilidad del usuario', async () => {
      // Add mock voice interactions
      mockVoiceInteractions.push(
        { id: '1', userId: 'test-user-123', duration: 2.5, action: 'voice_answer' },
        { id: '2', userId: 'test-user-123', duration: 1.2, action: 'question_read' }
      );

      const res = await request(app)
        .get('/api/admin/accessibility/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalInteractions', 2);
      expect(res.body).toHaveProperty('averageDuration');
    });
  });

  describe('GET /api/admin/accessibility-stats', () => {
    it('debe obtener estadísticas globales de accesibilidad', async () => {
      // Add mock users
      mockUsers.push(
        { uid: 'user1', visualDifficulty: true },
        { uid: 'user2', visualDifficulty: false },
        { uid: 'user3', visualDifficulty: true }
      );

      // Add mock voice interactions
      mockVoiceInteractions.push(
        { id: '1', userId: 'user1', duration: 2.5, action: 'voice_answer' },
        { id: '2', userId: 'user3', duration: 1.2, action: 'question_read' }
      );

      const res = await request(app)
        .get('/api/admin/accessibility-stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalUsers', 3);
      expect(res.body).toHaveProperty('usersWithVisualDifficulty', 2);
      expect(res.body).toHaveProperty('adoptionRate');
      expect(res.body).toHaveProperty('totalVoiceInteractions', 2);
    });
  });

  describe('GET /api/admin/voice-mode-users', () => {
    it('debe obtener lista de usuarios con modo de voz', async () => {
      // Add mock users with visual difficulty
      mockUsers.push(
        { 
          uid: 'user1', 
          email: 'user1@example.com', 
          displayName: 'User 1', 
          visualDifficulty: true,
          createdAt: new Date(),
          lastLogin: new Date()
        },
        { 
          uid: 'user2', 
          email: 'user2@example.com', 
          displayName: 'User 2', 
          visualDifficulty: false
        },
        { 
          uid: 'user3', 
          email: 'user3@example.com', 
          displayName: 'User 3', 
          visualDifficulty: true,
          createdAt: new Date(),
          lastLogin: new Date()
        }
      );

      const res = await request(app)
        .get('/api/admin/voice-mode-users');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total', 2);
      expect(res.body).toHaveProperty('users');
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0]).toHaveProperty('visualDifficulty', true);
    });
  });

  describe('GET /api/admin/accessibility-settings', () => {
    it('debe obtener configuración global de accesibilidad', async () => {
      const res = await request(app)
        .get('/api/admin/accessibility-settings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('voiceModeEnabled', true);
      expect(res.body).toHaveProperty('defaultVoiceSettings');
      expect(res.body).toHaveProperty('maxAudioSize', 2e6);
      expect(res.body).toHaveProperty('features');
    });
  });

  describe('PUT /api/admin/accessibility-settings', () => {
    it('debe actualizar configuración global de accesibilidad', async () => {
      const res = await request(app)
        .put('/api/admin/accessibility-settings')
        .send({
          voiceModeEnabled: false,
          maxAudioSize: 5e6,
          features: {
            textToSpeech: false,
            speechRecognition: true
          }
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('voiceModeEnabled', false);
      expect(res.body).toHaveProperty('maxAudioSize', 5e6);
      expect(res.body.features).toHaveProperty('textToSpeech', false);
    });

    it('debe devolver error si voiceModeEnabled no es booleano', async () => {
      const res = await request(app)
        .put('/api/admin/accessibility-settings')
        .send({ voiceModeEnabled: 'true' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'voiceModeEnabled debe ser booleano');
    });

    it('debe devolver error si maxAudioSize no es válido', async () => {
      const res = await request(app)
        .put('/api/admin/accessibility-settings')
        .send({ maxAudioSize: -1000 });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error', 'maxAudioSize debe ser un número positivo');
    });
  });

  describe('GET /api/admin/accessibility-report', () => {
    it('debe generar reporte de accesibilidad', async () => {
      // Add mock users
      mockUsers.push(
        { uid: 'user1', visualDifficulty: true },
        { uid: 'user2', visualDifficulty: false }
      );

      // Add mock voice interactions
      mockVoiceInteractions.push(
        { 
          id: '1', 
          userId: 'user1', 
          duration: 2.5, 
          action: 'voice_answer',
          timestamp: new Date().toISOString()
        },
        { 
          id: '2', 
          userId: 'user1', 
          duration: 1.2, 
          action: 'question_read',
          timestamp: new Date().toISOString()
        }
      );

      const res = await request(app)
        .get('/api/admin/accessibility-report');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('userStats');
      expect(res.body).toHaveProperty('voiceStats');
      expect(res.body).toHaveProperty('generatedAt');
      expect(res.body.userStats).toHaveProperty('totalUsers', 2);
      expect(res.body.userStats).toHaveProperty('usersWithVisualDifficulty', 1);
    });

    it('debe generar reporte con filtros de fecha', async () => {
      const startDate = new Date('2024-01-01').toISOString();
      const endDate = new Date('2024-12-31').toISOString();

      const res = await request(app)
        .get(`/api/admin/accessibility-report?startDate=${startDate}&endDate=${endDate}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('period');
      expect(res.body.period).toHaveProperty('startDate', startDate);
      expect(res.body.period).toHaveProperty('endDate', endDate);
    });
  });
});
