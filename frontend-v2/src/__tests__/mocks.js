import { vi } from 'vitest';

// Mock Firebase Auth
export const mockUser = {
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  getIdToken: vi.fn().mockResolvedValue('mock-token')
};

export const mockAuth = {
  currentUser: mockUser,
  onAuthStateChanged: vi.fn((callback) => {
    callback(mockUser);
    return vi.fn(); // unsubscribe function
  })
};

// Mock Firebase
vi.mock('../services/firebase', () => ({
  auth: mockAuth,
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            email: 'test@example.com',
            displayName: 'Test User',
            visualDifficulty: false,
            stats: { gamesPlayed: 0, wins: 0, correctAnswers: 0 }
          })
        }),
        set: vi.fn().mockResolvedValue(),
        update: vi.fn().mockResolvedValue()
      }))
    }))
  }
}));

// Mock voice services
vi.mock('../services/voiceService', () => ({
  default: {
    speak: vi.fn().mockResolvedValue(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    updateSettings: vi.fn(),
    getSettings: vi.fn(() => ({
      rate: 1.0,
      volume: 1.0,
      pitch: 1.0,
      voice: null,
      language: 'es-ES'
    })),
    getStatus: vi.fn(() => ({
      isAvailable: true,
      isSpeaking: false,
      isPaused: false,
      settings: {},
      availableVoices: 1
    })),
    isAvailable: vi.fn(() => true),
    getAvailableVoices: vi.fn(() => [
      { name: 'Test Voice', lang: 'es-ES' }
    ])
  }
}));

vi.mock('../services/voiceInteractionsService', () => ({
  default: {
    logInteraction: vi.fn().mockResolvedValue(),
    logQuestionRead: vi.fn().mockResolvedValue(),
    logOptionRead: vi.fn().mockResolvedValue(),
    logVoiceAnswer: vi.fn().mockResolvedValue(),
    logSettingsChange: vi.fn().mockResolvedValue(),
    logTutorialInteraction: vi.fn().mockResolvedValue(),
    getUserVoiceHistory: vi.fn().mockResolvedValue([]),
    getUserVoiceStats: vi.fn().mockResolvedValue({ total: 0, averageDuration: 0 }),
    deleteUserVoiceHistory: vi.fn().mockResolvedValue(),
    createTimer: vi.fn(() => ({
      getDuration: vi.fn(() => 1000)
    }))
  }
}));

vi.mock('../services/voiceRecognitionService', () => ({
  default: {
    recognizeAnswer: vi.fn().mockResolvedValue({
      transcript: 'A',
      confidence: 0.9,
      matchedOption: 'Option A',
      matchedIndex: 0,
      isValid: true
    }),
    stopRecognition: vi.fn(),
    updateSettings: vi.fn(),
    getSettings: vi.fn(() => ({
      language: 'es-ES',
      continuous: false,
      interimResults: false,
      maxAlternatives: 1
    })),
    isAvailable: vi.fn(() => true),
    getStatus: vi.fn(() => ({
      isAvailable: true,
      isListening: false,
      language: 'es-ES',
      settings: {}
    })),
    checkMicrophonePermission: vi.fn().mockResolvedValue(true),
    getAvailableLanguages: vi.fn(() => [
      { code: 'es-ES', name: 'Español (España)' }
    ])
  }
}));
