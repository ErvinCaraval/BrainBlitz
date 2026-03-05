require('dotenv').config();
const fs = require('fs');

/**
 * Resolve the DEEPFACE service URL automatically depending on environment.
 * Priority:
 *  1. process.env.DEEPFACE_SERVICE_URL (explicit)
 *  2. process.env.FACIAL_SERVICE_HOST or FACIAL_SERVICE_AZURE_HOST (explicit host)
 *  3. If running on Azure App Service (WEBSITE_HOSTNAME) => https://<WEBSITE_HOSTNAME>
 *  4. If running on Render (RENDER_EXTERNAL_URL) => https://<RENDER_EXTERNAL_URL>
 *  5. If running in Docker (detect /.dockerenv or /proc/1/cgroup) => service name from compose 'http://facial-recognition-service:5001'
 *  6. Fallback to local: 'http://localhost:5001'
 */
function resolveDeepfaceServiceUrl() {
  if (process.env.DEEPFACE_SERVICE_URL && process.env.DEEPFACE_SERVICE_URL.trim() !== '') {
    return process.env.DEEPFACE_SERVICE_URL;
  }

  if (process.env.FACIAL_SERVICE_HOST && process.env.FACIAL_SERVICE_HOST.trim() !== '') {
    const host = process.env.FACIAL_SERVICE_HOST.trim();
    return host.startsWith('http') ? host : `http://${host}`;
  }
  if (process.env.FACIAL_SERVICE_AZURE_HOST && process.env.FACIAL_SERVICE_AZURE_HOST.trim() !== '') {
    const host = process.env.FACIAL_SERVICE_AZURE_HOST.trim();
    return host.startsWith('http') ? host : `https://${host}`;
  }

  // Azure App Service
  if (process.env.WEBSITE_HOSTNAME) {
    return `https://${process.env.WEBSITE_HOSTNAME}`;
  }

  // Render or other platforms which expose an env var
  if (process.env.RENDER_EXTERNAL_URL) {
    return `https://${process.env.RENDER_EXTERNAL_URL.replace(/^https?:\/\//, '')}`;
  }

  // Detect Docker by /.dockerenv or cgroup
  try {
    if (fs.existsSync('/.dockerenv')) {
      return 'http://facial-recognition-service:5001';
    }
    const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
    if (/docker|kubepods|containerd/.test(cgroup)) {
      return 'http://facial-recognition-service:5001';
    }
  } catch (e) {
    // ignore
  }

  // Default to localhost for development
  return 'http://localhost:5001';
}

// Ensure DEEPFACE_SERVICE_URL is set early so other modules can use it
const resolvedDeepfaceUrl = resolveDeepfaceServiceUrl();
process.env.DEEPFACE_SERVICE_URL = process.env.DEEPFACE_SERVICE_URL || resolvedDeepfaceUrl;
console.log(`Resolved DEEPFACE_SERVICE_URL=${process.env.DEEPFACE_SERVICE_URL}`);

/**
 * Función para construir dinámicamente la lista de orígenes CORS permitidos
 */
function getCorsOrigins() {
  const corsOriginEnv = process.env.CORS_ORIGIN || '';
  const defaultOrigins = [
    'https://proyecto-2-2.onrender.com',
    'https://frontend-v2-latest.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:80',
    'http://localhost',
  ];

  // Agregar orígenes desde variable de entorno CORS_ORIGIN (separados por comas)
  if (corsOriginEnv.trim()) {
    const envOrigins = corsOriginEnv.split(',').map(o => o.trim());
    return [...new Set([...defaultOrigins, ...envOrigins])];
  }

  return defaultOrigins;
}

const corsOrigins = getCorsOrigins();
console.log(`CORS Origins allowed:`, corsOrigins);
const express = require('express');
const http = require('http');
const cors = require('cors');
const compression = require('compression');
const { Server } = require('socket.io');
const { db, auth } = require('./firebase');
const { logMemoryUsage } = require('./utils/memoryOptimizer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {


  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }



});

