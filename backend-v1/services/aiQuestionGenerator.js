const axios = require('axios');
const crypto = require('crypto');
// Firestore DB for cross-game deduplication
let db;
try {
  db = require('../firebase').db;
} catch (e) {
  db = null;
}

class AIQuestionGenerator {
  constructor() {
    this.groqApiKey = process.env.GROQ_API_KEY || '';
    this.openAiApiKey = process.env.OPENAI_API_KEY || '';
    this.groqURL = 'https://api.groq.com/openai/v1/chat/completions';
    this.openAiURL = 'https://api.openai.com/v1/chat/completions';
    // Model por defecto en Groq (rápido y gratuito con cuota)
    this.groqModel = process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct';
    // Respaldo OpenAI si existiese
    this.openAiModel = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
    
    // Logging de configuración
    if (this.groqApiKey) {
      const keyPreview = this.groqApiKey.substring(0, 10) + '...';
      console.log(`✅ GROQ_API_KEY configurada: ${keyPreview}`);
    } else {
      console.warn(`⚠️ GROQ_API_KEY no configurada`);
    }
    
    if (this.openAiApiKey) {
      const keyPreview = this.openAiApiKey.substring(0, 10) + '...';
      console.log(`✅ OPENAI_API_KEY configurada: ${keyPreview}`);
    } else {
      console.warn(`⚠️ OPENAI_API_KEY no configurada`);
    }
  }

