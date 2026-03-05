// [HU8] Utilidades de reconocimiento de voz

// Función auxiliar para hacer coincidir respuestas de voz con opciones
function matchVoiceResponse(voiceResponse, questionOptions) {
  const response = voiceResponse.toLowerCase().trim();
  const options = questionOptions.map((opt, index) => ({
    text: opt.toLowerCase().trim(),
    original: opt,
    index
  }));

  // 1. Coincidencia exacta
  const exactMatch = options.find(opt => opt.text === response);
  if (exactMatch) {
    return {
      isValid: true,
      matchedOption: exactMatch.original,
      answerIndex: exactMatch.index,
      confidence: 1.0
    };
  }

  // 2. Coincidencia por letra (A, B, C, D)
  const letterMatch = matchByLetter(response, options);
  if (letterMatch.isValid) {
    return letterMatch;
  }

  // 3. Coincidencia por posición (primera, segunda, etc.)
  const positionMatch = matchByPosition(response, options);
  if (positionMatch.isValid) {
    return positionMatch;
  }

  // 4. Coincidencia parcial por palabras clave
  const partialMatch = matchByKeywords(response, options);
  if (partialMatch.isValid) {
    return partialMatch;
  }

  // 5. No se encontró coincidencia
  return {
    isValid: false,
    matchedOption: null,
    answerIndex: null,
    confidence: 0.0
  };
}

// Coincidencia por letra (A, B, C, D)
function matchByLetter(response, options) {
  const letterPatterns = {
    'a': 0, 'primera': 0, 'uno': 0, '1': 0,
    'b': 1, 'segunda': 1, 'dos': 1, '2': 1,
    'c': 2, 'tercera': 2, 'tres': 2, '3': 2,
    'd': 3, 'cuarta': 3, 'cuatro': 3, '4': 3
  };

  for (const [pattern, index] of Object.entries(letterPatterns)) {
    if (response.includes(pattern) && index < options.length) {
      return {
        isValid: true,
        matchedOption: options[index].original,
        answerIndex: index,
        confidence: 0.9
      };
    }
  }

  return { isValid: false };
}

// Coincidencia por posición (primera opción, segunda opción, etc.)
function matchByPosition(response, options) {
  const positionWords = [
    'primera', 'segunda', 'tercera', 'cuarta',
    'quinta', 'sexta', 'séptima', 'octava'
  ];

  for (let i = 0; i < positionWords.length && i < options.length; i++) {
    if (response.includes(positionWords[i])) {
      return {
        isValid: true,
        matchedOption: options[i].original,
        answerIndex: i,
        confidence: 0.8
      };
    }
  }

  return { isValid: false };
}

// Coincidencia parcial por palabras clave
function matchByKeywords(response, options) {
  let bestMatch = { isValid: false, confidence: 0 };
  
  options.forEach((option, index) => {
    const words = option.text.split(' ').filter(word => word.length > 3);
    let matchCount = 0;
    
    words.forEach(word => {
      if (response.includes(word)) {
        matchCount++;
      }
    });
    
    // Requerir al menos 2 palabras coincidentes para opciones largas
    const minMatches = words.length > 3 ? 2 : 1;
    const confidence = matchCount / words.length;
    
    // Solo aceptar si hay al menos 2 palabras coincidentes Y confianza > 0.7
    if (matchCount >= minMatches && confidence > 0.7 && confidence > bestMatch.confidence) {
      bestMatch = {
        isValid: true,
        matchedOption: option.original,
        answerIndex: index,
        confidence: Math.min(confidence, 0.7)
      };
    }
  });

  return bestMatch;
}

// Generar sugerencias para respuestas no reconocidas
function generateSuggestions(questionOptions) {
  const suggestions = [];
  
  // Sugerencias por letra
  questionOptions.forEach((option, index) => {
    const letter = String.fromCharCode(65 + index); // A, B, C, D
    suggestions.push(`Diga "${letter}" para ${option.substring(0, 30)}...`);
  });
  
  // Sugerencias por posición
  const positionWords = ['primera', 'segunda', 'tercera', 'cuarta'];
  questionOptions.forEach((option, index) => {
    if (index < positionWords.length) {
      suggestions.push(`Diga "${positionWords[index]} opción"`);
    }
  });
  
  return suggestions;
}

module.exports = {
  matchVoiceResponse,
  generateSuggestions
};