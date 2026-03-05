// Voice Interactions Service - Log voice interactions to backend
class VoiceInteractionsService {
  constructor() {
    // Use runtime environment configuration
    if (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) {
      this.apiBase = window.ENV.VITE_API_URL;
    } else {
      // Fallback a import.meta.env (build-time)
      const envApi = import.meta.env.VITE_API_URL;
      if (envApi) {
        this.apiBase = envApi;
      } else {
        // Last resort: detect environment
        const isBrowser = typeof window !== 'undefined';
        const isLocalHost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        this.apiBase = isLocalHost ? 'http://localhost:5000/api' : 'https://proyecto-2-olvb.onrender.com/api';
      }
    }
    this.sessionId = this.generateSessionId();
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async logInteraction(interaction) {
    try {
      // Ensure required fields for backend validation
      const safeDuration = typeof interaction.duration === 'number' && interaction.duration >= 0 ? interaction.duration : 0;
      const safeMetadata = interaction.metadata && typeof interaction.metadata === 'object' ? interaction.metadata : {};
      const safeTimestamp = interaction.timestamp && !isNaN(Date.parse(interaction.timestamp))
        ? interaction.timestamp
        : new Date().toISOString();

      const payload = {
        ...interaction,
        duration: safeDuration,
        metadata: safeMetadata,
        sessionId: this.sessionId,
        timestamp: safeTimestamp
      };

      console.log('[VoiceInteractionsService] Log interaction:', payload);
      const response = await fetch(`${this.apiBase}/voice-interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('[VoiceInteractionsService] Log result:', result);
      return result;
    } catch (error) {
      console.error('Error logging voice interaction:', error);
      // Don't throw error to avoid breaking the user experience
      return null;
    }
  }

  async processAudioWithAssemblyAI(audioBase64, questionOptions, mimeType) {
    try {
      const response = await fetch(`${this.apiBase}/voice-interactions/process-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audioBase64, questionOptions, mimeType })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return {
          success: false,
          error: err.error || `HTTP ${response.status}`,
          suggestions: err.suggestions || []
        };
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error processing audio with AssemblyAI:', error);
      return { success: false, error: error.message };
    }
  }

  async logQuestionRead(userId, questionId, questionText, duration) {
    return this.logInteraction({
      userId,
      questionId,
      action: 'question_read',
      duration,
      voiceText: questionText,
      metadata: {
        questionText,
        readType: 'full_question'
      }
    });
  }

  async logOptionRead(userId, questionId, optionIndex, optionText, duration) {
    return this.logInteraction({
      userId,
      questionId,
      action: 'option_read',
      duration,
      voiceText: optionText,
      metadata: {
        optionIndex,
        optionText,
        optionLetter: String.fromCharCode(65 + optionIndex)
      }
    });
  }

  async logVoiceAnswer(userId, questionId, voiceResponse, confidence, matchedOption, answerIndex, duration = 0, audioBase64, assemblyAIResult, audioMimeType) {
    // Log timestamp and duration for backend validation
    const metadata = {
      matchedOption,
      answerIndex,
      recognitionType: 'voice_command'
    };
    // Evitar payloads muy grandes que rompen el backend (413)
    if (audioBase64 && audioBase64.length <= 1000000) {
      metadata.audioBase64 = audioBase64;
    } else if (audioBase64) {
      metadata.audioTooLarge = true;
    }
    if (audioMimeType) {
      metadata.mimeType = audioMimeType;
    }
    if (assemblyAIResult) {
      // Only include safe subset to avoid large payloads
      metadata.assemblyAIResult = {
        success: !!assemblyAIResult.success,
        text: assemblyAIResult.text,
        confidence: assemblyAIResult.confidence,
        language: assemblyAIResult.language
      };
      metadata.assemblyAIUsed = !!assemblyAIResult.success;
    }
    const action = (assemblyAIResult && assemblyAIResult.success) ? 'voice_answer_assemblyai' : 'voice_answer';
    return this.logInteraction({
      userId,
      questionId,
      action,
      duration: typeof duration === 'number' && duration >= 0 ? duration : 0,
      voiceText: voiceResponse,
      confidence,
      timestamp: new Date().toISOString(),
      metadata
    });
  }

  async logSettingsChange(userId, oldSettings, newSettings) {
    return this.logInteraction({
      userId,
      questionId: 'settings',
      action: 'settings_changed',
      duration: 0,
      metadata: {
        oldSettings,
        newSettings,
        changedFields: Object.keys(newSettings).filter(key => 
          oldSettings[key] !== newSettings[key]
        )
      }
    });
  }

  async logTutorialInteraction(userId, tutorialStep, action, duration) {
    return this.logInteraction({
      userId,
      questionId: 'tutorial',
      action: `tutorial_${action}`,
      duration,
      metadata: {
        tutorialStep,
        action
      }
    });
  }

  async getUserVoiceHistory(userId) {
    try {
      console.log('[VoiceInteractionsService] Fetching voice history for:', userId);
      const response = await fetch(`${this.apiBase}/voice-interactions/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[VoiceInteractionsService] Voice history result:', data);
      return data;
    } catch (error) {
      console.error('Error fetching user voice history:', error);
      return [];
    }
  }

  async getUserVoiceStats(userId) {
    try {
      const response = await fetch(`${this.apiBase}/voice-interactions/stats/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching voice stats:', error);
      return {
        total: 0,
        averageDuration: 0
      };
    }
  }

  async deleteUserVoiceHistory(userId) {
    try {
      const response = await fetch(`${this.apiBase}/voice-interactions/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting voice history:', error);
      return null;
    }
  }

  getSessionId() {
    return this.sessionId;
  }

  // Helper method to measure duration
  createTimer() {
    const startTime = Date.now();
    return {
      getDuration: () => Date.now() - startTime
    };
  }
}

// Create singleton instance
const voiceInteractionsService = new VoiceInteractionsService();

export default voiceInteractionsService;
