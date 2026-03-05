// Voice Service - Azure Text-to-Speech functionality
class VoiceService {
  constructor() {
    this.isWebSpeechAvailable = true; // Siempre disponible ya que usamos Azure
    this.audioElement = null;
    this.isSpeaking = false;
    this.settings = {
      rate: 1.0,
      volume: 1.0,
      pitch: 1.0,
      voiceName: null,
      language: 'es-ES',
      style: 'general',
      role: 'default'
    };
    
    // Configurar la URL base del backend usando window.ENV (runtime configuration)
    // o fallback a import.meta.env (build-time configuration)
    let apiUrl = null;
    
    // Primero intentar window.ENV (inyectado en runtime)
    if (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) {
      apiUrl = window.ENV.VITE_API_URL;
    }
    
    // Fallback a import.meta.env (variable de build)
    if (!apiUrl && typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
      apiUrl = import.meta.env.VITE_API_URL;
    }
    
    // Fallback a entorno (por si estamos en Node.js)
    if (!apiUrl && typeof process !== 'undefined' && process.env?.VITE_API_URL) {
      apiUrl = process.env.VITE_API_URL;
    }
    
    // Último fallback: detectar ambiente y usar URL por defecto
    if (!apiUrl) {
      const isProd = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
      apiUrl = isProd ? 'https://proyecto-2-olvb.onrender.com/api' : 'http://localhost:5000/api';
    }

    this.baseUrl = apiUrl;
    
    console.log('[VoiceService] Initialized with baseUrl:', this.baseUrl);
    
    // Load settings from localStorage if available
    if (typeof localStorage !== 'undefined') {
      this.loadSettings();
    } else {
      console.log('localStorage not available, using default settings');
    }
    
    // Initialize audio element if available
    if (typeof Audio !== 'undefined') {
      this.initAudioElement();
    } else {
      console.log('Audio API not available, skipping audio initialization');
    }
    
    // Load available voices (después de un pequeño delay para asegurar que la autenticación esté lista)
    setTimeout(() => {
      this.loadVoices();
    }, 1000);
  }

