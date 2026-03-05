const axios = require('axios');
const azureVisionService = require('../services/azureVisionService');
const { validateFileSize, validateMimeType } = require('../utils/validators');

const MAX_IMAGE_SIZE_MB = 4;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];

exports.analyzeImage = async (req, res) => {
  try {
    if (!azureVisionService.enabled) {
      return res.status(503).json({
        success: false,
        error: 'Azure Computer Vision service is not configured'
      });
    }

    const { imageBase64, imageUrl, mimeType, language = 'es' } = req.body || {};

    let imageBuffer;
    let detectedMime = mimeType;

    if (imageBase64) {
      const parsed = parseBase64Image(imageBase64);
      imageBuffer = parsed.buffer;
      detectedMime = detectedMime || parsed.mimeType;
    } else if (imageUrl) {
      const downloaded = await downloadImage(imageUrl);
      imageBuffer = downloaded.buffer;
      detectedMime = detectedMime || downloaded.mimeType;
    } else if (req.file && req.file.buffer) {
      imageBuffer = req.file.buffer;
      detectedMime = detectedMime || req.file.mimetype;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Provide imageBase64, imageUrl or a file upload'
      });
    }

    detectedMime = detectedMime || 'image/jpeg';

    const sizeValidation = validateFileSize(imageBuffer.length, MAX_IMAGE_SIZE_MB);
    if (!sizeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: sizeValidation.message
      });
    }

    const typeValidation = validateMimeType(detectedMime, ALLOWED_MIME_TYPES);
    if (!typeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: typeValidation.message
      });
    }

    const analysis = await azureVisionService.analyzeImage(imageBuffer, { language });

    if (!analysis) {
      throw new Error('Failed to analyze image');
    }

    const objectSummary = summarizeObjects(analysis.objects);
    const questionSuggestions = buildQuestionSuggestions(analysis);

    return res.json({
      success: true,
      analysis: {
        description: analysis.description,
        tags: analysis.tags,
        categories: analysis.categories,
        objects: analysis.objects,
        colors: analysis.color,
        metadata: analysis.metadata,
        objectSummary
      },
      questionSuggestions,
      processedAt: new Date().toISOString(),
      language
    });
  } catch (error) {
    console.error('Error analyzing image:', error.message);
    const status = deriveStatusCode(error);
    return res.status(status).json({
      success: false,
      error: error.message || 'Error analyzing image'
    });
  }
};

function parseBase64Image(imageBase64) {
  let base64Data = imageBase64;
  let detectedMime = 'image/jpeg';

  if (base64Data.includes(',')) {
    const [meta, data] = base64Data.split(',');
    base64Data = data;
    const mimeMatch = meta.match(/data:(.*?);base64/);
    if (mimeMatch && mimeMatch[1]) {
      detectedMime = mimeMatch[1];
    }
  }

  try {
    return {
      buffer: Buffer.from(base64Data, 'base64'),
      mimeType: detectedMime
    };
  } catch (error) {
    throw new Error('Invalid base64 image data');
  }
}

async function downloadImage(imageUrl) {
  if (typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
    throw new Error('Invalid image URL');
  }

  const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000 });

  return {
    buffer: Buffer.from(response.data),
    mimeType: response.headers['content-type'] || 'image/jpeg'
  };
}

function summarizeObjects(objects = []) {
  const summaryMap = objects.reduce((acc, object) => {
    if (!object.name) {
      return acc;
    }
    acc[object.name] = acc[object.name] ? acc[object.name] + 1 : 1;
    return acc;
  }, {});

  return Object.entries(summaryMap).map(([name, count]) => ({ name, count }));
}

function buildQuestionSuggestions(analysis) {
  const primaryCaption = analysis.description?.primary?.text;
  const tags = (analysis.tags || []).map(tag => tag.name).filter(Boolean);
  const objects = (analysis.objects || []).map(obj => obj.name).filter(Boolean);
  const options = Array.from(new Set([...tags, ...objects])).slice(0, 4);

  const fallbackQuestion = primaryCaption
    ? `¿Qué se muestra en esta imagen?`
    : '¿Qué describe mejor la imagen?';

  const suggestedQuestion = primaryCaption || objects[0]
    ? `${fallbackQuestion}`
    : '¿Qué ves en la imagen?';

  const suggestedAnswer = options[0] || primaryCaption || null;

  return {
    question: suggestedQuestion,
    descriptionContext: primaryCaption || null,
    categorySuggestion: analysis.categories?.[0]?.name || null,
    options,
    suggestedAnswer,
    confidence: analysis.description?.primary?.confidence || analysis.tags?.[0]?.confidence || null
  };
}

/**
 * HU-VC4: Detección de Objetos en Imágenes
 * Detecta y localiza objetos específicos en imágenes
 * Requiere autenticación
 */
