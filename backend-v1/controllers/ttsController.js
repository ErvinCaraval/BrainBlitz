const azureTTSService = require('../services/azureTTSService');

class TTSController {
    async synthesize(req, res) {
        try {
            const { text, options = {} } = req.body;
            
            // Validación exhaustiva del texto
            if (!text) {
                return res.status(400).json({ 
                    error: 'Text is required',
                    details: 'The text parameter cannot be empty'
                });
            }

            if (typeof text !== 'string') {
                return res.status(400).json({
                    error: 'Invalid text format',
                    details: 'Text must be a string'
                });
            }

            if (text.length > 5000) {
                return res.status(400).json({
                    error: 'Text too long',
                    details: 'Text length exceeds maximum limit of 5000 characters'
                });
            }

            const audioBuffer = await azureTTSService.synthesizeSpeech(text, options);
            
            // Send the audio buffer as response
            res.set({
                'Content-Type': 'audio/mp3',
                'Content-Length': audioBuffer.length,
                'Cache-Control': 'no-cache',
                'X-Content-Type-Options': 'nosniff'
            });
            
            res.send(audioBuffer);
        } catch (error) {
            console.error('TTS Error:', error);
            
            if (error.message.includes('credentials')) {
                return res.status(500).json({
                    error: 'Azure configuration error',
                    details: 'TTS service is not properly configured'
                });
            }
            
            if (error.name === 'SynthesisError') {
                return res.status(400).json({
                    error: 'Synthesis failed',
                    details: error.message
                });
            }

            res.status(500).json({
                error: 'Failed to synthesize speech',
                details: error.message
            });
        }
    }

    async getVoices(req, res) {
        try {
            const voices = await azureTTSService.getAvailableVoices();
            
            if (!Array.isArray(voices)) {
                throw new Error('Invalid voices data received');
            }

            // Agrupar voces por idioma
            const voicesByLocale = voices.reduce((acc, voice) => {
                if (!acc[voice.locale]) {
                    acc[voice.locale] = [];
                }
                acc[voice.locale].push(voice);
                return acc;
            }, {});

            // Enviar respuesta
            res.json(voices);

        } catch (error) {
            console.error('Error getting voices:', error);
            res.status(500).json({ 
                error: 'Failed to get available voices',
                details: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = new TTSController();