const express = require('express');
const router = express.Router();

const ocrController = require('../controllers/ocrController');
const { generalUserLimiter } = require('../middleware/rateLimiter');

/**
 * OCR Routes
 * Handles image processing and text extraction from images
 */

// Health check - no authentication needed
router.get('/health', ocrController.healthCheck);

// Process image from URL
// POST /api/ocr/process-url
// Body: { imageUrl: string, language?: string }
router.post('/process-url', generalUserLimiter, ocrController.processImageFromUrl);

// Process image from base64 buffer
// POST /api/ocr/process-image
// Body: { imageBase64: string, mimeType?: string, language?: string }
router.post('/process-image', generalUserLimiter, ocrController.processImageFromBuffer);

module.exports = router;
