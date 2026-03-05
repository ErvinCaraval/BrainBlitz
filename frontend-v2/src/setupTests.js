/* global global */
import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock Web Speech APIs for testing
global.speechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [
    { name: 'Test Voice', lang: 'es-ES' }
  ]),
  onvoiceschanged: null,
  speaking: false,
  paused: false
};

global.SpeechSynthesisUtterance = vi.fn().mockImplementation((text) => ({
  text,
  rate: 1,
  volume: 1,
  pitch: 1,
  lang: 'es-ES',
  voice: null,
  onstart: null,
  onend: null,
  onerror: null
}));

global.SpeechRecognition = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  lang: 'es-ES',
  continuous: false,
  interimResults: false,
  maxAlternatives: 1,
  onstart: null,
  onresult: null,
  onerror: null,
  onend: null
}));

global.webkitSpeechRecognition = global.SpeechRecognition;