// Swagger UI para documentación interactiva usando swagger.yaml
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const swaggerDocument = yaml.load(fs.readFileSync(__dirname + '/swagger/swagger.yaml', 'utf8'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ✅ SECURITY FIX: Add security headers
app.use((req, res, next) => {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Control referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Enable HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Disable client-side caching for sensitive data
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ✅ COMPRESSION MIDDLEWARE: Enable gzip compression
app.use(compression({ level: 6, threshold: 1024 })); // Compress responses > 1KB

// Aumentar límite de tamaño para imágenes Base64 (reducido a 10MB para Render 512MB)
// Máximo recomendado: 10-15MB
app.use(express.json({ 
  limit: '10mb',
  // Stream large payloads to avoid memory spike
  verify: (req, res, buf, encoding) => {
    if (buf.length > 5 * 1024 * 1024) { // Si > 5MB, loguear
      console.log(`Large payload received: ${(buf.length / 1024 / 1024).toFixed(2)}MB`);
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log memory every 5 minutes
setInterval(() => {
  logMemoryUsage('Memory Check (5min)');
}, 5 * 60 * 1000);

// Rutas API
// ✅ Authentication routes (centralized)
app.use('/api/auth', require('./routes/auth'));

app.use('/api/users', require('./routes/users'));
app.use('/api/tts', require('./routes/tts'));
app.use('/api/ocr', require('./routes/ocr'));
app.use('/api/vision', require('./routes/vision'));

// Ruta de prueba para verificar que el servidor está funcionando
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', services: ['tts', 'users', 'auth', 'ocr', 'vision'] });
});
app.use('/api/games', require('./routes/games'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/ai', require('./routes/ai'));

app.use('/api/voice-interactions', require('./routes/voiceInteractions'));
app.use('/api/voice-responses', require('./routes/voiceResponses'));

app.use('/api/assemblyai', require('./routes/assemblyAI'));
app.use('/api/face', require('./routes/face.routes'));

io.on('connection', (socket) => {
  // Listener para enviar la primera pregunta al socket que lo solicita
  socket.on('requestQuestion', async ({ gameId }) => {

    socket.join(gameId); // Unir a la room antes de enviar la pregunta
    await sendQuestion(io, gameId, 0);
  });


  // Create Game
  socket.on('createGame', async (options) => {
    try {
      // Log del token recibido
      // Validar el token de autenticación
      if (!options.token) {
        socket.emit('error', { error: 'Missing authentication token' });
        return;
      }
      let decodedToken;
      try {
        decodedToken = await auth.verifyIdToken(options.token);
      } catch (err) {
        socket.emit('error', { error: 'Invalid authentication token: ' + err.message });
        return;
      }
      if (decodedToken.uid !== options.hostId) {
        socket.emit('error', { error: 'Token UID does not match hostId' });
        return;
      }
      const gameCode = Math.floor(100000 + Math.random() * 900000).toString();
      // REGLA 1: Solo se aceptan preguntas recién generadas, del tema y cantidad exactos
      let questions = Array.isArray(options.questions) ? options.questions : [];
      if (!questions.length) {
        socket.emit('error', { error: 'No se recibieron preguntas nuevas para crear la partida.' });
        return;
      }
      // Validar que todas las preguntas sean del tema seleccionado y cantidad exacta
      if (options.topic) {
        const allMatchTopic = questions.every(q => (q.category || q.topic) === options.topic);
        if (!allMatchTopic) {
          socket.emit('error', { error: 'Todas las preguntas deben ser del tema seleccionado.' });
          return;
        }
      }
      if (options.count && questions.length !== options.count) {
        socket.emit('error', { error: 'La cantidad de preguntas no coincide con la solicitada.' });
        return;
      }
      // Normalizar formato y recortar a la cantidad exacta pedida
      let mappedQuestions = questions.map(q => {
        if (q.text && !q.question) {
          const { text, ...rest } = q;
          return { ...rest, question: text };
        }
        return q;
      });
      if (options.count && mappedQuestions.length > options.count) {
        mappedQuestions = mappedQuestions.slice(0, options.count);
      }
  
      const gameData = {
        hostId: options.hostId,
        isPublic: options.isPublic,
        status: 'waiting',
        players: [{ uid: options.hostId, displayName: options.displayName, score: 0, responseTimes: [] }],
        questions: mappedQuestions,
        currentQuestion: 0,
        topic: options.topic || '',
        difficulty: options.difficulty || 'medium',
        createdAt: Date.now(),
        questionStartTimes: {} // Para almacenar cuándo se envió cada pregunta
      };
      await db.collection('games').doc(gameCode).set(gameData);
      socket.join(gameCode);
  socket.emit('gameCreated', { gameId: gameCode, questions: mappedQuestions, ...gameData });
    } catch (error) {

      socket.emit('error', { error: error.message });
    }
  });

  // Join Game
  socket.on('joinGame', async ({ gameId, uid, displayName }) => {
    try {
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();
      if (!gameDoc.exists) {
        socket.emit('error', { error: 'Game not found' });
        return;
      }
      const game = gameDoc.data();
      if (game.status !== 'waiting') {
        socket.emit('error', { error: 'Game already started' });
        return;
      }
      const alreadyJoined = game.players.some(p => p.uid === uid);
      if (!alreadyJoined) {
        game.players.push({ uid, displayName, score: 0, responseTimes: [] });
        await gameRef.update({ players: game.players });
      }
      socket.join(gameId);
      io.to(gameId).emit('playerJoined', { players: game.players });
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  // Start Game
  socket.on('startGame', async ({ gameId }) => {
    try {
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();
      if (!gameDoc.exists) {
        socket.emit('error', { error: 'Game not found' });
        return;
      }
      const game = gameDoc.data();
      if (!game.questions || !Array.isArray(game.questions) || game.questions.length === 0) {
        socket.emit('error', { error: 'No hay preguntas asociadas a esta partida.' });
        return;
      }
      await gameRef.update({ status: 'in-progress' });
      io.to(gameId).emit('gameStarted', { questionsCount: game.questions.length });
      setTimeout(() => {
        sendQuestion(io, gameId, 0);
      }, 1000); // Espera 1 segundo antes de enviar la primera pregunta
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  // Submit Answer
  socket.on('submitAnswer', async ({ gameId, uid, answerIndex }) => {
    try {
      // Permitir recibir answerValue además de answerIndex
      let answerValue = undefined;
      if (typeof arguments[0] === 'object' && arguments[0] !== null && 'answerValue' in arguments[0]) {
        answerValue = arguments[0].answerValue;
      }
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();
      if (!gameDoc.exists) {
        socket.emit('error', { error: 'Game not found' });
        return;
      }
      const game = gameDoc.data();
      const currentQ = game.questions[game.currentQuestion];
      if (!currentQ) {
        socket.emit('error', { error: 'No current question' });
        return;
      }
      if (!socket.data.answers) socket.data.answers = {};
      // Capturar el tiempo de respuesta
      const responseTime = Date.now();
      // Guardar ambos: índice, valor y tiempo de respuesta
      socket.data.answers[game.currentQuestion] = { answerIndex, answerValue, responseTime };
      socket.data.uid = uid;
      const sockets = await io.in(gameId).fetchSockets();
      const answers = {};
      sockets.forEach(s => {
        if (s.data.answers && s.data.answers[game.currentQuestion] !== undefined) {
          answers[s.data.uid] = s.data.answers[game.currentQuestion];
        }
      });
      // Solo avanzar si todos respondieron
      if (Object.keys(answers).length === game.players.length) {
        const correctValue = Array.isArray(currentQ.options) && typeof currentQ.correctAnswerIndex === 'number'
          ? currentQ.options[currentQ.correctAnswerIndex]
          : undefined;
        
        // Obtener el tiempo de inicio de la pregunta actual
        const questionStartTime = game.questionStartTimes && game.questionStartTimes[game.currentQuestion] 
          ? game.questionStartTimes[game.currentQuestion] 
          : Date.now();
        
        const updatedPlayers = game.players.map(player => {
          const ansObj = answers[player.uid];
          let score = player.score;
          let responseTimes = player.responseTimes || [];
          
          // Calcular el tiempo de respuesta para esta pregunta
          if (ansObj && ansObj.responseTime) {
            const responseTimeMs = ansObj.responseTime - questionStartTime;
            responseTimes.push(responseTimeMs);
          }
          
          // Validar por valor, y si no hay valor, por índice
          if (ansObj) {
            if (
              typeof ansObj.answerValue !== 'undefined' &&
              typeof correctValue !== 'undefined' &&
              ansObj.answerValue === correctValue
            ) {
              score += 1;
            } else if (
              typeof ansObj.answerIndex === 'number' &&
              typeof currentQ.correctAnswerIndex === 'number' &&
              ansObj.answerIndex === currentQ.correctAnswerIndex
            ) {
              score += 1;
            }
          }
          return { ...player, score, responseTimes };
        });
        await gameRef.update({ players: updatedPlayers });
        io.to(gameId).emit('answerResult', {
          correctAnswerIndex: currentQ.correctAnswerIndex,
          explanation: currentQ.explanation,
          players: updatedPlayers
        });
        const nextIndex = game.currentQuestion + 1;
        setTimeout(async () => {
          if (nextIndex < game.questions.length) {
            await gameRef.update({ currentQuestion: nextIndex });
            sendQuestion(io, gameId, nextIndex);
          } else {
            await gameRef.update({ status: 'finished' });
            io.to(gameId).emit('gameFinished', { players: updatedPlayers });

            // Guardar historial de partida para cada jugador
            const gameDocFinal = await gameRef.get();
            const finalGame = gameDocFinal.data();
            const now = new Date();
            const players = finalGame.players || [];
            const questionsCount = Array.isArray(finalGame.questions) ? finalGame.questions.length : 0;
            // Determinar el score más alto
            const maxScore = Math.max(...players.map(p => p.score));
            const playersWithMaxScore = players.filter(p => p.score === maxScore);
            
            // Función para calcular tiempo promedio de respuesta
            const calculateAverageResponseTime = (responseTimes) => {
              if (!responseTimes || responseTimes.length === 0) return Infinity;
              return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            };
            
            // Determinar ganador considerando empates por tiempo
            let winnerUid = null;
            if (playersWithMaxScore.length === 1) {
              // Solo un jugador con score máximo
              winnerUid = playersWithMaxScore[0].uid;
            } else if (playersWithMaxScore.length > 1 && maxScore > 0) {
              // Múltiples jugadores con score máximo - desempate por tiempo promedio
              let fastestPlayer = playersWithMaxScore[0];
              let fastestTime = calculateAverageResponseTime(fastestPlayer.responseTimes);
              
              for (let i = 1; i < playersWithMaxScore.length; i++) {
                const currentTime = calculateAverageResponseTime(playersWithMaxScore[i].responseTimes);
                if (currentTime < fastestTime) {
                  fastestTime = currentTime;
                  fastestPlayer = playersWithMaxScore[i];
                }
              }
              winnerUid = fastestPlayer.uid;
            }
            
            for (const player of players) {
              const result = player.uid === winnerUid && maxScore > 0
                ? 'win'
                : 'lose';
              // Determinar si el jugador fue host
              const isHost = finalGame.hostId === player.uid;
              await db.collection('gameResults').add({
                uid: player.uid,
                gameId: gameId,
                date: now.toISOString(),
                score: player.score,
                result,
                players: players.map(p => ({ uid: p.uid, displayName: p.displayName, score: p.score })),
                questionsCount,
                topic: finalGame.topic || '',
                difficulty: finalGame.difficulty || '',
                isHost
              });

              // Actualizar estadísticas del usuario, crear doc si no existe
              const userRef = db.collection('users').doc(player.uid);
              await db.runTransaction(async (t) => {
                const userDoc = await t.get(userRef);
                let stats = { gamesPlayed: 0, wins: 0, correctAnswers: 0 };
                let baseUser = {};
                if (!userDoc.exists) {
                  // Si hay displayName/email en player, los guardamos
                  if (player.displayName) baseUser.displayName = player.displayName;
                  if (player.email) baseUser.email = player.email;
                  baseUser.stats = stats;
                  t.set(userRef, baseUser);

                } else {
                  stats = userDoc.data().stats || stats;
                  baseUser = userDoc.data();
                }
                const gamesPlayed = (stats.gamesPlayed || 0) + 1;
                const wins = (stats.wins || 0) + (result === 'win' ? 1 : 0);
                const correctAnswers = (stats.correctAnswers || 0) + (player.score || 0);
                t.set(userRef, { ...baseUser, stats: { gamesPlayed, wins, correctAnswers } }, { merge: true });

              });
            }
          }
        }, 3000);
      }
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  // [HU8] Submit Voice Answer - Nueva funcionalidad para respuestas de voz
  socket.on('submitVoiceAnswer', async ({ gameId, uid, voiceResponse, questionOptions }) => {
    try {
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();
      if (!gameDoc.exists) {
        socket.emit('error', { error: 'Game not found' });
        return;
      }
      const game = gameDoc.data();
      const currentQ = game.questions[game.currentQuestion];
      if (!currentQ) {
        socket.emit('error', { error: 'No current question' });
        return;
      }

      // Validar respuesta de voz usando el controlador
      const voiceController = require('./controllers/voiceController');
      const validation = matchVoiceResponse(voiceResponse, questionOptions || currentQ.options);
      
      if (!validation.isValid) {
        socket.emit('voiceAnswerError', { 
          error: 'No se pudo reconocer la respuesta de voz',
          suggestions: generateSuggestions(questionOptions || currentQ.options)
        });
        return;
      }

      // Registrar interacción de voz
      await db.collection('voiceInteractions').add({
        userId: uid,
        questionId: currentQ.id || `q_${game.currentQuestion}`,
        gameId: gameId,
        action: 'voice_answer',
        voiceText: voiceResponse,
        confidence: validation.confidence,
        timestamp: new Date(),
        metadata: {
          matchedOption: validation.matchedOption,
          isValid: validation.isValid,
          questionOptions: questionOptions || currentQ.options
        }
      });

      // Procesar la respuesta como una respuesta normal
      if (!socket.data.answers) socket.data.answers = {};
      const responseTime = Date.now();
      socket.data.answers[game.currentQuestion] = { 
        answerIndex: validation.answerIndex, 
        answerValue: validation.matchedOption, 
        responseTime,
        isVoiceAnswer: true,
        confidence: validation.confidence
      };
      socket.data.uid = uid;

      // Notificar a todos los jugadores que se recibió una respuesta de voz
      io.to(gameId).emit('voiceAnswerReceived', {
        uid,
        confidence: validation.confidence,
        matchedOption: validation.matchedOption
      });

      // Continuar con el flujo normal de procesamiento de respuestas
      const sockets = await io.in(gameId).fetchSockets();
      const answers = {};
      sockets.forEach(s => {
        if (s.data.answers && s.data.answers[game.currentQuestion] !== undefined) {
          answers[s.data.uid] = s.data.answers[game.currentQuestion];
        }
      });

      // Solo avanzar si todos respondieron
      if (Object.keys(answers).length === game.players.length) {
        const correctValue = Array.isArray(currentQ.options) && typeof currentQ.correctAnswerIndex === 'number'
          ? currentQ.options[currentQ.correctAnswerIndex]
          : undefined;
        
        const questionStartTime = game.questionStartTimes && game.questionStartTimes[game.currentQuestion] 
          ? game.questionStartTimes[game.currentQuestion] 
          : Date.now();
        
        const updatedPlayers = game.players.map(player => {
          const ansObj = answers[player.uid];
          let score = player.score;
          let responseTimes = player.responseTimes || [];
          
          if (ansObj && ansObj.responseTime) {
            const responseTimeMs = ansObj.responseTime - questionStartTime;
            responseTimes.push(responseTimeMs);
          }
          
          if (ansObj) {
            if (
              typeof ansObj.answerValue !== 'undefined' &&
              typeof correctValue !== 'undefined' &&
              ansObj.answerValue === correctValue
            ) {
              score += 1;
            } else if (
              typeof ansObj.answerIndex === 'number' &&
              typeof currentQ.correctAnswerIndex === 'number' &&
              ansObj.answerIndex === currentQ.correctAnswerIndex
            ) {
              score += 1;
            }
          }
          return { ...player, score, responseTimes };
        });
        
        await gameRef.update({ players: updatedPlayers });
        io.to(gameId).emit('answerResult', {
          correctAnswerIndex: currentQ.correctAnswerIndex,
          explanation: currentQ.explanation,
          players: updatedPlayers
        });
        
        const nextIndex = game.currentQuestion + 1;
        setTimeout(async () => {
          if (nextIndex < game.questions.length) {
            await gameRef.update({ currentQuestion: nextIndex });
            sendQuestion(io, gameId, nextIndex);
          } else {
            await gameRef.update({ status: 'finished' });
            io.to(gameId).emit('gameFinished', { players: updatedPlayers });
            // ... resto del código de finalización del juego
          }
        }, 3000);
      }
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  // [HU8] Toggle Voice Mode - Activar/desactivar modo de voz
  socket.on('toggleVoiceMode', async ({ gameId, uid, voiceModeEnabled }) => {
    try {
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();
      if (!gameDoc.exists) {
        socket.emit('error', { error: 'Game not found' });
        return;
      }

      // Actualizar el estado del modo de voz del jugador
      const game = gameDoc.data();
      const updatedPlayers = game.players.map(player => {
        if (player.uid === uid) {
          return { ...player, voiceModeEnabled: voiceModeEnabled };
        }
        return player;
      });

      await gameRef.update({ players: updatedPlayers });

      // Notificar a todos los jugadores sobre el cambio de modo de voz
      io.to(gameId).emit('voiceModeChanged', {
        uid,
        voiceModeEnabled,
        players: updatedPlayers
      });

      // Registrar la interacción de voz
      await db.collection('voiceInteractions').add({
        userId: uid,
        questionId: null,
        gameId: gameId,
        action: 'voice_mode_toggle',
        voiceText: null,
        confidence: null,
        timestamp: new Date(),
        metadata: {
          voiceModeEnabled,
          gameId
        }
      });

    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  // [HU8] Voice Mode Status - Obtener estado del modo de voz de todos los jugadores
  socket.on('getVoiceModeStatus', async ({ gameId }) => {
    try {
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();
      if (!gameDoc.exists) {
        socket.emit('error', { error: 'Game not found' });
        return;
      }

      const game = gameDoc.data();
      const voiceModeStatus = game.players.map(player => ({
        uid: player.uid,
        displayName: player.displayName,
        voiceModeEnabled: player.voiceModeEnabled || false
      }));

      socket.emit('voiceModeStatus', { players: voiceModeStatus });
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });

  // [HU8] Submit Audio Answer - Nueva funcionalidad para respuestas de audio con AssemblyAI
  socket.on('submitAudioAnswer', async ({ gameId, uid, audioUrl, questionOptions }) => {
    try {
      const gameRef = db.collection('games').doc(gameId);
      const gameDoc = await gameRef.get();
      if (!gameDoc.exists) {
        socket.emit('error', { error: 'Game not found' });
        return;
      }
      const game = gameDoc.data();
      const currentQ = game.questions[game.currentQuestion];
      if (!currentQ) {
        socket.emit('error', { error: 'No current question' });
        return;
      }

      // Procesar audio con AssemblyAI
      const assemblyAI = require('./services/assemblyAIService');
      const result = await assemblyAI.processVoiceAnswer(audioUrl, questionOptions || currentQ.options);
      
      if (!result.success) {
        socket.emit('audioAnswerError', { 
          error: result.error,
          suggestions: result.suggestions
        });
        return;
      }

      if (!result.validation.isValid) {
        socket.emit('audioAnswerError', { 
          error: 'No se pudo reconocer la respuesta de audio',
          suggestions: result.suggestions
        });
        return;
      }

      // Registrar interacción de voz
      await db.collection('voiceInteractions').add({
        userId: uid,
        questionId: currentQ.id || `q_${game.currentQuestion}`,
        gameId: gameId,
        action: 'voice_answer_assemblyai',
        voiceText: result.text,
        confidence: result.confidence,
        timestamp: new Date(),
        metadata: {
          matchedOption: result.validation.matchedOption,
          isValid: result.validation.isValid,
          questionOptions: questionOptions || currentQ.options,
          assemblyAIUsed: true,
          audioUrl: audioUrl
        }
      });

      // Procesar la respuesta como una respuesta normal
      if (!socket.data.answers) socket.data.answers = {};
      const responseTime = Date.now();
      socket.data.answers[game.currentQuestion] = { 
        answerIndex: result.validation.answerIndex, 
        answerValue: result.validation.matchedOption, 
        responseTime,
        isAudioAnswer: true,
        confidence: result.confidence,
        assemblyAIUsed: true
      };
      socket.data.uid = uid;

      // Notificar a todos los jugadores que se recibió una respuesta de audio
      io.to(gameId).emit('audioAnswerReceived', {
        uid,
        confidence: result.confidence,
        matchedOption: result.validation.matchedOption,
        text: result.text,
        assemblyAIUsed: true
      });

      // Continuar con el flujo normal de procesamiento de respuestas
      const sockets = await io.in(gameId).fetchSockets();
      const answers = {};
      sockets.forEach(s => {
        if (s.data.answers && s.data.answers[game.currentQuestion] !== undefined) {
          answers[s.data.uid] = s.data.answers[game.currentQuestion];
        }
      });

      // Solo avanzar si todos respondieron
      if (Object.keys(answers).length === game.players.length) {
        const correctValue = Array.isArray(currentQ.options) && typeof currentQ.correctAnswerIndex === 'number'
          ? currentQ.options[currentQ.correctAnswerIndex]
          : undefined;
        
        const questionStartTime = game.questionStartTimes && game.questionStartTimes[game.currentQuestion] 
          ? game.questionStartTimes[game.currentQuestion] 
          : Date.now();
        
        const updatedPlayers = game.players.map(player => {
          const ansObj = answers[player.uid];
          let score = player.score;
          let responseTimes = player.responseTimes || [];
          
          if (ansObj && ansObj.responseTime) {
            const responseTimeMs = ansObj.responseTime - questionStartTime;
            responseTimes.push(responseTimeMs);
          }
          
          if (ansObj) {
            if (
              typeof ansObj.answerValue !== 'undefined' &&
              typeof correctValue !== 'undefined' &&
              ansObj.answerValue === correctValue
            ) {
              score += 1;
            } else if (
              typeof ansObj.answerIndex === 'number' &&
              typeof currentQ.correctAnswerIndex === 'number' &&
              ansObj.answerIndex === currentQ.correctAnswerIndex
            ) {
              score += 1;
            }
          }
          return { ...player, score, responseTimes };
        });
        
        await gameRef.update({ players: updatedPlayers });
        io.to(gameId).emit('answerResult', {
          correctAnswerIndex: currentQ.correctAnswerIndex,
          explanation: currentQ.explanation,
          players: updatedPlayers
        });
        
        const nextIndex = game.currentQuestion + 1;
        setTimeout(async () => {
          if (nextIndex < game.questions.length) {
            await gameRef.update({ currentQuestion: nextIndex });
            sendQuestion(io, gameId, nextIndex);
          } else {
            await gameRef.update({ status: 'finished' });
            io.to(gameId).emit('gameFinished', { players: updatedPlayers });
            // ... resto del código de finalización del juego
          }
        }, 3000);
      }
    } catch (error) {
      socket.emit('error', { error: error.message });
    }
  });
});

async function sendQuestion(io, gameId, questionIndex) {
  const gameRef = db.collection('games').doc(gameId);
  const gameDoc = await gameRef.get();
  if (!gameDoc.exists) return;
  const game = gameDoc.data();
  if (questionIndex >= game.questions.length) {
    io.to(gameId).emit('gameFinished', { players: game.players });
    await gameRef.update({ status: 'finished' });
    return;
  }
  
  // Determinar el tiempo límite según el modo de voz del jugador
  let questionTimeout = 10; // por defecto 10 segundos
  if (Array.isArray(game.players) && game.players.length > 0) {
    // Si al menos un jugador tiene voiceModeEnabled true, aumentar el tiempo
    const anyVoiceMode = game.players.some(p => p.voiceModeEnabled === true || p.visualDifficulty === true);
    if (anyVoiceMode) {
      questionTimeout = 120;
    }
  }

  // Capturar el timestamp cuando se envía la pregunta
  const questionStartTime = Date.now();
  const questionStartTimes = game.questionStartTimes || {};
  questionStartTimes[questionIndex] = questionStartTime;
  await gameRef.update({ questionStartTimes });

  let question = game.questions[questionIndex];
  // Solo adaptar el campo 'question' si viene como 'text', pero JAMÁS modificar options ni correctAnswerIndex
  if (question) {
    if (!question.question && question.text) {
      const { text, ...rest } = question;
      question = { ...rest, question: text };
    } else if (!question.question && !question.text) {
      io.to(gameId).emit('newQuestion', { question: { question: 'Error: pregunta sin texto', options: [], correctAnswerIndex: null }, index: questionIndex });
      return;
    }
    // Enviar la pregunta y el tiempo límite
    io.to(gameId).emit('newQuestion', { question, index: questionIndex, timeout: questionTimeout });
  } else {
    io.to(gameId).emit('newQuestion', { question: { question: 'Error: pregunta no encontrada', options: [], correctAnswerIndex: null }, index: questionIndex, timeout: questionTimeout });
  }
}

// [HU8] Importar funciones de recnocimiento de voz
const { matchVoiceResponse, generateSuggestions } = require('./utils/voiceRecognition');

// Middleware para manejar rutas no encontradas (404) - siempre devolver JSON
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `The requested endpoint does not exist: ${req.method} ${req.path}`
  });
});

// ✅ SECURITY FIX: Middleware de manejo de errores global - no exponer detalles internos
app.use((err, req, res, next) => {
  console.error('Error en el servidor:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  });
  
  const statusCode = err.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Generic message for production to avoid leaking info
  const clientMessage = isProduction 
    ? 'Internal server error. Please contact support.'
    : err.message;
  
  res.status(statusCode).json({
    success: false,
    error: clientMessage,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor híbrido ejecutándose en puerto ${PORT}`);
  console.log(`📚 Documentación API disponible en https://backend-v1-latest.onrender.com/api-docs/`);
});

module.exports = { app, matchVoiceResponse };

