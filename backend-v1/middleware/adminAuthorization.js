/**
 * Admin Authorization Middleware
 * ✅ SECURITY FIX: Verifies if user has admin role before accessing admin endpoints
 */

const { db } = require('../firebase');

/**
 * Middleware to check if user is admin
 * Prevents unauthorized access to admin endpoints
 */
async function requireAdmin(req, res, next) {
  try {
    const uid = req.user?.uid;
    
    if (!uid) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Fetch user document to check admin role
    const userDoc = await db.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    
    // Check if user has admin role
    if (!userData.isAdmin || userData.isAdmin !== true) {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.' 
      });
    }

    // Add admin flag to request for logging purposes
    req.isAdmin = true;
    next();
  } catch (error) {
    console.error('Admin authorization error:', error);
    return res.status(500).json({ error: 'Authorization verification failed' });
  }
}

module.exports = requireAdmin;
