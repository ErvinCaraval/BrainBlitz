const axios = require('axios');
const sharp = require('sharp');

/**
 * Azure Computer Vision OCR Service
 * Extracts text from images and parses question format
 */
class AzureOCRService {
    constructor() {
        // Check for required Azure Computer Vision credentials
        if (!process.env.AZURE_CV_API_KEY || !process.env.AZURE_CV_ENDPOINT) {
            console.warn('⚠️  Azure Computer Vision credentials not configured - OCR service will be disabled');
            this.enabled = false;
            return;
        }

        this.enabled = true;
        this.apiKey = process.env.AZURE_CV_API_KEY;
        this.endpoint = process.env.AZURE_CV_ENDPOINT;
        
        // Construct the OCR endpoint URL
        this.ocrUrl = `${this.endpoint}vision/v3.2/ocr`;
        
        console.log(`✅ Azure Computer Vision OCR Service initialized`);
        console.log(`   Endpoint: ${this.endpoint}`);
    }

    /**
     * Extract text from image URL using Azure Computer Vision
     * @param {string} imageUrl - URL of the image
     * @param {string} language - Language code (default: 'es')
     * @returns {Promise<Object>} OCR result with extracted text
     */
    async extractTextFromUrl(imageUrl, language = 'es') {
        if (!this.enabled) {
            throw new Error('Azure Computer Vision OCR service is not configured');
        }

        if (!imageUrl || typeof imageUrl !== 'string') {
            throw new Error('Invalid image URL');
        }

        try {
            const response = await axios.post(
                `${this.ocrUrl}?language=${language}`,
                { url: imageUrl },
                {
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Extract text from response
            const extractedText = this.extractTextFromResponse(response.data);
            return {
                success: true,
                rawText: extractedText,
                fullResponse: response.data
            };
        } catch (error) {
            console.error('Error extracting text from image URL:', error.message);
            throw new Error(`Failed to extract text from image: ${error.message}`);
        }
    }

    /**
     * Extract text from image buffer using Azure Computer Vision
     * @param {Buffer} imageBuffer - Image buffer
     * @param {string} mimeType - MIME type of the image (e.g., 'image/jpeg')
     * @param {string} language - Language code (default: 'es')
     * @returns {Promise<Object>} OCR result with extracted text
     */
    async extractTextFromBuffer(imageBuffer, mimeType = 'image/jpeg', language = 'es') {
        if (!this.enabled) {
            throw new Error('Azure Computer Vision OCR service is not configured');
        }

        if (!Buffer.isBuffer(imageBuffer)) {
            throw new Error('Invalid image buffer');
        }

        try {
            console.log(`🔍 OCR DEBUG: Imagen recibida (${imageBuffer.length} bytes)`);
            
            // Enhance image for better OCR recognition
            console.log(`🔍 OCR DEBUG: Mejorando imagen...`);
            const enhancedImageBuffer = await this.enhanceImageForOCR(imageBuffer);
            
            console.log(`🔍 OCR DEBUG: Enviando imagen mejorada (${enhancedImageBuffer.length} bytes) a Azure...`);
            
            // Try with image analysis API that has better options
            const ocrUrl = `${this.endpoint}vision/v3.2/ocr`;
            const response = await axios.post(
                `${ocrUrl}?language=${language}&detectOrientation=true`,
                enhancedImageBuffer,
                {
                    headers: {
                        'Ocp-Apim-Subscription-Key': this.apiKey,
                        'Content-Type': mimeType
                    },
                    timeout: 60000
                }
            );

            console.log(`🔍 OCR DEBUG: Respuesta de Azure recibida`);
            console.log(`🔍 OCR DEBUG: Regiones encontradas: ${response.data.regions ? response.data.regions.length : 0}`);

            // Extract text from response
            const extractedText = this.extractTextFromResponse(response.data);
            
            console.log(`🔍 OCR DEBUG: Texto extraído (${extractedText.length} caracteres):`);
            console.log(`🔍 OCR DEBUG: ${extractedText.substring(0, 200)}`);
            
            return {
                success: true,
                rawText: extractedText,
                fullResponse: response.data
            };
        } catch (error) {
            console.error('❌ Error extracting text from image buffer:', error.message);
            if (error.response) {
                console.error('Azure Response Status:', error.response.status);
                console.error('Azure Response Data:', JSON.stringify(error.response.data).substring(0, 500));
            }
            if (error.code) {
                console.error('Error Code:', error.code);
            }
            throw new Error(`Failed to extract text from image: ${error.message}`);
        }
    }

    /**
     * Extract text from Azure OCR response
     * Más robusto para manejar respuestas parciales
     * @param {Object} ocrResponse - Response from Azure Computer Vision API
     * @returns {string} Concatenated text from all regions
     */
    extractTextFromResponse(ocrResponse) {
        if (!ocrResponse) {
            console.warn('🔍 OCR DEBUG: Response is null or undefined');
            return '';
        }

        console.log(`🔍 OCR DEBUG: ocrResponse tiene: ${JSON.stringify(ocrResponse).substring(0, 100)}`);

        const textLines = [];
        
        // Handle regions array
        if (Array.isArray(ocrResponse.regions)) {
            console.log(`🔍 OCR DEBUG: Procesando ${ocrResponse.regions.length} regiones`);
            
            ocrResponse.regions.forEach((region, rIdx) => {
                if (Array.isArray(region.lines)) {
                    console.log(`🔍 OCR DEBUG: Región ${rIdx}: ${region.lines.length} líneas`);
                    
                    region.lines.forEach(line => {
                        if (Array.isArray(line.words)) {
                            const lineText = line.words.map(w => w.text).join(' ');
                            if (lineText && lineText.trim()) {
                                textLines.push(lineText.trim());
                                console.log(`🔍 OCR DEBUG: Línea extraída: "${lineText.trim()}"`);
                            }
                        }
                    });
                }
            });
        } else {
            console.warn('🔍 OCR DEBUG: No regions array found in response');
            console.log(`🔍 OCR DEBUG: Response keys: ${Object.keys(ocrResponse)}`);
        }

        const result = textLines.join('\n');
        console.log(`🔍 OCR DEBUG: Total text lines: ${textLines.length}`);
        console.log(`🔍 OCR DEBUG: Total characters: ${result.length}`);
        
        return result;
    }

    /**
     * Parse OCR text to extract question and options
     * VERSIÓN MEJORADA: Retorna strings vacíos cuando no detecta datos
     * @param {string} ocrText - Raw OCR text
     * @returns {Object} Parsed question object with pregunta and opciones
     */
    parseQuestionFromText(ocrText) {
        if (typeof ocrText !== 'string') {
            return {
                pregunta: '',
                opciones: { a: '', b: '', c: '', d: '' },
                format: 'empty'
            };
        }

        // Handle empty or whitespace-only text
        if (!ocrText || ocrText.trim() === '') {
            return {
                pregunta: '',
                opciones: { a: '', b: '', c: '', d: '' },
                format: 'empty'
            };
        }

        const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line);
        
        if (lines.length === 0) {
            return {
                pregunta: '',
                opciones: { a: '', b: '', c: '', d: '' },
                format: 'empty'
            };
        }

        // STEP 1: Find where options start
        let optionStartIndex = -1;
        const optionPattern = /^([A-Da-d])[):.)\s]*(.*)$/;

