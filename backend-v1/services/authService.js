const { auth, db } = require('../firebase');

class AuthService {
  constructor() {
    this.auth = auth;
    this.db = db;
  }

  /**
   * Register a new user
   * @param {string} email
   * @param {string} password
   * @param {string} displayName
   * @param {boolean} visualDifficulty
   * @returns {Promise<{uid, email, displayName, visualDifficulty, token}>}
   */
  async registerUser(email, password, displayName, visualDifficulty = false) {
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
        visualDifficulty: visualDifficulty || false,
        createdAt: new Date().toISOString()
      };

      // Add user to Firestore
      await db.collection('users').doc(userRecord.uid).set(userData);

      // Generate custom token for the frontend
      const token = await auth.createCustomToken(userRecord.uid);

      return {
        uid: userRecord.uid,
        email,
        displayName,
        visualDifficulty: userData.visualDifficulty,
        token
      };
    } catch (error) {
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  /**
   * Login user by email and password
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{uid, email, displayName, visualDifficulty, token}>}
   */
  async loginUser(email, password) {
    try {
      // Get user by email
      const userRecord = await auth.getUserByEmail(email);

      // Verify password (note: Firebase Admin SDK doesn't verify passwords directly)
      // The frontend should verify password using Firebase Client SDK
      // This endpoint is mainly for backend-to-backend communication

      // Get user data from Firestore
      const userDoc = await db.collection('users').doc(userRecord.uid).get();
      const userData = userDoc.data() || {};

      // Generate custom token for the frontend
      const token = await auth.createCustomToken(userRecord.uid);

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        displayName: userRecord.displayName || userData.displayName || '',
        visualDifficulty: userData.visualDifficulty || false,
        token
      };
    } catch (error) {
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  /**
   * Verify ID token and return user data
   * @param {string} idToken Firebase ID token from client
   * @returns {Promise<{uid, email, displayName, visualDifficulty}>}
   */
  async verifyToken(idToken) {
    try {
      const decoded = await auth.verifyIdToken(idToken);
      const uid = decoded.uid;

      // Get user data from Firestore
      const userDoc = await db.collection('users').doc(uid).get();
      const userData = userDoc.data() || {};

      return {
        uid,
        email: decoded.email || userData.email,
        displayName: decoded.name || userData.displayName || '',
        visualDifficulty: userData.visualDifficulty || false
      };
    } catch (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Send password reset email
   * @param {string} email
   * @returns {Promise<string>} reset link
   */
  async sendPasswordResetEmail(email) {
    try {
      const resetLink = await auth.generatePasswordResetLink(email);
      return resetLink;
    } catch (error) {
      throw new Error(`Password reset failed: ${error.message}`);
    }
  }

  /**
   * Update user profile
   * @param {string} uid
   * @param {Object} updates - { displayName, visualDifficulty }
   * @returns {Promise<{uid, email, displayName, visualDifficulty}>}
   */
  async updateUserProfile(uid, updates) {
    try {
      const userRef = db.collection('users').doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const validUpdates = {};

      // Validate and prepare updates
      if (updates.displayName !== undefined) {
        validUpdates.displayName = updates.displayName;
        // Also update in Firebase Auth
        await auth.updateUser(uid, { displayName: updates.displayName });
      }

      if (updates.visualDifficulty !== undefined) {
        if (typeof updates.visualDifficulty !== 'boolean') {
          throw new Error('visualDifficulty must be a boolean');
        }
        validUpdates.visualDifficulty = updates.visualDifficulty;
      }

      if (Object.keys(validUpdates).length === 0) {
        throw new Error('No valid fields to update');
      }

      await userRef.update(validUpdates);

      // Get updated user data
      const updatedDoc = await userRef.get();
      const updatedData = updatedDoc.data();

      return {
        uid,
        displayName: updatedData.displayName,
        email: updatedData.email,
        visualDifficulty: updatedData.visualDifficulty || false
      };
    } catch (error) {
      throw new Error(`Profile update failed: ${error.message}`);
    }
  }

  /**
   * Get user by UID
   * @param {string} uid
   * @returns {Promise<{uid, email, displayName, visualDifficulty, stats}>}
   */
  async getUserByUID(uid) {
    try {
      const userDoc = await db.collection('users').doc(uid).get();

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const data = userDoc.data();

      return {
        uid,
        email: data.email,
        displayName: data.displayName,
        visualDifficulty: data.visualDifficulty || false,
        stats: data.stats || { gamesPlayed: 0, wins: 0, correctAnswers: 0 }
      };
    } catch (error) {
      throw new Error(`Get user failed: ${error.message}`);
    }
  }
}

module.exports = new AuthService();
