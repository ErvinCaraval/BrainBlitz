'use strict';

// Load env vars (no-op if already loaded)
try { require('dotenv').config(); } catch (_) {}

const DEFAULT_BASE_URL = 'https://api.assemblyai.com/v2';

async function ensureFetch() {
  if (typeof fetch !== 'undefined') return fetch;
  // Lazy import node-fetch if needed (Node <18)
  const mod = await import('node-fetch');
  return mod.default || mod;
}

function parseDataUrl(dataUrl) {
  // Example: data:audio/wav;base64,AAAA...
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  const mimeType = match[1];
  const base64 = match[2];
  return { mimeType, buffer: Buffer.from(base64, 'base64') };
}

class AssemblyAIService {
  constructor() {
    this.baseURL = DEFAULT_BASE_URL;
    this.apiKey = process.env.ASSEMBLYAI_API_KEY || '';
  }

  isAvailable() {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0;
  }

  async checkAPIStatus() {
    return {
      available: this.isAvailable(),
      service: 'AssemblyAI'
    };
  }

  async uploadAudioFromDataUrl(dataUrl) {
    const { buffer } = parseDataUrl(dataUrl);
    const f = await ensureFetch();
    const resp = await f(`${this.baseURL}/upload`, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: buffer
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`AssemblyAI upload failed: ${resp.status} ${errText}`);
    }
    const json = await resp.json();
    // { upload_url: "https://cdn.assemblyai.com/upload/.." }
    if (!json || !json.upload_url) {
      throw new Error('AssemblyAI upload did not return upload_url');
    }
    return json.upload_url;
  }

  async createTranscript(payload) {
    const f = await ensureFetch();
    const resp = await f(`${this.baseURL}/transcript`, {
      method: 'POST',
      headers: {
        Authorization: this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`AssemblyAI transcript create failed: ${resp.status} ${errText}`);
    }
    return await resp.json();
  }

  async getTranscript(id) {
    const f = await ensureFetch();
    const resp = await f(`${this.baseURL}/transcript/${id}`, {
      method: 'GET',
      headers: {
        Authorization: this.apiKey
      }
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`AssemblyAI transcript get failed: ${resp.status} ${errText}`);
    }
    return await resp.json();
  }

  async transcribeAndWait(audioUrlOrDataUrl, options = {}) {
    if (!this.isAvailable()) {
      return { success: false, error: 'AssemblyAI API key not configured' };
    }

    try {
      let audio_url = audioUrlOrDataUrl;
      if (typeof audioUrlOrDataUrl === 'string' && audioUrlOrDataUrl.startsWith('data:')) {
        audio_url = await this.uploadAudioFromDataUrl(audioUrlOrDataUrl);
      }

      const request = {
        audio_url,
        language_code: options.language_code || 'es',
        punctuate: options.punctuate !== false,
        format_text: options.format_text !== false,
      };

      const created = await this.createTranscript(request);
      const id = created.id;
      const startedAt = Date.now();
      const timeoutMs = typeof options.timeoutMs === 'number' ? options.timeoutMs : 120000; // 2 min
      const pollIntervalMs = 1500;

      while (true) {
        if (Date.now() - startedAt > timeoutMs) {
          return { success: false, error: 'Transcription timed out' };
        }

        const status = await this.getTranscript(id);
        if (status.status === 'completed') {
          return {
            success: true,
            text: status.text || '',
            confidence: typeof status.confidence === 'number' ? status.confidence : undefined,
            duration: status.audio_duration,
            language: status.language_code || request.language_code
          };
        }
        if (status.status === 'error') {
          return { success: false, error: status.error || 'Transcription error' };
        }
        await new Promise(r => setTimeout(r, pollIntervalMs));
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  generateSuggestions(questionOptions = []) {
    if (!Array.isArray(questionOptions) || questionOptions.length === 0) return [];
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const tips = [
      'Di la letra de la opción (A, B, C...)',
      'Di el número de la opción (1, 2, 3...)',
      'Di parte del texto de la opción'
    ];
    const optionsList = questionOptions.slice(0, letters.length).map((opt, i) => `${letters[i]}: ${opt}`);
    return [...tips, ...optionsList];
  }

  async processVoiceAnswer(audioUrlOrDataUrl, questionOptions = []) {
    const result = await this.transcribeAndWait(audioUrlOrDataUrl, {
      language_code: 'es',
      punctuate: true,
      format_text: true
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
        suggestions: this.generateSuggestions(questionOptions)
      };
    }

    const { matchVoiceResponse } = require('../utils/voiceRecognition');
    const validation = matchVoiceResponse(result.text, questionOptions);
    return {
      success: true,
      text: result.text,
      confidence: result.confidence,
      duration: result.duration,
      language: result.language,
      validation,
      suggestions: !validation.isValid ? this.generateSuggestions(questionOptions) : []
    };
  }

  // Controller-facing helpers (used by assemblyAIController)
  async speechToText(audioUrlOrDataUrl, options = {}) {
    return this.transcribeAndWait(audioUrlOrDataUrl, options);
  }

  async processAudio(audioBase64, options = {}) {
    const mimeType = options.mimeType || 'audio/wav';
    const dataUrl = `data:${mimeType};base64,${audioBase64}`;
    return this.transcribeAndWait(dataUrl, options);
  }

  async textToSpeech(text, options = {}) {
    // AssemblyAI does not provide TTS; return a clear error
    return { success: false, error: 'Text-to-Speech no soportado por AssemblyAI' };
  }

  async getAvailableVoices() {
    // Not applicable for AssemblyAI; return empty list
    return { success: true, voices: [] };
  }
}

module.exports = new AssemblyAIService();

