
const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const authenticate = require('../middleware/authenticate');
const requireAdmin = require('../middleware/adminAuthorization');
const { generalUserLimiter } = require('../middleware/rateLimiter'); 

// [HU7] Obtener configuración de accesibilidad del usuario autenticad
router.get('/accessibility', authenticate, generalUserLimiter, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return res.status(404).json({ error: 'Usuario no encontrado' });
    const data = userDoc.data();
    res.json({
      visualDifficulty: data.visualDifficulty || false,
      stats: data.stats || {},
      email: data.email,
      displayName: data.displayName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [HU7] Actualizar configuración de accesibilidad del usuario autenticado
router.put('/accessibility', authenticate, generalUserLimiter, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });
    const { visualDifficulty } = req.body;
    if (visualDifficulty !== undefined && typeof visualDifficulty !== 'boolean') {
      return res.status(400).json({ error: 'visualDifficulty debe ser booleano' });
    }
    const userRef = db.collection('users').doc(uid);
    await userRef.update({ visualDifficulty });
    const updatedDoc = await userRef.get();
    const updatedData = updatedDoc.data();
    res.json({
      visualDifficulty: updatedData.visualDifficulty || false,
      email: updatedData.email,
      displayName: updatedData.displayName
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [HU7] Estadísticas de accesibilidad del usuario autenticado
router.get('/accessibility/stats', authenticate, generalUserLimiter, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });
    const snapshot = await db.collection('voiceInteractions').where('userId', '==', uid).get();
    let total = 0;
    let totalDuration = 0;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (typeof data.duration === 'number') {
        total++;
        totalDuration += data.duration;
      }
    });
    const avgDuration = total > 0 ? totalDuration / total : 0;
    res.json({ totalInteractions: total, averageDuration: avgDuration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [HU7] Obtener estadísticas globales de accesibilidad (ADMIN)
// ✅ SECURITY FIX: Ahora requiere rol de admin
router.get('/accessibility-stats', authenticate, requireAdmin, generalUserLimiter, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });
    
    // Obtener estadísticas de usuarios con dificultades visuales
    const usersSnapshot = await db.collection('users').get();
    let totalUsers = 0;
    let usersWithVisualDifficulty = 0;
    let voiceModeUsers = 0;
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      totalUsers++;
      if (data.visualDifficulty) {
        usersWithVisualDifficulty++;
        voiceModeUsers++;
      }
    });
    
    // Obtener estadísticas de interacciones de voz
    const voiceInteractionsSnapshot = await db.collection('voiceInteractions').get();
    let totalVoiceInteractions = 0;
    let totalVoiceDuration = 0;
    let voiceAnswerCount = 0;
    let questionReadCount = 0;
    
    voiceInteractionsSnapshot.forEach(doc => {
      const data = doc.data();
      totalVoiceInteractions++;
      if (typeof data.duration === 'number') {
        totalVoiceDuration += data.duration;
      }
      if (data.action === 'voice_answer') voiceAnswerCount++;
      if (data.action === 'question_read') questionReadCount++;
    });
    
    const avgVoiceDuration = totalVoiceInteractions > 0 ? totalVoiceDuration / totalVoiceInteractions : 0;
    const adoptionRate = totalUsers > 0 ? (usersWithVisualDifficulty / totalUsers) * 100 : 0;
    
    res.json({
      totalUsers,
      usersWithVisualDifficulty,
      voiceModeUsers,
      adoptionRate: Math.round(adoptionRate * 100) / 100,
      totalVoiceInteractions,
      avgVoiceDuration: Math.round(avgVoiceDuration * 100) / 100,
      voiceAnswerCount,
      questionReadCount,
      lastUpdated: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [HU7] Obtener lista de usuarios con modo de voz (ADMIN)
// ✅ SECURITY FIX: Ahora requiere rol de admin
router.get('/voice-mode-users', authenticate, requireAdmin, generalUserLimiter, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });
    
    const usersSnapshot = await db.collection('users').where('visualDifficulty', '==', true).get();
    const voiceModeUsers = [];
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      voiceModeUsers.push({
        uid: doc.id,
        email: data.email,
        displayName: data.displayName,
        visualDifficulty: data.visualDifficulty,
        createdAt: data.createdAt,
        lastLogin: data.lastLogin
      });
    });
    
    res.json({
      total: voiceModeUsers.length,
      users: voiceModeUsers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [HU7] Configuración global de accesibilidad (ADMIN)
// ✅ SECURITY FIX: Ahora requiere rol de admin
router.get('/accessibility-settings', authenticate, requireAdmin, generalUserLimiter, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });
    
    // Obtener configuración global (esto podría estar en una colección separada)
    // Por ahora, devolvemos configuración por defecto
    const settings = {
      voiceModeEnabled: true,
      defaultVoiceSettings: {
        rate: 1.0,
        volume: 1.0,
        pitch: 1.0,
        language: 'es-ES'
      },
      maxAudioSize: 2e6, // 2MB
      supportedLanguages: ['es-ES', 'en-US'],
      features: {
        textToSpeech: true,
        speechRecognition: true,
        voiceNavigation: true,
        audioTutorial: true
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [HU7] Actualizar configuración global de accesibilidad (ADMIN)
// ✅ SECURITY FIX: Ahora requiere rol de admin
router.put('/accessibility-settings', authenticate, requireAdmin, generalUserLimiter, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });
    
    const { voiceModeEnabled, defaultVoiceSettings, maxAudioSize, features } = req.body;
    
    // Validar datos de entrada
    if (voiceModeEnabled !== undefined && typeof voiceModeEnabled !== 'boolean') {
      return res.status(400).json({ error: 'voiceModeEnabled debe ser booleano' });
    }
    
    if (maxAudioSize !== undefined && (typeof maxAudioSize !== 'number' || maxAudioSize <= 0)) {
      return res.status(400).json({ error: 'maxAudioSize debe ser un número positivo' });
    }
    
    // Aquí se actualizaría la configuración global en la base de datos
    // Por ahora, solo devolvemos la configuración actualizada
    const updatedSettings = {
      voiceModeEnabled: voiceModeEnabled !== undefined ? voiceModeEnabled : true,
      defaultVoiceSettings: defaultVoiceSettings || {
        rate: 1.0,
        volume: 1.0,
        pitch: 1.0,
        language: 'es-ES'
      },
      maxAudioSize: maxAudioSize || 2e6,
      supportedLanguages: ['es-ES', 'en-US'],
      features: features || {
        textToSpeech: true,
        speechRecognition: true,
        voiceNavigation: true,
        audioTutorial: true
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json(updatedSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// [HU7] Generar reporte de accesibilidad (ADMIN)
// ✅ SECURITY FIX: Ahora requiere rol de admin
router.get('/accessibility-report', authenticate, requireAdmin, generalUserLimiter, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'No autenticado' });
    
    const { startDate, endDate } = req.query;
    
    // Obtener estadísticas de usuarios
    const usersSnapshot = await db.collection('users').get();
    let totalUsers = 0;
    let usersWithVisualDifficulty = 0;
    
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      totalUsers++;
      if (data.visualDifficulty) {
        usersWithVisualDifficulty++;
      }
    });
    
    // Obtener estadísticas de interacciones de voz
    let voiceInteractionsQuery = db.collection('voiceInteractions');
    
    if (startDate) {
      voiceInteractionsQuery = voiceInteractionsQuery.where('timestamp', '>=', new Date(startDate));
    }
    if (endDate) {
      voiceInteractionsQuery = voiceInteractionsQuery.where('timestamp', '<=', new Date(endDate));
    }
    
    const voiceInteractionsSnapshot = await voiceInteractionsQuery.get();
    let totalVoiceInteractions = 0;
    let totalVoiceDuration = 0;
    let actionCounts = {};
    
    voiceInteractionsSnapshot.forEach(doc => {
      const data = doc.data();
      totalVoiceInteractions++;
      if (typeof data.duration === 'number') {
        totalVoiceDuration += data.duration;
      }
      actionCounts[data.action] = (actionCounts[data.action] || 0) + 1;
    });
    
    const avgVoiceDuration = totalVoiceInteractions > 0 ? totalVoiceDuration / totalVoiceInteractions : 0;
    const adoptionRate = totalUsers > 0 ? (usersWithVisualDifficulty / totalUsers) * 100 : 0;
    
    const report = {
      period: {
        startDate: startDate || 'N/A',
        endDate: endDate || 'N/A'
      },
      userStats: {
        totalUsers,
        usersWithVisualDifficulty,
        adoptionRate: Math.round(adoptionRate * 100) / 100
      },
      voiceStats: {
        totalVoiceInteractions,
        avgVoiceDuration: Math.round(avgVoiceDuration * 100) / 100,
        actionCounts
      },
      generatedAt: new Date().toISOString(),
      generatedBy: uid
    };
    
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
// Rate limiting applied to all routes