  // Extrae JSON de respuestas que puedan venir con ``` o texto adicional
  extractJson(content) {
    if (!content) return null;
    
    try {
      // Intenta parsear directamente primero
      return JSON.parse(content);
    } catch (e) {
      // Si falla, intenta limpiar
    }
    
    // Elimina fences tipo ```json ... ```
    let cleaned = content.trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    
    // Si aún no es JSON puro, intenta localizar el primer { y último }
    if (!(cleaned.startsWith('{') && cleaned.endsWith('}'))) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
      }
    }
    
    try {
      const parsed = JSON.parse(cleaned);
      return parsed;
    } catch (e) {
      console.error('❌ Error al parsear JSON:', e.message);
      return null;
    }
  }

  // Generar preguntas usando IA (Groq por defecto, fallback a OpenAI)
  async generateQuestions(topic, difficulty = 'medium', count = 5) {
    try {
      console.log(`🤖 Generando ${count} preguntas sobre "${topic}" (dificultad: ${difficulty})...`);
      
      const prompt = this.buildPrompt(topic, difficulty, count);
      let questions = [];
      let groqError = null;

      if (!this.groqApiKey && !this.openAiApiKey) {
        throw new Error('❌ No se encontró ninguna API key de IA.\n📋 Por favor configura:\n- GROQ_API_KEY o\n- OPENAI_API_KEY\nen tu archivo .env');
      }

      // Preferir Groq si hay API key
      if (this.groqApiKey) {
        try {
          console.log(`📡 Conectando a API de Groq (modelo: ${this.groqModel})...`);
          const response = await axios.post(this.groqURL, {
            model: this.groqModel,
            messages: [
              { role: 'system', content: 'Eres un experto en crear preguntas de trivia educativas y entretenidas. Responde siempre en formato JSON válido.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 2000,
            temperature: 0.7
          }, {
            headers: {
              'Authorization': `Bearer ${this.groqApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 segundos timeout
          });
          const content = response.data.choices?.[0]?.message?.content || '';
          console.log(`✅ Respuesta recibida de Groq (${content.length} caracteres)`);
          const parsed = this.extractJson(content);
          if (parsed && parsed.questions) {
            questions = parsed.questions;
            console.log(`✅ ${questions.length} preguntas parseadas exitosamente`);
          } else {
            console.warn('⚠️ No se pudieron parsear las preguntas de la respuesta');
          }
        } catch (err) {
          const errorMsg = err.response?.data?.error?.message || err.message;
          console.error(`❌ Error de Groq: ${errorMsg}`);
          groqError = err;
          
          // Si Groq falla por API key inválida o límite, intentar con OpenAI
          if (err.response?.status === 401 || err.response?.status === 429 || errorMsg.includes('Invalid') || errorMsg.includes('API')) {
            console.warn('⚠️ Groq no disponible, intentando con OpenAI...');
          } else {
            throw new Error('Error al conectar con la API de Groq: ' + errorMsg);
          }
        }
      }
      
      // Fallback: OpenAI si Groq falló o no hay API key
      if ((!questions || questions.length === 0) && this.openAiApiKey) {
        // Respaldo: OpenAI si está disponible
        try {
          console.log(`📡 Conectando a API de OpenAI (modelo: ${this.openAiModel})...`);
          const response = await axios.post(this.openAiURL, {
            model: this.openAiModel,
            messages: [
              { role: 'system', content: 'Eres un experto en crear preguntas de trivia educativas y entretenidas. Responde siempre en formato JSON válido.' },
              { role: 'user', content: prompt }
            ],
            max_tokens: 2000,
            temperature: 0.7
          }, {
            headers: {
              'Authorization': `Bearer ${this.openAiApiKey}`,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });
          const content = response.data.choices?.[0]?.message?.content || '';
          console.log(`✅ Respuesta recibida de OpenAI (${content.length} caracteres)`);
          const parsed = this.extractJson(content);
          if (parsed && parsed.questions) {
            questions = parsed.questions;
            console.log(`✅ ${questions.length} preguntas parseadas exitosamente`);
          }
        } catch (err) {
          const errorMsg = err.response?.data?.error?.message || err.message;
          console.error(`❌ Error de OpenAI: ${errorMsg}`);
          throw new Error('Error al conectar con la API de OpenAI: ' + errorMsg);
        }
      }

      if (!questions || questions.length === 0) {
        throw new Error('La IA no devolvió preguntas válidas. Verifica tu API key y conexión.');
      }

      // Backwards compatibility: if AI returned simple questions with only text and no options,
      // return them as-is (this keeps unit tests and simple flows working).
      const looksLikeSimple = questions.every(q => q && (!q.options || (Array.isArray(q.options) && q.options.length === 0)) );
      if (looksLikeSimple) {
        // dedupe by text
        const seen = new Set();
        const out = [];
        for (const q of questions) {
          const t = (q.text || q.question || '').trim();
          if (!t) continue;
          const key = t.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          // Return legacy simple shape (only text) to preserve existing tests and callers
          out.push({ text: t });
          if (out.length >= count) break;
        }
        if (out.length < count) {
          throw new Error('La IA no generó suficientes preguntas únicas.');
        }
        return { questions: out.slice(0, count) };
      }

      // Sanitize and ensure exactly 4 options per question (A-D)
      const sanitizeQuestions = async (rawQuestions) => {
        const out = [];
        const seenTexts = new Set();

        for (const raw of rawQuestions) {
          if (!raw) continue;
          const text = (raw.text || raw.question || '').trim();
          if (!text) continue;
          const key = text.toLowerCase();
          if (seenTexts.has(key)) continue; // dedupe by text

          // Normalize options - soportar múltiples formatos
          let opts = [];
          
          if (Array.isArray(raw.options)) {
            opts = raw.options.map(o => {
              if (typeof o === 'string') return o.trim();
              if (typeof o === 'object' && o !== null) return String(o.text || o.value || o.option || '').trim();
              return String(o).trim();
            }).filter(o => o && o.length > 0);
          } else if (raw.options && typeof raw.options === 'object') {
            // Si es un objeto con claves (A:, B:, C:, D:, etc)
            opts = Object.values(raw.options)
              .map(o => (typeof o === 'string' ? o.trim() : String(o).trim()))
              .filter(o => o && o.length > 0);
          }

          // Remove duplicates (case-insensitive) while preserving order
          const seenOpt = new Set();
          const uniqueOpts = [];
          for (const o of opts) {
            const k = o.toLowerCase();
            if (!seenOpt.has(k)) {
              seenOpt.add(k);
              uniqueOpts.push(o);
            }
          }
          opts = uniqueOpts;

          // Si hay menos de 4 opciones, skip (no válida)
          if (opts.length < 4) {
            console.warn(`⚠️  Pregunta rechazada: solo ${opts.length} opciones válidas: "${text.substring(0, 50)}..."`);
            continue;
          }

          // Si hay más de 4, encontrar la respuesta correcta y quedarse con 4
          let correctIndex = typeof raw.correctAnswerIndex === 'number' ? raw.correctAnswerIndex : undefined;
          
          // Si no se proporciona correctAnswerIndex, intentar encontrarlo de otras formas
          if ((correctIndex === undefined || correctIndex === null) && raw.correctAnswer) {
            const correctText = String(raw.correctAnswer).trim().toLowerCase();
            const idx = opts.findIndex(o => o.toLowerCase() === correctText);
            if (idx !== -1) correctIndex = idx;
          }

          // Fallback: asumir que la primera opción es correcta
          if (correctIndex === undefined || correctIndex === null) {
            correctIndex = 0;
          }

          // Asegurar que correctIndex está dentro de los límites
          if (correctIndex < 0 || correctIndex >= opts.length) {
            correctIndex = Math.min(correctIndex, opts.length - 1);
          }

          // Si hay más de 4 opciones, mantener la correcta + 3 distractoras aleatorias
          if (opts.length > 4) {
            const correctValue = opts[correctIndex];
            const distractors = opts.filter((_, i) => i !== correctIndex);
            
            // Barajar distractores
            for (let i = distractors.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [distractors[i], distractors[j]] = [distractors[j], distractors[i]];
            }
            
            // Tomar 3 distractores aleatorios
            opts = [correctValue, ...distractors.slice(0, 3)];
            correctIndex = 0; // La respuesta correcta es la primera antes de barajar
          }

          // Asegurar que opts tiene exactamente 4 opciones
          if (opts.length !== 4) {
            console.warn(`⚠️  Pregunta tiene ${opts.length} opciones, ajustando a 4`);
            opts = opts.slice(0, 4);
            if (opts.length < 4) continue; // Skip si no se pueden obtener 4
          }

          // Barajar las opciones mientras se rastrea el índice correcto
          const correctValue = opts[correctIndex];
          
          // Verificar que el valor correcto existe en las opciones
          if (!opts.includes(correctValue)) {
            opts[0] = correctValue;
            correctIndex = 0;
          }

          // Barajar opciones
          const shuffled = opts.slice();
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }

          // Encontrar la nueva posición del índice correcto después de barajar
          const finalCorrectIndex = shuffled.findIndex(o => o === correctValue);

          const questionObj = {
            id: raw.id || `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            text: text,
            options: shuffled.slice(0, 4), // Asegurar exactamente 4
            correctAnswerIndex: finalCorrectIndex >= 0 ? finalCorrectIndex : 0,
            category: raw.category || raw.topic || topic,
            difficulty: raw.difficulty || difficulty,
            explanation: (raw.explanation || raw.explain || '').trim()
          };

          // Cross-game dedupe: if DB available, skip questions already stored
          if (db) {
            try {
              const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
              const hash = crypto.createHash('sha256').update(normalized).digest('hex');
              const doc = await db.collection('ai_generated_questions').doc(hash).get();
              if (doc.exists) {
                // already used in previous games, skip
                console.warn(`⚠️  Pregunta duplicada en BD: "${text.substring(0, 40)}..."`);
                continue;
              }
              // persist a lightweight record to avoid reuse
              await db.collection('ai_generated_questions').doc(hash).set({
                text: questionObj.text,
                createdAt: Date.now(),
                topic: questionObj.category
              }).catch(() => {});
            } catch (e) {
              // If DB check fails, don't break generation; just proceed
              console.warn('AI question DB check failed:', e.message || e);
            }
          }

          seenTexts.add(key);
          out.push(questionObj);
          
          console.log(`✅ Pregunta válida #${out.length}: "${text.substring(0, 50)}..."`);
        }
        return out;
      };

      const sanitized = await sanitizeQuestions(questions);
      
      console.log(`📊 Sanitización completa: ${sanitized.length} preguntas válidas de ${questions.length} generadas`);
      
      if (!sanitized || sanitized.length === 0) {
        throw new Error('La IA no generó ninguna pregunta válida con 4 opciones. Por favor, intenta de nuevo.');
      }
      
      if (sanitized.length < count) {
        console.warn(`⚠️  Solo se obtuvieron ${sanitized.length} de ${count} preguntas solicitadas`);
        // No fallar si al menos tenemos algunas preguntas válidas
        if (sanitized.length < Math.max(1, Math.floor(count / 2))) {
          throw new Error(`La IA no generó suficientes preguntas válidas (${sanitized.length}/${count}). Intenta de nuevo o reduce la cantidad.`);
        }
      }

      return { questions: sanitized.slice(0, count) };
    } catch (error) {
      throw error;
    }
  }

  // Generar preguntas usando una API gratuita alternativa
  async generateQuestionsFree(topic, difficulty = 'medium', count = 5) {
    try {
      throw new Error('No se pueden generar preguntas locales.');
    } catch (error) {
  // ...log eliminado...
        throw new Error('No se pueden generar preguntas con IA.');
    }
  }

 
  // Llenar template con datos dinámicos
  fillTemplate(template, topic, difficulty) {
    return {
      ...template,
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      category: topic,
      difficulty: difficulty,
      source: 'AI Generated'
    };
  }

  // Construir prompt para OpenAI
  buildPrompt(topic, difficulty, count) {
    // Aumentar número de preguntas solicitadas para compensar por descartes
    // Solicita el doble para asegurar suficientes preguntas válidas después de filtrado
    const requestCount = Math.max(count * 2, count + 10);
    
    return `Genera ${requestCount} preguntas de trivia sobre el tema "${topic}" con dificultad ${difficulty}.

INSTRUCCIONES CRÍTICAS:
1. CADA pregunta DEBE tener EXACTAMENTE 4 opciones distintas
2. TODAS las opciones deben ser únicas y claramente diferentes
3. NUNCA duplicar opciones dentro de una pregunta
4. NUNCA dejar opciones vacías o nulas
5. Las preguntas DEBEN ser diferentes entre sí (no repetir el mismo contenido)

Formato requerido (JSON válido - sin markdown, sin comillas escapadas):
{
  "questions": [
    {
      "text": "Pregunta clara y específica aquí",
      "options": ["Opción A claramente diferente", "Opción B claramente diferente", "Opción C claramente diferente", "Opción D claramente diferente"],
      "correctAnswerIndex": 0,
      "explanation": "Explicación clara de por qué esta es la respuesta correcta"
    }
  ]
}

Requisitos obligatorios:
- Tema: ${topic}
- Dificultad: ${difficulty}
- Preguntas interesantes, educativas y únicas
- 4 opciones POR CADA PREGUNTA sin excepciones
- Las opciones deben ser específicas y distintas
- Explicación de la respuesta correcta en cada pregunta
- Totalmente válidas, sin campos vacíos

Responde SOLO con el JSON válido, sin comentarios, markdown o texto adicional.`;
  }

  // Preguntas de respaldo si falla la IA
  getFallbackQuestions(topic, difficulty, count) {
    throw new Error('No se pueden generar preguntas de respaldo.');
  }

  // Obtener temas disponibles
  getAvailableTopics() {
    return [
      'Ciencia',
      'Historia',
      'Geografía',
      'Tecnología',
      'Deportes',
      'Arte',
      'Literatura',
      'Matemáticas',
      'Biología',
      'Química',
      'Física',
      'Astronomía',
      'Música',
      'Cine',
      'Videojuegos'
    ];
  }

  // Obtener niveles de dificultad
  getDifficultyLevels() {
    return [
      { value: 'easy', label: 'Fácil' },
      { value: 'medium', label: 'Medio' },
      { value: 'hard', label: 'Difícil' }
    ];
  }
}

module.exports = AIQuestionGenerator;

