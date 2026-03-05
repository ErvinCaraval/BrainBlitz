// Obtener historial de partidas del usuario
exports.getHistory = async (req, res) => {
  // Historial de partidas deshabilitado 
  res.json([]);
};
const { auth, db } = require('../firebase');

// Register a new user
exports.register = async (req, res) => {
  const { email, password, displayName, visualDifficulty } = req.body;
  
  // Validate visualDifficulty field
  if (visualDifficulty !== undefined && typeof visualDifficulty !== 'boolean') {
    return res.status(400).json({ error: 'visualDifficulty must be a boolean value' });
  }
  
  try {
    // Create user in Firebase Auth
    const userRecord = await auth.createUser({
      email,
      password,
      displayName
    });
    
    // Prepare user data for Firestore
    const userData = {
      email,
      displayName,
      stats: { gamesPlayed: 0, wins: 0, correctAnswers: 0 },
      visualDifficulty: visualDifficulty || false // Default to false if not provided
    };
    
    // Add user to Firestore
    await db.collection('users').doc(userRecord.uid).set(userData);
    
    res.status(201).json({ 
      uid: userRecord.uid, 
      email, 
      displayName,
      visualDifficulty: userData.visualDifficulty
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Login (session endpoint, optional)
exports.login = async (req, res) => {
  
  res.status(501).json({ error: 'Login handled on client.' });
};

// Password recovery
exports.recoverPassword = async (req, res) => {
  const { email } = req.body;
  try {
    await auth.generatePasswordResetLink(email);
    res.json({ message: 'Password reset email sent.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Update user profile (including accessibility preferences)
exports.updateProfile = async (req, res) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { displayName, visualDifficulty } = req.body;
  
  // Validate visualDifficulty field if provided
  if (visualDifficulty !== undefined && typeof visualDifficulty !== 'boolean') {
    return res.status(400).json({ error: 'visualDifficulty must be a boolean value' });
  }

  try {
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentData = userDoc.data();
    const updateData = {};

    // Only update fields that are provided
    if (displayName !== undefined) {
      updateData.displayName = displayName;
    }
    if (visualDifficulty !== undefined) {
      updateData.visualDifficulty = visualDifficulty;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    await userRef.update(updateData);
    
    // Return updated user data
    const updatedDoc = await userRef.get();
    const updatedData = updatedDoc.data();
    
    res.json({
      uid,
      displayName: updatedData.displayName,
      email: updatedData.email,
      visualDifficulty: updatedData.visualDifficulty || false,
      stats: updatedData.stats || { gamesPlayed: 0, wins: 0, correctAnswers: 0 }
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get user stats
exports.getStats = async (req, res) => {
  // In production, validate user identity (e.g., via Firebase ID token)
  // Usar el UID autenticado si existe, o el de la query como fallback
  const uid = req.user?.uid || req.query.uid;
  if (!uid) {

    return res.status(400).json({ error: 'Missing uid' });
  }
  try {
    const userRef = db.collection('users').doc(uid);
    let userDoc = await userRef.get();
    if (!userDoc.exists) {
      const displayName = req.user?.name || req.user?.displayName || '';
      const email = req.user?.email || '';
      const newUser = {
        displayName,
        email,
        stats: { gamesPlayed: 0, wins: 0, correctAnswers: 0 },
        visualDifficulty: false // Default value for new users
      };
      await userRef.set(newUser);
      userDoc = await userRef.get();

    }
    const data = userDoc.data();
    const response = {
      uid,
      stats: data.stats || { gamesPlayed: 0, wins: 0, correctAnswers: 0 },
      visualDifficulty: data.visualDifficulty || false
    };
    res.json(response);
  } catch (error) {

    res.status(400).json({ error: error.message });
  }
};