        for (let i = 0; i < lines.length; i++) {
            if (optionPattern.test(lines[i])) {
                optionStartIndex = i;
                break;
            }
        }

        // STEP 2: Extract question (everything before first option)
        let pregunta = '';
        let questionLines = [];

        if (optionStartIndex > 0) {
            questionLines = lines.slice(0, optionStartIndex);
            pregunta = questionLines.join(' ').trim();
        } else {
            // No question found - return empty
            pregunta = '';
        }

        // STEP 3: Extract ALL options precisely
        const opciones = {
            a: '',
            b: '',
            c: '',
            d: ''
        };

        if (optionStartIndex >= 0) {
            const optionLines = lines.slice(optionStartIndex);
            const extractedOptions = this.extractAllOptions(optionLines);
            
            // Map to a, b, c, d
            extractedOptions.forEach((opt, idx) => {
                const key = String.fromCharCode(97 + idx); // a, b, c, d
                if (idx < 4) {
                    opciones[key] = opt.trim();
                }
            });
        }

        return {
            pregunta: pregunta.substring(0, 500),
            opciones: opciones
        };
    }

    /**
     * Extract ALL options from text lines
     * VERY PRECISE - handles various separators and formats
     * Supports: A) B) C) D), A: B: C: D:, a. b. c. d., etc.
     * @param {Array} lines - Array of text lines
     * @returns {Array} Array of option texts (a, b, c, d order)
     */
    extractAllOptions(lines) {
        const options = [];
        const optionPattern = /^([A-Da-d])[):.)\s]*(.*)$/;
        let lastOptionKey = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(optionPattern);

            if (match) {
                const currentKey = match[1].toUpperCase();
                // Ensure options are in order (A, B, C, D)
                const expectedKey = String.fromCharCode(65 + options.length); // A, B, C, D
                
                // Only accept if it matches expected order or is the first option
                if (options.length === 0 || currentKey === expectedKey) {
                    let optionText = match[2].trim();

                    // Continue reading next lines if they're part of this option
                    let nextIdx = i + 1;
                    while (nextIdx < lines.length) {
                        const nextLine = lines[nextIdx];
                        
                        // Stop if next line is a new option
                        if (optionPattern.test(nextLine)) {
                            break;
                        }

                        // If next line has content and doesn't look like an option, append it
                        if (nextLine && !optionPattern.test(nextLine)) {
                            optionText += ' ' + nextLine.trim();
                            nextIdx++;
                        } else {
                            break;
                        }
                    }

                    options.push(optionText);
                    lastOptionKey = currentKey;

                    // Skip lines we already processed
                    i = nextIdx - 1;

                    // Stop after finding 4 options
                    if (options.length >= 4) {
                        break;
                    }
                }
            }
        }

        // Return exactly 4 options (even if some are empty)
        while (options.length < 4) {
            options.push('');
        }

        return options.slice(0, 4);
    }

    /**
     * Improve image quality for better OCR recognition
     * Applies contrast, sharpness, and other enhancements
     * @param {Buffer} imageBuffer - Original image buffer
     * @returns {Promise<Buffer>} Enhanced image buffer
     */
    async enhanceImageForOCR(imageBuffer) {
        try {
            console.log(`🖼️ IMAGE ENHANCEMENT: Mejorando imagen para OCR...`);
            
            // Get image dimensions first
            const dims = await this.getImageDimensions(imageBuffer);
            const targetWidth = Math.max(600, Math.min(2048, dims.width || 600));
            
            // Enhance image with sharp
            const enhanced = await sharp(imageBuffer)
                // Increase contrast for better text recognition
                .modulate({ brightness: 1.05, contrast: 1.3, saturation: 1.1 })
                // Sharpen the image to improve text clarity
                .sharpen({ sigma: 1.5 })
                // Normalize the image (stretch histogram)
                .normalize()
                // Convert to JPEG with high quality
                .jpeg({ quality: 95, progressive: true })
                // Get buffer
                .toBuffer();
            
            console.log(`✅ IMAGE ENHANCEMENT: Imagen mejorada exitosamente`);
            console.log(`   Tamaño original: ${imageBuffer.length} bytes`);
            console.log(`   Tamaño mejorado: ${enhanced.length} bytes`);
            
            return enhanced;
        } catch (error) {
            console.warn(`⚠️ IMAGE ENHANCEMENT: No se pudo mejorar la imagen: ${error.message}`);
            // Return original image if enhancement fails
            return imageBuffer;
        }
    }

    /**
     * Get image dimensions
     * @param {Buffer} imageBuffer - Image buffer
     * @returns {Promise<Object>} Image metadata with width and height
     */
    async getImageDimensions(imageBuffer) {
        try {
            const metadata = await sharp(imageBuffer).metadata();
            return {
                width: metadata.width || 600,
                height: metadata.height || 800
            };
        } catch (error) {
            console.warn(`⚠️ Could not get image dimensions: ${error.message}`);
            return { width: 600, height: 800 };
        }
    }
}

module.exports = new AzureOCRService();
