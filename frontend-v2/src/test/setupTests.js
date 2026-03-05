// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
global.localStorage = localStorageMock;

// Mock Audio API
class AudioMock {
  constructor() {
    this.onplay = null;
    this.onended = null;
    this.onerror = null;
    this.src = '';
  }
  
  play() {
    if (this.onplay) this.onplay();
    return Promise.resolve();
  }
  
  pause() {}
  
  addEventListener() {}
  removeEventListener() {}
}

global.Audio = AudioMock;

// Mock window if needed
if (typeof window === 'undefined') {
  global.window = {};
}