  async getAuthToken() {
    // Intentar obtener el token de Firebase
    try {
      const { auth } = await import('./firebase');
      const currentUser = auth.currentUser;
      if (currentUser) {
        return await currentUser.getIdToken();
      }
    } catch (error) {
      console.error('Error getting Firebase token:', error);
    }

    // Si no se pudo obtener el token de Firebase, intentar obtenerlo del localStorage
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token available");
    }
    return token;
  }

  async getAuthHeaders() {
    const token = await this.getAuthToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    };
  }

  // Fallback to the browser's SpeechSynthesis API when backend or auth
  // is not available. This lets the app still speak short messages
  // (like confirmations) even if the TTS backend or auth token is missing.
  async localSpeak(text, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        if (typeof window === 'undefined' || !window.speechSynthesis) {
          return reject(new Error('Browser speechSynthesis not available'));
        }

        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = options.language || this.settings.language || 'es-ES';
        utter.volume = options.volume || this.settings.volume || 1.0;
        utter.rate = options.rate || this.settings.rate || 1.0;
        utter.pitch = options.pitch || this.settings.pitch || 1.0;

        // Try to pick a voice name if available
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find(v => v.name === (options.voiceName || this.settings.voiceName));
        if (preferred) utter.voice = preferred;

        utter.onend = () => resolve();
        utter.onerror = (e) => reject(e.error || new Error('SpeechSynthesis error'));

        window.speechSynthesis.cancel(); // stop any existing
        window.speechSynthesis.speak(utter);
      } catch (err) {
        reject(err);
      }
    });
  }

  async checkBackendConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      const data = await response.json();
      console.log('Backend connection status:', data);
      if (!data.services.includes('tts')) {
        console.warn('TTS service not available in backend');
      }
    } catch (error) {
      console.error('Failed to connect to backend:', error);
    }
  }

  initAudioElement() {
    this.audioElement = new Audio();
    
    this.audioElement.onplay = () => {
      console.log('Audio playback started');
      this.isSpeaking = true;
    };
    
    this.audioElement.onended = () => {
      console.log('Audio playback completed');
      this.isSpeaking = false;
    };
    
    this.audioElement.onerror = (e) => {
      this.isSpeaking = false;
      const error = e.target.error;
      console.error('Audio playback error:', {
        code: error.code,
        message: error.message,
        name: error.name,
        details: {
          currentSrc: this.audioElement.currentSrc,
          readyState: this.audioElement.readyState,
          networkState: this.audioElement.networkState
        }
      });
    };

    // Monitorear el estado de buffering
    this.audioElement.onwaiting = () => {
      console.log('Audio is buffering...');
    };

    this.audioElement.oncanplaythrough = () => {
      console.log('Audio can play through without buffering');
    };
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('voiceSettings');
      if (saved) {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Error loading voice settings:', error);
    }
  }

  saveSettings() {
    try {
  localStorage.setItem('voiceSettings', JSON.stringify(this.settings));
    } catch (error) {
      console.warn('Error saving voice settings:', error);
    }
  }

  async loadVoices() {
    try {
      const headers = await this.getAuthHeaders();
      
      console.log('Fetching voices from:', `${this.baseUrl}/tts/voices`);
      const response = await fetch(`${this.baseUrl}/tts/voices`, {
        headers
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Failed to load voices: ${response.status} ${response.statusText}\n${errorData.error || ''}`);
      }
      
      const voices = await response.json();
      console.log('Loaded voices:', voices);
      
      // Asegurarse de que voices es un array
      if (!Array.isArray(voices)) {
        console.error('Received invalid voices data:', voices);
        this.availableVoices = [];
        return;
      }
      
      this.availableVoices = voices;
      
      // Buscar una voz en español
      const spanishVoice = voices.find(voice => 
        voice.locale?.includes('es-ES') || voice.locale?.includes('es-MX')
      );
      
      if (spanishVoice && !this.settings.voiceName) {
        console.log('Selected Spanish voice:', spanishVoice);
        this.settings.voiceName = spanishVoice.name;
        this.saveSettings();
      }
    } catch (error) {
      console.error('Error loading voices:', error);
      this.availableVoices = [];
      // No lanzar el error para evitar que rompa la inicialización
    }
  }

  async speak(text, options = {}) {
    if (!this.isWebSpeechAvailable) {
      console.warn('Speech service not available');
      return Promise.reject(new Error('Speech service not available'));
    }

    // Validación del texto
    if (!text || typeof text !== 'string') {
      const error = new Error('Invalid text input');
      console.error('Speech synthesis error:', error);
      return Promise.reject(error);
    }

    // Si el mensaje es feedback de respuesta, esperar a que termine el anterior antes de hablar
    const isFeedback = options && options.action === 'answer_result';
    
    const speakPromise = async () => {
      try {
        // Verificar autenticación primero. Si no hay token o el backend no
        // está accesible, hacemos un fallback a la API Web Speech del
        // navegador para no romper pequeñas confirmaciones.
        let headers;
        try {
          headers = await this.getAuthHeaders();
        } catch (authErr) {
          console.warn('Auth or backend unavailable, falling back to browser TTS:', authErr);
          return this.localSpeak(text, options);
        }

        // Stop any current speech SOLO si no es feedback, o si no hay nada hablando
        if (!isFeedback || !this.isSpeaking) {
          this.stop();
        }

        const apiUrl = `${this.baseUrl}/tts/synthesize`;
        // Get the selected voice details from available voices
        const selectedVoice = this.availableVoices.find(v => 
          v.name === (options.voiceName || this.settings.voiceName)
        );

        const requestBody = {
          text,
          options: {
            ...this.settings,
            ...options,
            voiceName: options.voiceName || this.settings.voiceName,
            language: options.language || this.settings.language,
            gender: selectedVoice?.gender || 'Female',
            // Asegurar que los valores numéricos sean válidos
            rate: parseFloat(options.rate || this.settings.rate || 1.0),
            pitch: parseFloat(options.pitch || this.settings.pitch || 1.0),
            volume: parseFloat(options.volume || this.settings.volume || 1.0)
          }
        };

        console.log('TTS Request:', {
          url: apiUrl,
          body: requestBody,
          selectedVoice,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer: [REDACTED]'
          }
        });

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody)
        });

        console.log('TTS Response status:', {
          status: response.status,
          statusText: response.statusText
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `TTS API responded with ${response.status}: ${response.statusText}\n` +
            `Details: ${errorData.details || errorData.error || 'Unknown error'}`
          );
        }

        const contentType = response.headers.get('content-type');
        console.log('Response Content-Type:', contentType);

        const audioBlob = await response.blob();
        console.log('Audio blob size:', audioBlob.size, 'bytes');
        
        const audioUrl = URL.createObjectURL(audioBlob);

        this.audioElement.src = audioUrl;
        this.audioElement.volume = options.volume || this.settings.volume;

        console.log('Playing audio...');
        await this.audioElement.play();

        return new Promise((resolve, reject) => {
          this.audioElement.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };
          this.audioElement.onerror = (error) => {
            console.error('Audio playback error:', error);
            URL.revokeObjectURL(audioUrl);
            reject(new Error('Error playing audio'));
          };
        });
      } catch (error) {
        console.error('Speech synthesis error:', error);
        throw error;
      }
    };

    if (isFeedback && this.isSpeaking) {
      // Esperar a que termine la locución actual antes de hablar feedback
      return new Promise((resolve, reject) => {
        const wait = () => {
          if (!this.isSpeaking) {
            speakPromise().then(resolve).catch(reject);
          } else {
            setTimeout(wait, 100);
          }
        };
        wait();
      });
    } else {
      return speakPromise();
    }
  }

  stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.isSpeaking = false;
    }
  }

  pause() {
    if (this.audioElement && !this.audioElement.paused) {
      this.audioElement.pause();
    }
  }

  resume() {
    if (this.audioElement && this.audioElement.paused) {
      this.audioElement.play();
    }
  }

  updateSettings(newSettings) {
    // Validar y procesar las nuevas configuraciones
    const settingsToSave = { ...newSettings };
    
    // Si viene un objeto de voz, solo guardar el nombre
    if (settingsToSave.voice && settingsToSave.voice.name) {
      settingsToSave.voiceName = settingsToSave.voice.name;
      delete settingsToSave.voice;
    }

    // Asegurarse de que el idioma sea válido
    if (settingsToSave.language) {
      const isValidLanguage = this.availableVoices.some(
        voice => voice.locale === settingsToSave.language
      );
      if (!isValidLanguage) {
        console.warn('Invalid language selected:', settingsToSave.language);
        delete settingsToSave.language;
      }
    }

    // Actualizar configuraciones
    this.settings = { ...this.settings, ...settingsToSave };
    console.log('Updated voice settings:', this.settings);
    
    // Guardar en localStorage
    this.saveSettings();
  }

  getSettings() {
  return { ...this.settings };
  }

  getAvailableVoices() {
    return this.availableVoices || [];
  }

  isAvailable() {
    return this.isWebSpeechAvailable;
  }

  getStatus() {
    return {
      isAvailable: this.isWebSpeechAvailable,
      isSpeaking: this.isSpeaking,
      isPaused: this.isWebSpeechAvailable ? speechSynthesis.paused : false,
      settings: this.getSettings(),
      availableVoices: this.getAvailableVoices().length
    };
  }
}

// Create singleton instance
const voiceService = new VoiceService();

export default voiceService;
