const request = require('supertest');
const express = require('express');
const visionController = require('../../controllers/visionController');
const azureVisionService = require('../../services/azureVisionService');

jest.mock('../../services/azureVisionService', () => ({
  analyzeImage: jest.fn(),
  detectObjects: jest.fn(),
  enabled: true
}));

jest.mock('../../utils/validators', () => ({
  validateFileSize: jest.fn(() => ({ valid: true })),
  validateMimeType: jest.fn(() => ({ valid: true }))
}));

const app = express();
app.use(express.json({ limit: '5mb' }));
app.post('/api/vision/analyze-image', (req, res) => visionController.analyzeImage(req, res));
app.post('/api/vision/detect-objects', (req, res) => visionController.detectObjects(req, res));

describe('🖼️  Vision Computer Vision Endpoints - Integration Tests', () => {
  
  describe('POST /api/vision/analyze-image - Image Analysis Endpoint', () => {
    beforeEach(() => {
      azureVisionService.enabled = true;
      azureVisionService.analyzeImage.mockReset();
      azureVisionService.detectObjects.mockReset();
    });

    it('responds with 400 when payload is empty', async () => {
      const response = await request(app)
        .post('/api/vision/analyze-image')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('responds with analysis data when payload is valid', async () => {
      const sampleBuffer = Buffer.from('analyze-image');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      azureVisionService.analyzeImage.mockResolvedValue({
        description: { primary: { text: 'Un paisaje', confidence: 0.9 }, captions: [], tags: ['paisaje'] },
        tags: [{ name: 'landscape', confidence: 0.93 }],
        categories: [{ name: 'outdoor_mountain', confidence: 0.88 }],
        objects: [{ name: 'mountain', confidence: 0.9, rectangle: null }],
        color: { dominantColors: ['Blue'] },
        metadata: { width: 800, height: 600, format: 'jpeg' }
      });

      const response = await request(app)
        .post('/api/vision/analyze-image')
        .send({ imageBase64: base64 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.analysis).toHaveProperty('description');
      expect(response.body).toHaveProperty('questionSuggestions');
    });

    it('responds with 503 when Azure service is disabled', async () => {
      azureVisionService.enabled = false;
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/png;base64,${sampleBuffer.toString('base64')}`;

      const response = await request(app)
        .post('/api/vision/analyze-image')
        .send({ imageBase64: base64 });

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
    });

    it('should include language parameter in request', async () => {
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      const mockAnalysis = {
        description: { primary: { text: 'Test image', confidence: 0.85 }, captions: [] },
        tags: [],
        categories: [],
        objects: [],
        color: { dominantColors: [] },
        metadata: { width: 100, height: 100, format: 'jpeg' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/vision/analyze-image')
        .send({ imageBase64: base64, language: 'en' });

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('en');
      expect(azureVisionService.analyzeImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ language: 'en' })
      );
    });

    it('should return structured analysis with all required fields', async () => {
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      const mockAnalysis = {
        description: {
          primary: { text: 'A dog with a ball', confidence: 0.92 },
          captions: []
        },
        tags: [
          { name: 'dog', confidence: 0.98 },
          { name: 'pet', confidence: 0.95 },
          { name: 'ball', confidence: 0.88 }
        ],
        categories: [
          { name: 'animal_dog', confidence: 0.96 }
        ],
        objects: [
          { name: 'dog', confidence: 0.95, rectangle: { x: 50, y: 50, w: 200, h: 200 } },
          { name: 'ball', confidence: 0.87, rectangle: { x: 250, y: 100, w: 50, h: 50 } }
        ],
        color: { dominantColors: ['Brown', 'Yellow'] },
        metadata: { width: 640, height: 480, format: 'jpeg' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/vision/analyze-image')
        .send({ imageBase64: base64 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        analysis: {
          description: mockAnalysis.description,
          tags: mockAnalysis.tags,
          categories: mockAnalysis.categories,
          objects: mockAnalysis.objects,
          colors: mockAnalysis.color,
          metadata: mockAnalysis.metadata
        },
        questionSuggestions: {
          question: expect.any(String),
          descriptionContext: expect.any(String),
          options: expect.any(Array),
          suggestedAnswer: expect.any(String),
          confidence: expect.any(Number)
        },
        processedAt: expect.any(String),
        language: 'es'
      });
    });

    it('should handle concurrent requests properly', async () => {
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      const mockAnalysis = {
        description: { primary: { text: 'Test', confidence: 0.8 }, captions: [] },
        tags: [],
        categories: [],
        objects: [],
        color: { dominantColors: [] },
        metadata: { width: 100, height: 100, format: 'jpeg' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      // Realizar 3 requests concurrentes
      const responses = await Promise.all([
        request(app).post('/api/vision/analyze-image').send({ imageBase64: base64 }),
        request(app).post('/api/vision/analyze-image').send({ imageBase64: base64 }),
        request(app).post('/api/vision/analyze-image').send({ imageBase64: base64 })
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('should handle Azure service errors gracefully', async () => {
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      azureVisionService.analyzeImage.mockRejectedValue(
        new Error('Azure service unavailable')
      );

      const response = await request(app)
        .post('/api/vision/analyze-image')
        .send({ imageBase64: base64 });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/vision/detect-objects - Object Detection Endpoint', () => {
    beforeEach(() => {
      azureVisionService.enabled = true;
      azureVisionService.detectObjects.mockReset();
    });

    it('responds with 400 when no image is provided', async () => {
      const response = await request(app)
        .post('/api/vision/detect-objects')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_IMAGE');
    });

    it('detects objects and returns structured data', async () => {
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      const mockDetection = {
        topObjects: [
          { name: 'cat', confidence: 0.95, count: 2 },
          { name: 'sofa', confidence: 0.88, count: 1 }
        ],
        objectCounts: { cat: 2, sofa: 1 },
        stats: {
          totalObjects: 3,
          totalTypes: 2,
          averageConfidence: 0.915,
          maxConfidence: 0.95,
          minConfidence: 0.88
        }
      };

      azureVisionService.detectObjects.mockResolvedValue(mockDetection);

      const response = await request(app)
        .post('/api/vision/detect-objects')
        .send({ imageBase64: base64, minConfidence: 0.5 });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        detection: {
          topObjects: expect.any(Array),
          objectCounts: expect.any(Object)
        },
        questionSuggestions: {
          identification: expect.any(Object),
          counting: expect.any(Object),
          multipleChoice: expect.any(Object),
          metadata: expect.any(Object)
        },
        cost: {
          usd: 0.0005,
          note: expect.any(String)
        }
      });
    });

    it('validates confidence threshold', async () => {
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      const response = await request(app)
        .post('/api/vision/detect-objects')
        .send({ imageBase64: base64, minConfidence: 1.5 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CONFIDENCE');
    });

    it('generates exactly 4 options for each question type', async () => {
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      const mockDetection = {
        topObjects: [
          { name: 'cat', confidence: 0.95, count: 2 },
          { name: 'dog', confidence: 0.88, count: 1 },
          { name: 'bird', confidence: 0.82, count: 1 }
        ],
        objectCounts: { cat: 2, dog: 1, bird: 1 },
        stats: {
          totalObjects: 4,
          totalTypes: 3,
          averageConfidence: 0.883,
          maxConfidence: 0.95,
          minConfidence: 0.82
        }
      };

      azureVisionService.detectObjects.mockResolvedValue(mockDetection);

      const response = await request(app)
        .post('/api/vision/detect-objects')
        .send({ imageBase64: base64 });

      expect(response.status).toBe(200);
      
      const suggestions = response.body.questionSuggestions;
      expect(suggestions.identification.options).toHaveLength(4);
      expect(suggestions.counting.options).toHaveLength(4);
      expect(suggestions.multipleChoice.options).toHaveLength(4);
    });

    it('supports multiple languages', async () => {
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      const mockDetection = {
        topObjects: [],
        objectCounts: {},
        stats: {
          totalObjects: 0,
          totalTypes: 0,
          averageConfidence: 0,
          maxConfidence: 0,
          minConfidence: 0
        }
      };

      azureVisionService.detectObjects.mockResolvedValue(mockDetection);

      const response = await request(app)
        .post('/api/vision/detect-objects')
        .send({ imageBase64: base64, language: 'fr' });

      expect(response.status).toBe(200);
      expect(response.body.language).toBe('fr');
    });

    it('responds with 503 when Azure service is disabled', async () => {
      azureVisionService.enabled = false;
      const sampleBuffer = Buffer.from('test');
      const base64 = `data:image/jpeg;base64,${sampleBuffer.toString('base64')}`;

      const response = await request(app)
        .post('/api/vision/detect-objects')
        .send({ imageBase64: base64 });

      expect(response.status).toBe(503);
      expect(response.body.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
});

