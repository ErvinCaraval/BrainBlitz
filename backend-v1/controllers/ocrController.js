const azureOCRService = require('../services/azureOCRService');

/**
 * OCR Controller
 * Handles image processing and text extraction
 */

/**
 * Process image from URL
 * POST /api/ocr/process-url
 */
exports.processImageFromUrl = async (req, res) => {
    try {
        const { imageUrl, language } = req.body;

        if (!imageUrl || typeof imageUrl !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing imageUrl'
            });
        }

        if (!azureOCRService.enabled) {
            return res.status(503).json({
                success: false,
                error: 'OCR service is not configured'
            });
        }

        // Extract text from image
        const ocrResult = await azureOCRService.extractTextFromUrl(
            imageUrl,
            language || 'es'
        );

        // Check if text was actually extracted
        if (!ocrResult.rawText || ocrResult.rawText.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'No text found in the image. Please provide an image with clear, readable text.'
            });
        }

        // Parse extracted text to question format
        const parsed = azureOCRService.parseQuestionFromText(ocrResult.rawText);

        return res.json({
            success: true,
            rawText: ocrResult.rawText,
            pregunta: parsed.pregunta,
            opciones: parsed.opciones,
            confidence: 'medium' // Could be enhanced with confidence metrics
        });
    } catch (error) {
        console.error('Error processing image from URL:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error processing image'
        });
    }
};

/**
 * Process image from base64 or buffer
 * POST /api/ocr/process-image
 * Expects base64 encoded image in request body
 */
exports.processImageFromBuffer = async (req, res) => {
    try {
        const { imageBase64, mimeType, language } = req.body;

        if (!imageBase64 || typeof imageBase64 !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Invalid or missing imageBase64'
            });
        }

        if (!azureOCRService.enabled) {
            return res.status(503).json({
                success: false,
                error: 'OCR service is not configured'
            });
        }

        // Convert base64 to buffer
        let imageBuffer;
        try {
            // Handle both data URI format and plain base64
            let base64Data = imageBase64;
            if (imageBase64.includes(',')) {
                base64Data = imageBase64.split(',')[1];
            }
            imageBuffer = Buffer.from(base64Data, 'base64');
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: 'Invalid base64 image data'
            });
        }

        // Validate buffer size (max 50MB)
        if (imageBuffer.length > 50 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                error: 'Image size exceeds maximum allowed (50MB)'
            });
        }

        // Extract text from image
        console.log('📸 OCR: Iniciando extracción de texto del buffer...');
        const ocrResult = await azureOCRService.extractTextFromBuffer(
            imageBuffer,
            mimeType || 'image/jpeg',
            language || 'es'
        );

        console.log('📸 OCR: Resultado recibido');
        console.log(`📸 OCR: rawText length: ${ocrResult.rawText ? ocrResult.rawText.length : 0}`);
        console.log(`📸 OCR: rawText content: "${ocrResult.rawText}"`);

        // Parse extracted text to question format
        // Note: Even if text is minimal, we parse it and return empty strings for missing fields
        console.log('📸 OCR: Parsing question from text...');
        const parsed = azureOCRService.parseQuestionFromText(ocrResult.rawText || '');
        
        console.log('📸 OCR: Parse result:');
        console.log(`   Pregunta: "${parsed.pregunta}"`);
        console.log(`   Opciones: ${JSON.stringify(parsed.opciones)}`);

        // Always return 200 with the parsed result (even if fields are empty)
        // Frontend can show manual entry button if fields are empty
        return res.json({
            success: true,
            rawText: ocrResult.rawText || '',
            pregunta: parsed.pregunta,
            opciones: parsed.opciones,
            confidence: ocrResult.rawText && ocrResult.rawText.length > 20 ? 'high' : 'low'
        });
    } catch (error) {
        console.error('Error processing image from buffer:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Error processing image'
        });
    }
};

/**
 * Health check endpoint for OCR service
 * GET /api/ocr/health
 */
exports.healthCheck = async (req, res) => {
    return res.json({
        success: true,
        status: azureOCRService.enabled ? 'healthy' : 'disabled',
        service: 'azure-computer-vision-ocr'
    });
};
