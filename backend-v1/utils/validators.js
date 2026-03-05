/**
 * Input validators for security
 * ✅ SECURITY FIX: Centralized input validation
 */

// Email format validation (RFC 5322 simplified)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {object} { valid: boolean, message: string }
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required' };
  }
  
  if (email.length > 254) {
    return { valid: false, message: 'Email is too long' };
  }
  
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  
  return { valid: true };
}

/**
 * Validate password strength
 * Requirements:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 * - At least 1 special character (@$!%*?&)
 * @param {string} password - Password to validate
 * @returns {object} { valid: boolean, message: string }
 */
function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  
  if (password.length > 128) {
    return { valid: false, message: 'Password is too long' };
  }
  
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter' };
  }
  
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter' };
  }
  
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  if (!/[@$!%*?&]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (@$!%*?&)' };
  }
  
  return { valid: true };
}

/**
 * Sanitize display name
 * Removes dangerous characters and enforces length limits
 * @param {string} displayName - Display name to sanitize
 * @returns {object} { valid: boolean, message: string, sanitized: string }
 */
function validateDisplayName(displayName) {
  if (!displayName || typeof displayName !== 'string') {
    return { valid: false, message: 'Display name is required' };
  }
  
  if (displayName.length > 50) {
    return { valid: false, message: 'Display name is too long (max 50 characters)' };
  }
  
  if (displayName.length < 2) {
    return { valid: false, message: 'Display name is too short (min 2 characters)' };
  }
  
  // Remove potentially dangerous characters
  const sanitized = displayName
    .replace(/[<>\"'`]/g, '') // Remove HTML/script chars
    .replace(/(javascript|data|vbscript):/gi, '') // Remove dangerous protocols (javascript:, data:, vbscript:)
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers
  
  if (sanitized !== displayName) {
    return { 
      valid: false, 
      message: 'Display name contains invalid characters',
      sanitized 
    };
  }
  
  return { valid: true, sanitized: displayName };
}

/**
 * Validate file size for uploads
 * @param {number} fileSize - File size in bytes
 * @param {number} maxSizeMB - Maximum size in MB
 * @returns {object} { valid: boolean, message: string }
 */
function validateFileSize(fileSize, maxSizeMB = 50) {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (fileSize > maxSizeBytes) {
    return { 
      valid: false, 
      message: `File size exceeds maximum allowed (${maxSizeMB}MB)` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate MIME type
 * @param {string} mimeType - MIME type to validate
 * @param {array} allowedTypes - Array of allowed MIME types
 * @returns {object} { valid: boolean, message: string }
 */
function validateMimeType(mimeType, allowedTypes = []) {
  if (!mimeType || typeof mimeType !== 'string') {
    return { valid: false, message: 'MIME type is required' };
  }
  
  if (allowedTypes.length > 0 && !allowedTypes.includes(mimeType)) {
    return { 
      valid: false, 
      message: `Invalid file type. Allowed: ${allowedTypes.join(', ')}` 
    };
  }
  
  return { valid: true };
}

module.exports = {
  validateEmail,
  validatePassword,
  validateDisplayName,
  validateFileSize,
  validateMimeType
};
