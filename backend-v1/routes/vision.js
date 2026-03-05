const express = require('express');
const router = express.Router();

const visionController = require('../controllers/visionController');
const authenticate = require('../middleware/authenticate');
const { generalUserLimiter } = require('../middleware/rateLimiter');

// Existing route
router.post(
  '/analyze-image',
  authenticate,
  generalUserLimiter,
  visionController.analyzeImage
);

// HU-VC4: Object Detection endpoint
router.post(
  '/detect-objects',
  authenticate,
  generalUserLimiter,
  visionController.detectObjects
);

module.exports = router;