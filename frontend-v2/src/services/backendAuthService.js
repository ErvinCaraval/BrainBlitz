/**
 * Backend Authentication Service
 * This service communicates with the backend API for authentication
 * instead of connecting directly to Firebase from the frontend
 */

import { signInWithCustomToken, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from './firebase';

// Use runtime environment configuration
const API_BASE_URL = () => {
  // Primero intenta window.ENV (runtime configuration)
  if (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) {
    return window.ENV.VITE_API_URL;
  }
  // Fallback a import.meta.env (build-time configuration)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // Last resort: default
  return 'http://localhost:5000/api';
};

class BackendAuthService {
  /**
   * Register a new user via backend
   * @param {string} email
   * @param {string} password
   * @param {string} displayName
   * @param {boolean} visualDifficulty
   * @returns {Promise<{uid, email, displayName, visualDifficulty, token}>}
   */
  async register(email, password, displayName, visualDifficulty = false) {
    try {
      const response = await fetch(`${API_BASE_URL()}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          displayName,
          visualDifficulty
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();

      // Sign in with the custom token returned from backend
      await signInWithCustomToken(auth, data.token);

      return data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  /**
   * Login user via Backend (NOT direct Firebase)
   * Backend validates credentials and returns custom token
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{uid, email, displayName, visualDifficulty}>}
   */
  async login(email, password) {
    try {
      // ✅ IMPORTANT: Login goes through backend first!
      const response = await fetch(`${API_BASE_URL()}/auth/verify-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();

      // Sign in with custom token returned from backend
      await signInWithCustomToken(auth, data.token);

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Get current user's ID token
   * @returns {Promise<string>}
   */
  async getIdToken() {
    if (!auth.currentUser) {
      throw new Error('No user logged in');
    }
    return await auth.currentUser.getIdToken();
  }

  /**
   * Verify token with backend
   * @param {string} idToken
   * @returns {Promise<{uid, email, displayName, visualDifficulty}>}
   */
  async verifyToken(idToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/verify-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Token verification failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Token verification error:', error);
      throw error;
    }
  }

  /**
   * Send password reset email via backend
   * @param {string} email
   * @returns {Promise<{message}>}
   */
  async sendPasswordResetEmail(email) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Password reset failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Update user profile via backend
   * @param {string} idToken
   * @param {Object} updates
   * @returns {Promise<{uid, email, displayName, visualDifficulty}>}
   */
  async updateProfile(idToken, updates) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Profile update failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  }

  /**
   * Get current user profile via backend
   * @param {string} idToken
   * @returns {Promise<{uid, email, displayName, visualDifficulty, stats}>}
   */
  async getProfile(idToken) {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Get profile failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Get profile error:', error);
      throw error;
    }
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }
}

export default new BackendAuthService();
