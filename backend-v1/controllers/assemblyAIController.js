const assemblyAIService = require('../services/assemblyAIService');

// [HU8] Text-to-Speech endpoint
exports.textToSpeech = async (req, res) => {
  try {
    const { text, voice, speed, format } = req.body;
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required and must be a string' });
    }

    if (text.length > 5000) {
      return res.status(400).json({ error: 'Text too long. Maximum 5000 characters.' });
    }

    const result = await assemblyAIService.textToSpeech(text, {
      voice: voice || 'es-ES-EnriqueNeural',
      speed: speed || 1.0,
      format: format || 'mp3'
    });

    res.json(result);
  } catch (error) {
    console.error('TTS Controller Error:', error);
    res.status(500).json({ 
      error: error.message,
      available: assemblyAIService.isAvailable()
    });
  }
};

// [HU8] Speech-to-Text endpoint
exports.speechToText = async (req, res) => {
  try {
    const { audioUrl, language, punctuate, formatText, speakerLabels } = req.body;
    
    if (!audioUrl || typeof audioUrl !== 'string') {
      return res.status(400).json({ error: 'audioUrl is required and must be a string' });
    }

    const result = await assemblyAIService.speechToText(audioUrl, {
      language: language || 'es',
      punctuate: punctuate !== false,
      formatText: formatText !== false,
      speakerLabels: speakerLabels || false
    });

    res.json(result);
  } catch (error) {
    console.error('STT Controller Error:', error);
    res.status(500).json({ 
      error: error.message,
      available: assemblyAIService.isAvailable()
    });
  }
};

// [HU8] Procesar audio base64
exports.processAudio = async (req, res) => {
  try {
    const { audioBase64, language, punctuate, formatText, mimeType } = req.body;
    
    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return res.status(400).json({ error: 'audioBase64 is required and must be a string' });
    }

    // Validar que sea base64 válido
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(audioBase64)) {
      return res.status(400).json({ error: 'Invalid base64 format' });
    }

    const result = await assemblyAIService.processAudio(audioBase64, {
      mimeType: typeof mimeType === 'string' ? mimeType : undefined,
      language: language || 'es',
      punctuate: punctuate !== false,
      formatText: formatText !== false
    });

    res.json(result);
  } catch (error) {
    console.error('Audio Processing Controller Error:', error);
    res.status(500).json({ 
      error: error.message,
      available: assemblyAIService.isAvailable()
    });
  }
};

// [HU8] Obtener voces disponibles
exports.getVoices = async (req, res) => {
  try {
    const result = await assemblyAIService.getAvailableVoices();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Voices Controller Error:', error);
    res.status(500).json({ 
      error: error.message,
      available: assemblyAIService.isAvailable()
    });
  }
};

// [HU8] Verificar estado del servicio
exports.getStatus = async (req, res) => {
  try {
    res.json({
      available: assemblyAIService.isAvailable(),
      service: 'AssemblyAI',
      features: ['text-to-speech', 'speech-to-text', 'audio-processing']
    });
  } catch (error) {
    console.error('Status Controller Error:', error);
    res.status(500).json({ 
      error: error.message,
      available: false
    });
  }
};