exports.detectObjects = async (req, res) => {
  try {
    // Validar servicio configurado
    if (!azureVisionService.enabled) {
      console.warn('⚠️ Azure Computer Vision service not configured');
      return res.status(503).json({
        success: false,
        error: 'Azure Computer Vision service not configured',
        code: 'SERVICE_UNAVAILABLE'
      });
    }

    const { 
      imageBase64, 
      imageUrl, 
      mimeType,
      minConfidence = 0.5,
      language = 'es',
      objectName = null
    } = req.body || {};

    // Validar entrada
    if (!imageBase64 && !imageUrl && !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Provide imageBase64, imageUrl or upload a file',
        code: 'MISSING_IMAGE'
      });
    }

    // Obtener buffer de imagen
    let imageBuffer;
    let detectedMime = mimeType;

    if (imageBase64) {
      const parsed = parseBase64Image(imageBase64);
      imageBuffer = parsed.buffer;
      detectedMime = detectedMime || parsed.mimeType;
    } else if (imageUrl) {
      const downloaded = await downloadImage(imageUrl);
      imageBuffer = downloaded.buffer;
      detectedMime = detectedMime || downloaded.mimeType;
    } else if (req.file && req.file.buffer) {
      imageBuffer = req.file.buffer;
      detectedMime = detectedMime || req.file.mimetype;
    }

    detectedMime = detectedMime || 'image/jpeg';

    // Validar tamaño
    const sizeValidation = validateFileSize(imageBuffer.length, MAX_IMAGE_SIZE_MB);
    if (!sizeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: sizeValidation.message,
        code: 'IMAGE_TOO_LARGE'
      });
    }

    // Validar tipo MIME
    const typeValidation = validateMimeType(detectedMime, ALLOWED_MIME_TYPES);
    if (!typeValidation.valid) {
      return res.status(400).json({
        success: false,
        error: typeValidation.message,
        code: 'INVALID_IMAGE_TYPE'
      });
    }

    // Validar confianza
    if (typeof minConfidence !== 'number' || minConfidence < 0 || minConfidence > 1) {
      return res.status(400).json({
        success: false,
        error: 'minConfidence must be between 0 and 1',
        code: 'INVALID_CONFIDENCE'
      });
    }

    console.log(`🔍 Detecting objects in image (${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`   Min confidence: ${(minConfidence * 100).toFixed(0)}%`);
    if (objectName) {
      console.log(`   Filtering by: ${objectName}`);
    }

    // Detectar objetos
    const detection = await azureVisionService.detectObjects(imageBuffer, {
      minConfidence,
      language,
      objectName,
      timeout: 60000
    });

    if (!detection) {
      throw new Error('Failed to detect objects');
    }

    console.log(`✅ Detection complete: ${detection.stats.totalObjects} objects found`);

    // Generar sugerencias de preguntas automáticamente
    const questionSuggestions = generateObjectQuestionSuggestions(detection);

    // Respuesta exitosa
    return res.json({
      success: true,
      detection: {
        ...detection,
        objectSummary: summarizeDetectedObjects(detection)
      },
      questionSuggestions,
      cost: {
        usd: 0.0005,
        note: 'Each detection costs approximately $0.0005 USD'
      },
      processedAt: new Date().toISOString(),
      language
    });

  } catch (error) {
    console.error('❌ Error detecting objects:', error.message);
    const status = deriveStatusCode(error);
    return res.status(status).json({
      success: false,
      error: error.message || 'Error detecting objects',
      code: 'DETECTION_ERROR'
    });
  }
};

/**
 * Generate question suggestions based on detected objects
 * IMPORTANTE: Todas las preguntas tienen EXACTAMENTE 4 opciones de respuesta
 * @param {object} detection
 * @returns {object}
 */
function generateObjectQuestionSuggestions(detection) {
  const topObjects = detection.topObjects || [];
  const objectCounts = detection.objectCounts || {};
  
  if (topObjects.length === 0) {
    return {
      identification: null,
      counting: null,
      multipleChoice: null
    };
  }

  const primaryObject = topObjects[0];

  // Suggestion 1: Identification question - EXACTAMENTE 4 opciones
  // Usar los 4 primeros objetos detectados, o rellenar con generics si hay menos
  let identificationOptions = topObjects.slice(0, 4).map(o => ({
    text: o.name,
    confidence: o.confidence,
    count: o.count,
    isCorrect: o.name === primaryObject.name
  }));

  // Si hay menos de 4 objetos detectados, rellenar con opciones genéricas
  const genericOptions = ['otro objeto', 'persona', 'animal', 'vehículo', 'mueble'];
  while (identificationOptions.length < 4) {
    const newOption = genericOptions.find(opt => 
      !identificationOptions.some(o => o.text.toLowerCase() === opt.toLowerCase())
    );
    if (newOption) {
      identificationOptions.push({
        text: newOption,
        confidence: 0,
        count: 0,
        isCorrect: false
      });
    } else {
      break;
    }
  }

  // Asegurar exactamente 4 opciones
  identificationOptions = identificationOptions.slice(0, 4);

  const identificationSuggestion = {
    type: 'identification',
    question: `¿Qué objeto principal aparece en esta imagen?`,
    description: `Se detectó principalmente: ${primaryObject.name}`,
    options: identificationOptions,
    correctAnswer: primaryObject.name,
    explanation: `Se detectaron ${detection.stats.totalObjects} objeto(s) en total. El más confiable es "${primaryObject.name}" con ${(primaryObject.confidence * 100).toFixed(0)}% de confianza.`,
    difficulty: detection.stats.averageConfidence > 0.8 ? 'fácil' : detection.stats.averageConfidence > 0.6 ? 'media' : 'difícil'
  };

  // Suggestion 2: Counting question - EXACTAMENTE 4 opciones
  const countingObjectName = primaryObject.name;
  const countingObjectCount = objectCounts[countingObjectName] || 0;
  
  // Generar 4 opciones numéricas centradas alrededor del conteo real
  let countingOptions = [];
  if (countingObjectCount === 0) {
    countingOptions = ['0', '1', '2', '3'];
  } else if (countingObjectCount === 1) {
    countingOptions = ['0', '1', '2', '3'];
  } else if (countingObjectCount === 2) {
    countingOptions = ['1', '2', '3', '4'];
  } else if (countingObjectCount === 3) {
    countingOptions = ['2', '3', '4', '5'];
  } else {
    countingOptions = ['3', '4', '5', '6+'];
  }

  const correctCountOption = String(countingObjectCount);

  const countingSuggestion = {
    type: 'counting',
    question: `¿Cuántos ${countingObjectName}(s) hay en la imagen?`,
    description: `Total detectado: ${countingObjectCount}`,
    options: countingOptions.map(opt => ({
      text: opt,
      isCorrect: opt === correctCountOption
    })),
    correctAnswer: correctCountOption,
    explanation: `Se detectó(ron) ${countingObjectCount} ${countingObjectName}(s) en la imagen.`,
    difficulty: 'fácil'
  };

  // Suggestion 3: Multiple choice - EXACTAMENTE 4 opciones
  const multipleChoiceOptions = topObjects.slice(0, 4).map(o => ({
    text: o.name,
    isCorrect: o.name === primaryObject.name
  }));

  // Si hay menos de 4, rellenar con opciones que NO aparecen en la imagen
  const detectedNames = topObjects.map(o => o.name.toLowerCase());
  const fillerOptions = ['árbol', 'coche', 'persona', 'gato', 'casa', 'teléfono', 'libro'].filter(
    opt => !detectedNames.some(det => det.includes(opt.toLowerCase()))
  );

  while (multipleChoiceOptions.length < 4 && fillerOptions.length > 0) {
    const newOption = fillerOptions.shift();
    multipleChoiceOptions.push({
      text: newOption,
      isCorrect: false
    });
  }

  // Asegurar exactamente 4 opciones
  const finalOptions = multipleChoiceOptions.slice(0, 4);

  const multipleChoiceSuggestion = {
    type: 'multipleChoice',
    question: `¿Cuál de estos objetos aparece en la imagen?`,
    description: `Selecciona de las 4 opciones disponibles`,
    options: finalOptions,
    correctAnswer: primaryObject.name,
    explanation: `Objetos detectados en la imagen: ${topObjects.map(o => `${o.name} (${o.count})`).join(', ')}`,
    difficulty: 'media'
  };

  return {
    identification: identificationSuggestion,
    counting: countingSuggestion,
    multipleChoice: multipleChoiceSuggestion,
    metadata: {
      totalObjectTypes: detection.stats.totalTypes,
      totalObjects: detection.stats.totalObjects,
      averageConfidence: (detection.stats.averageConfidence * 100).toFixed(1),
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Summarize detected objects for easy display
 * @param {object} detection
 * @returns {object}
 */
function summarizeDetectedObjects(detection) {
  const topObjects = detection.topObjects || [];
  
  return {
    mostConfidentObject: topObjects[0] || null,
    topThreeObjects: topObjects.slice(0, 3),
    allDetectedTypes: Object.keys(detection.objectCounts || {}).sort(
      (a, b) => (detection.objectCounts[b] || 0) - (detection.objectCounts[a] || 0)
    ),
    objectStatistics: Object.entries(detection.objectCounts || {}).map(
      ([name, count]) => ({ name, count })
    ).sort((a, b) => b.count - a.count),
    confidence: {
      average: ((detection.stats.averageConfidence || 0) * 100).toFixed(1),
      max: ((detection.stats.maxConfidence || 0) * 100).toFixed(1),
      min: ((detection.stats.minConfidence || 0) * 100).toFixed(1)
    },
    summary: {
      totalObjects: detection.stats.totalObjects,
      uniqueTypes: detection.stats.totalTypes,
      mostCommonType: detection.stats.totalTypes > 0 
        ? Object.entries(detection.objectCounts || {})[0]?.[0] 
        : null,
      qualityScore: ((detection.stats.averageConfidence * 100).toFixed(0) + '% confianza')
    }
  };
}

function deriveStatusCode(error) {
  const message = error.message || '';

  if (message.toLowerCase().includes('rate limit')) {
    return 429;
  }
  if (message.toLowerCase().includes('not configured')) {
    return 503;
  }
  if (message.toLowerCase().includes('invalid image')) {
    return 400;
  }
  if (message.toLowerCase().includes('invalid base64')) {
    return 400;
  }
  if (message.toLowerCase().includes('provide image')) {
    return 400;
  }
  return 500;
}

