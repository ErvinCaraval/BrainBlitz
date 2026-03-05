
import { fetchWithRetry } from './api';

class AssemblyAIVoiceRecognitionService {
  constructor() {
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    this.stream = null;
  }

  isAvailable() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  isListening() {
    return this.isRecording;
  }

  async start() {
    if (!this.isAvailable()) {
      throw new Error('La grabación de audio no está soportada en este navegador.');
    }

    if (this.isRecording) {
      console.warn('AssemblyAI: La grabación ya está en progreso.');
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstart = () => {
        this.isRecording = true;
        console.log('AssemblyAI: Grabación iniciada.');
      };

      this.mediaRecorder.start();
    } catch (error) {
      console.error('AssemblyAI: Error al iniciar la grabación:', error);
      throw new Error('No se pudo acceder al micrófono. Por favor, verifica los permisos.');
    }
  }

  stop() {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.isRecording) {
        return reject('No hay ninguna grabación en progreso.');
      }

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        console.log('AssemblyAI: Grabación detenida.');

        const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1];
          
          try {
            console.log('AssemblyAI: Enviando audio al backend para transcripción (voice-interactions)...');
            // Use the voice-interactions public endpoint which proxies to AssemblyAI.
            // This avoids requiring an auth token here (the assemblyai route is authenticated).
            console.log('🚀 Enviando petición al backend...');
            const response = await fetchWithRetry(`${this.apiBase}/voice-interactions/process-audio`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ audioBase64: base64Audio, mimeType: 'audio/webm' })
            });
            console.log('📦 Respuesta completa del backend:', response);

            if (response.success) {
              console.log('AssemblyAI: Transcripción recibida:', response.text);
              resolve({ 
                transcript: response.text || '',
                audioBase64: base64Audio,
                audioMimeType: 'audio/webm',
                assemblyAIResult: {
                  success: true,
                  text: response.text,
                  confidence: response.confidence,
                  language: response.language
                }
              });
            } else {
              console.error('AssemblyAI: Error en la transcripción:', response.error);
              reject(new Error(response.error || 'Error en el servidor al transcribir el audio.'));
            }
          } catch (error) {
            console.error('AssemblyAI: Error al enviar el audio al backend:', error);
            reject(new Error('No se pudo conectar con el servidor para la transcripción.'));
          }
        };

        reader.onerror = (error) => {
            console.error('AssemblyAI: Error al convertir el audio a Base64:', error);
            reject(new Error('Hubo un problema al procesar el audio grabado.'));
        };

        reader.readAsDataURL(audioBlob);
      };
      
      this.mediaRecorder.stop();
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
    });
  }

  // This method is kept for compatibility with the old interface, but the flow will need to be adapted
  // in the UI components (e.g., press and hold button to record).
  async recognizeAnswer(questionOptions = []) {
    if (this.isListening()) {
      return this.stop();
    } else {
      await this.start();
      // Indicate that listening has started. The UI will need to call stop() later.
      return { isListening: true };
    }
  }

  // Matcher function moved here from the old service to keep it consistent.
  matchAnswer(transcript, questionOptions) {
    if (!questionOptions || questionOptions.length === 0) {
      return { option: transcript, index: -1, isValid: false };
    }

    // Normalize and clean transcript: lowercase, trim, remove common punctuation
    let cleanTranscript = transcript.toLowerCase().trim().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");
    // Remove accents to more easily match words like "opción" -> "opcion"
    try {
      cleanTranscript = cleanTranscript.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
      // normalize may not be supported in some very old environments; ignore if it fails
    }
    
    // Remove common speech-to-text artifacts
    cleanTranscript = cleanTranscript
      .replace(/\bah\b/gi, 'a')    // "ah" -> "a"
      .replace(/\beh\b/gi, 'e')    // "eh" -> "e"
      .replace(/\bbe\b/gi, 'b')    // "be" -> "b"
      .replace(/\bce\b/gi, 'c')    // "ce" -> "c"
      .replace(/\bde\b/gi, 'd');   // "de" -> "d"

    console.log('🧹 Transcript limpio para matching:', cleanTranscript);

    // 1) Detect single-letter answers appearing anywhere ("a", "b", etc.) or after the word "opcion/opción"
    // More flexible pattern that catches single letters even if they're part of small words
    const letterAnywhere = cleanTranscript.match(/(?:\bopcion\b\s*)?([a-d])(?:\b|$)/);
    if (letterAnywhere) {
      const letter = letterAnywhere[1].toUpperCase();
      const index = letter.charCodeAt(0) - 65;
      if (index >= 0 && index < questionOptions.length) {
        console.log('📌 Detectada letra de opción:', letter, 'índice:', index);
        return {
          option: questionOptions[index],
          index,
          isValid: true
        };
      }
    }

    // 2) Position matches: "primera", "segunda", "tercera", "cuarta" and numeric words
    const positionPatterns = [
      /primera|primero|uno|1/,
      /segunda|segundo|dos|2/,
      /tercera|tercero|tres|3/,
      /cuarta|cuarto|cuatro|4/
    ];

    for (let i = 0; i < positionPatterns.length && i < questionOptions.length; i++) {
      if (positionPatterns[i].test(cleanTranscript)) {
        return {
          option: questionOptions[i],
          index: i,
          isValid: true
        };
      }
    }

    // 3) Partial text matches (if the transcript contains a chunk of the option text)
    for (let i = 0; i < questionOptions.length; i++) {
      const optionText = questionOptions[i].toLowerCase();
      const normalizedOption = optionText.normalize ? optionText.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : optionText;
      if (cleanTranscript.includes(normalizedOption)) {
        return {
          option: questionOptions[i],
          index: i,
          isValid: true
        };
      }
    }

    // No match found
    return {
      option: transcript,
      index: -1,
      isValid: false
    };
  }
}

const assemblyAIVoiceService = new AssemblyAIVoiceRecognitionService();
export default assemblyAIVoiceService;
