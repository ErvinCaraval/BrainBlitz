const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const authenticate = require('../middleware/authenticate');
const { registerLimiter, loginLimiter } = require('../middleware/rateLimiter');
const { validateEmail, validatePassword, validateDisplayName } = require('../utils/validators');

/**
 * POST /auth/register
 * Register a new user
 * ✅ SECURITY FIX: Added comprehensive input validation
 */
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { email, password, displayName, visualDifficulty } = req.body;

    // Validate required fields
    if (!email || !password || !displayName) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, displayName'
      });
    }

    // ✅ SECURITY FIX: Validate email format
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      return res.status(400).json({ error: emailValidation.message });
    }

    // ✅ SECURITY FIX: Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ error: passwordValidation.message });
    }

    // ✅ SECURITY FIX: Validate and sanitize display name
    const displayNameValidation = validateDisplayName(displayName);
    if (!displayNameValidation.valid) {
      return res.status(400).json({ error: displayNameValidation.message });
    }

    const result = await authService.registerUser(
      email,
      passwordValidation, // Use validated password
      displayNameValidation.sanitized, // Use sanitized display name
      visualDifficulty || false
    );

    return res.status(201).json(result);
  } catch (error) {
    console.error('Register error:', error);
    return res.status(400).json({ error: 'Registration failed' });
  }
});

/**
 * POST /auth/verify-credentials
 * Login: Verify email/password and return custom token
 * ✅ This endpoint is REQUIRED for login (backend validation)
 * ✅ SECURITY FIX: Added rate limiting to prevent brute-force attacks
 * ✅ SECURITY FIX: NOW VERIFIES PASSWORD ON BACKEND using Firebase REST API
 */
router.post('/verify-credentials', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields: email, password'
      });
    }

    // ✅ SECURITY FIX: Verify password using Firebase REST API (signInWithPassword)
    // This ensures password is verified server-side, not client-side
    try {
      const firebaseApiKey = process.env.FIREBASE_API_KEY;
      if (!firebaseApiKey) {
        console.error('FIREBASE_API_KEY not configured');
        return res.status(500).json({ error: 'Authentication service misconfigured' });
      }

      const firebaseResponse = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            returnSecureToken: true
          })
        }
      );

      if (!firebaseResponse.ok) {
        // Password verification failed
        const errorData = await firebaseResponse.json();
        console.error('Firebase auth error:', errorData.error?.message);
        
        // Don't leak specific error messages to client
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const { localId, idToken } = await firebaseResponse.json();

      // Get user data from Firestore
      const userDoc = await authService.db.collection('users').doc(localId).get();
      const userData = userDoc.data() || {};

      // Generate custom token (password already verified above)
      const customToken = await authService.auth.createCustomToken(localId);

      return res.json({
        uid: localId,
        email,
        displayName: userData.displayName || '',
        visualDifficulty: userData.visualDifficulty || false,
        token: customToken,
        idToken // Also return idToken for extra validation if needed
      });
    } catch (firebaseError) {
      console.error('Firebase authentication error:', firebaseError);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  } catch (error) {
    console.error('Credentials verification error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /auth/verify-token
 * Verify Firebase ID token from client
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    const userData = await authService.verifyToken(idToken);
    return res.json(userData);
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

/**
 * POST /auth/password-reset
 * Send password reset email
 */
router.post('/password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    const resetLink = await authService.sendPasswordResetEmail(email);
    return res.json({
      message: 'Password reset email sent',
      resetLink // In production, don't expose this; send it via email only
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return res.status(400).json({ error: 'Password reset request failed' });
  }
});

/**
 * PUT /auth/profile
 * Update user profile (requires authentication)
 */
router.put('/profile', authenticate, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { displayName, visualDifficulty } = req.body;

    if (!displayName && visualDifficulty === undefined) {
      return res.status(400).json({
        error: 'At least one field is required: displayName or visualDifficulty'
      });
    }

    const result = await authService.updateUserProfile(uid, {
      displayName,
      visualDifficulty
    });

    return res.json(result);
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(400).json({ error: 'Profile update failed' });
  }
});

/**
 * GET /auth/profile
 * Get current user profile (requires authentication)
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userData = await authService.getUserByUID(uid);
    return res.json(userData);
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(400).json({ error: 'Failed to retrieve profile' });
  }
});

module.exports = router;
