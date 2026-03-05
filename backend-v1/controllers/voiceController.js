const { db } = require('../firebase');

// [HU8] Validar respuesta de voz
exports.validateVoiceResponse = async (req, res) => {
  try {
    const { userId, questionId, voiceResponse, questionOptions } = req.body;
    
    // Validaciones básicas
    if (!userId || !questionId || !voiceResponse || !questionOptions) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, questionId, voiceResponse, questionOptions' 
      });
    }

    if (!Array.isArray(questionOptions) || questionOptions.length === 0) {
      return res.status(400).json({ 
        error: 'questionOptions must be a non-empty array' 
      });
    }

    // Procesar respuesta de voz
    const validation = matchVoiceResponse(voiceResponse, questionOptions);
    
    // Registrar interacción de voz
    await db.collection('voiceInteractions').add({
      userId,
      questionId,
      action: 'voice_answer',
      voiceText: voiceResponse,
      confidence: validation.confidence,
      timestamp: new Date(),
      duration: 0, // Se puede calcular si es necesario
      metadata: {
        matchedOption: validation.matchedOption,
        answerIndex: validation.answerIndex,
        isValid: validation.isValid
      }
    });
    
    res.json({ 
      valid: validation.isValid, 
      matchedOption: validation.matchedOption,
      answerIndex: validation.answerIndex,
      confidence: validation.confidence
    });
  } catch (error) {
    console.error('Error validating voice response:', error);
    res.status(500).json({ error: error.message });
  }
};

// [HU8] Procesar respuesta de voz
exports.processVoiceResponse = async (req, res) => {
  try {
    const { userId, questionId, voiceResponse, questionOptions } = req.body;
    
    // Validaciones básicas
    if (!userId || !questionId || !voiceResponse || !questionOptions) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, questionId, voiceResponse, questionOptions' 
      });
    }

    // Procesar respuesta de voz
    const validation = matchVoiceResponse(voiceResponse, questionOptions);
    
    // Registrar interacción de voz
    await db.collection('voiceInteractions').add({
      userId,
      questionId,
      action: 'voice_answer',
      voiceText: voiceResponse,
      confidence: validation.confidence,
      timestamp: new Date(),
      duration: 0,
      metadata: {
        matchedOption: validation.matchedOption,
        answerIndex: validation.answerIndex,
        isValid: validation.isValid,
        processedAt: new Date()
      }
    });
    
    res.json({ 
      success: true,
      result: validation
    });
  } catch (error) {
    console.error('Error processing voice response:', error);
    res.status(500).json({ error: error.message });
  }
};

// [HU8] Obtener estadísticas de reconocimiento de voz
exports.getVoiceRecognitionStats = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Obtener todas las interacciones de voz del usuario
    const snapshot = await db.collection('voiceInteractions')
      .where('userId', '==', userId)
      .where('action', '==', 'voice_answer')
      .get();

    let totalAttempts = 0;
    let successfulRecognitions = 0;
    let totalConfidence = 0;
    let averageConfidence = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      totalAttempts++;
      
      if (data.metadata && data.metadata.isValid) {
        successfulRecognitions++;
      }
      
      if (data.confidence && typeof data.confidence === 'number') {
        totalConfidence += data.confidence;
      }
    });

    if (totalAttempts > 0) {
      averageConfidence = totalConfidence / totalAttempts;
    }

    res.json({
      totalAttempts,
      successfulRecognitions,
      successRate: totalAttempts > 0 ? (successfulRecognitions / totalAttempts) * 100 : 0,
      averageConfidence: Math.round(averageConfidence * 100) / 100
    });
  } catch (error) {
    console.error('Error getting voice recognition stats:', error);
    res.status(500).json({ error: error.message });
  }
};

// [HU8] Algoritmo de coincidencia de respuestas de voz
function matchVoiceResponse(voiceText, options) {
  if (!voiceText || typeof voiceText !== 'string' || !Array.isArray(options)) {
    return {
      isValid: false,
      matchedOption: null,
      answerIndex: null,
      confidence: 0.0
    };
  }

  const normalizedVoice = voiceText.toLowerCase().trim();
  
  // Buscar coincidencias directas con las opciones
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    if (!option || typeof option !== 'string') continue;
    
    const normalizedOption = option.toLowerCase().trim();
    
    // Coincidencia exacta
    if (normalizedVoice === normalizedOption) {
      return {
        isValid: true,
        matchedOption: option,
        answerIndex: i,
        confidence: 1.0
      };
    }
    
    // Coincidencia parcial (contiene la opción)
    if (normalizedVoice.includes(normalizedOption) || normalizedOption.includes(normalizedVoice)) {
      return {
        isValid: true,
        matchedOption: option,
        answerIndex: i,
        confidence: 0.8
      };
    }
  }
  
  // Buscar coincidencias por letras (A, B, C, D)
  const letterMatch = normalizedVoice.match(/\b([a-d])\b/);
  if (letterMatch) {
    const letter = letterMatch[1];
    const index = letter.charCodeAt(0) - 'a'.charCodeAt(0);
    
    if (index >= 0 && index < options.length) {
      return {
        isValid: true,
        matchedOption: options[index],
        answerIndex: index,
        confidence: 0.9
      };
    }
  }
  
  // Buscar coincidencias por posición (primera, segunda, etc.)
  const positionMatch = normalizedVoice.match(/\b(primera|segunda|tercera|cuarta|primero|segundo|tercero|cuarto|uno|dos|tres|cuatro)\b/);
  if (positionMatch) {
    const position = positionMatch[1];
    let index = -1;
    
    switch (position) {
      case 'primera':
      case 'primero':
      case 'uno':
        index = 0;
        break;
      case 'segunda':
      case 'segundo':
      case 'dos':
        index = 1;
        break;
      case 'tercera':
      case 'tercero':
      case 'tres':
        index = 2;
        break;
      case 'cuarta':
      case 'cuarto':
      case 'cuatro':
        index = 3;
        break;
    }
    
    if (index >= 0 && index < options.length) {
      return {
        isValid: true,
        matchedOption: options[index],
        answerIndex: index,
        confidence: 0.85
      };
    }
  }
  
  // Buscar coincidencias por números (1, 2, 3, 4)
  const numberMatch = normalizedVoice.match(/\b([1-4])\b/);
  if (numberMatch) {
    const number = parseInt(numberMatch[1]);
    const index = number - 1;
    
    if (index >= 0 && index < options.length) {
      return {
        isValid: true,
        matchedOption: options[index],
        answerIndex: index,
        confidence: 0.9
      };
    }
  }
  
  // No se encontró coincidencia
  return {
    isValid: false,
    matchedOption: null,
    answerIndex: null,
    confidence: 0.0
  };
}

// Exportar función para pruebas
module.exports.matchVoiceResponse = matchVoiceResponse;