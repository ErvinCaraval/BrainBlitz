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

jest.mock('axios', () => ({
  get: jest.fn()
}));

describe('🖼️  visionController - Computer Vision Functionality Tests', () => {
  
  describe('✅ analyzeImage - Análisis de Imágenes', () => {
    let req;
    let res;

    beforeEach(() => {
      req = { 
        body: {},
        file: undefined
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      azureVisionService.enabled = true;
      azureVisionService.analyzeImage.mockReset();
      jest.clearAllMocks();
    });

    it('should return 400 when no image data is provided', async () => {
      await visionController.analyzeImage(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Provide image')
      }));
    });

    it('should return 503 when Azure service is disabled', async () => {
      req.body = { imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' };
      azureVisionService.enabled = false;
      await visionController.analyzeImage(req, res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: 'Azure Computer Vision service is not configured'
      }));
    });

    it('should return 500 on invalid base64 payload', async () => {
      req.body = { imageBase64: 'invalid-base64!!!@#$%' };
      await visionController.analyzeImage(req, res);
      // Invalid base64 throws an error during parsing, resulting in 500 status
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.any(String)
      }));
    });

    it('should parse base64 image with data URI prefix', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = {
        imageBase64: `data:image/png;base64,${testImageBase64}`
      };

      const mockAnalysis = {
        description: {
          primary: { text: 'Un gato en la sala', confidence: 0.92 },
          captions: []
        },
        tags: [{ name: 'cat', confidence: 0.95 }],
        categories: [{ name: 'animal_cat', confidence: 0.8 }],
        objects: [{ name: 'cat', confidence: 0.9, rectangle: null }],
        color: { dominantColors: ['Gray'] },
        metadata: { width: 640, height: 480, format: 'png' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);
      
      await visionController.analyzeImage(req, res);

      expect(azureVisionService.analyzeImage).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        analysis: expect.any(Object),
        questionSuggestions: expect.any(Object),
        processedAt: expect.any(String),
        language: 'es'
      }));
    });

    it('should parse base64 image without data URI prefix', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = {
        imageBase64: testImageBase64
      };

      const mockAnalysis = {
        description: {
          primary: { text: 'Imagen de prueba', confidence: 0.85 },
          captions: []
        },
        tags: [{ name: 'test', confidence: 0.8 }],
        categories: [{ name: 'test_category', confidence: 0.7 }],
        objects: [],
        color: { dominantColors: ['Blue'] },
        metadata: { width: 1920, height: 1080, format: 'png' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);
      
      await visionController.analyzeImage(req, res);

      expect(res.status).not.toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        analysis: expect.objectContaining({
          description: mockAnalysis.description,
          tags: mockAnalysis.tags,
          categories: mockAnalysis.categories,
          objects: mockAnalysis.objects,
          colors: mockAnalysis.color,
          metadata: mockAnalysis.metadata
        })
      }));
    });

    it('should handle file upload with buffer', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      req.file = {
        buffer: imageBuffer,
        mimetype: 'image/jpeg'
      };

      const mockAnalysis = {
        description: {
          primary: { text: 'Imagen subida', confidence: 0.90 },
          captions: []
        },
        tags: [{ name: 'uploaded', confidence: 0.85 }],
        categories: [],
        objects: [],
        color: { dominantColors: ['Red'] },
        metadata: { width: 800, height: 600, format: 'jpeg' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      await visionController.analyzeImage(req, res);

      expect(azureVisionService.analyzeImage).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should include objectSummary in response', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = { imageBase64: testImageBase64 };

      const mockAnalysis = {
        description: {
          primary: { text: 'Múltiples objetos', confidence: 0.88 },
          captions: []
        },
        tags: [{ name: 'cat', confidence: 0.95 }],
        categories: [],
        objects: [
          { name: 'cat', confidence: 0.92 },
          { name: 'cat', confidence: 0.88 },
          { name: 'sofa', confidence: 0.85 }
        ],
        color: { dominantColors: ['Brown'] },
        metadata: { width: 1024, height: 768, format: 'png' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      await visionController.analyzeImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        analysis: expect.objectContaining({
          objectSummary: expect.any(Array)
        })
      }));
    });

    it('should use custom language parameter', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = {
        imageBase64: testImageBase64,
        language: 'en'
      };

      const mockAnalysis = {
        description: {
          primary: { text: 'A cat in the room', confidence: 0.92 },
          captions: []
        },
        tags: [{ name: 'cat', confidence: 0.95 }],
        categories: [],
        objects: [],
        color: { dominantColors: ['Gray'] },
        metadata: { width: 640, height: 480, format: 'png' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      await visionController.analyzeImage(req, res);

      expect(azureVisionService.analyzeImage).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ language: 'en' })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        language: 'en'
      }));
    });

    it('should return empty array when no objects detected', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = { imageBase64: testImageBase64 };

      const mockAnalysis = {
        description: {
          primary: { text: 'Imagen simple', confidence: 0.75 },
          captions: []
        },
        tags: [],
        categories: [],
        objects: [],
        color: { dominantColors: ['White'] },
        metadata: { width: 320, height: 240, format: 'png' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      await visionController.analyzeImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        analysis: expect.objectContaining({
          objects: []
        })
      }));
    });

    it('should handle Azure service errors gracefully', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = { imageBase64: testImageBase64 };

      azureVisionService.analyzeImage.mockRejectedValue(
        new Error('Azure service timeout')
      );

      await visionController.analyzeImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.stringContaining('Azure service timeout')
      }));
    });

    it('should validate image MIME type', async () => {
      req.body = { 
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        mimeType: 'image/jpeg'
      };

      const mockAnalysis = {
        description: {
          primary: { text: 'Test', confidence: 0.8 },
          captions: []
        },
        tags: [],
        categories: [],
        objects: [],
        color: { dominantColors: [] },
        metadata: { width: 100, height: 100, format: 'jpeg' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      await visionController.analyzeImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should throw error when null analysis is returned', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = { imageBase64: testImageBase64 };

      azureVisionService.analyzeImage.mockResolvedValue(null);

      await visionController.analyzeImage(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        error: expect.any(String)
      }));
    });
  });

  describe('🎯 detectObjects - Detección de Objetos', () => {
    let req;
    let res;

    beforeEach(() => {
      req = {
        body: {},
        file: undefined
      };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      azureVisionService.enabled = true;
      azureVisionService.detectObjects.mockReset();
      jest.clearAllMocks();
    });

    it('should return 400 when no image data is provided', async () => {
      await visionController.detectObjects(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'MISSING_IMAGE'
      }));
    });

    it('should return 503 when Azure service is disabled', async () => {
      req.body = { 
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' 
      };
      azureVisionService.enabled = false;
      await visionController.detectObjects(req, res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'SERVICE_UNAVAILABLE'
      }));
    });

    it('should detect objects from base64 image', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = {
        imageBase64: testImageBase64,
        minConfidence: 0.5
      };

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

      await visionController.detectObjects(req, res);

      expect(azureVisionService.detectObjects).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        detection: expect.objectContaining({
          topObjects: mockDetection.topObjects,
          objectCounts: mockDetection.objectCounts
        }),
        questionSuggestions: expect.any(Object),
        cost: expect.any(Object),
        processedAt: expect.any(String)
      }));
    });

    it('should validate minConfidence parameter', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = {
        imageBase64: testImageBase64,
        minConfidence: 1.5 // Invalid - greater than 1
      };

      await visionController.detectObjects(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'INVALID_CONFIDENCE'
      }));
    });

    it('should validate negative minConfidence', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        minConfidence: -0.5
      };

      await visionController.detectObjects(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        code: 'INVALID_CONFIDENCE'
      }));
    });

    it('should use default minConfidence of 0.5', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

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

      await visionController.detectObjects(req, res);

      expect(azureVisionService.detectObjects).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ minConfidence: 0.5 })
      );
    });

    it('should filter objects by objectName parameter', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        objectName: 'cat'
      };

      const mockDetection = {
        topObjects: [{ name: 'cat', confidence: 0.95, count: 2 }],
        objectCounts: { cat: 2 },
        stats: {
          totalObjects: 2,
          totalTypes: 1,
          averageConfidence: 0.95,
          maxConfidence: 0.95,
          minConfidence: 0.95
        }
      };

      azureVisionService.detectObjects.mockResolvedValue(mockDetection);

      await visionController.detectObjects(req, res);

      expect(azureVisionService.detectObjects).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ objectName: 'cat' })
      );
    });

    it('should include objectSummary in detection response', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

      const mockDetection = {
        topObjects: [
          { name: 'cat', confidence: 0.95, count: 2 }
        ],
        objectCounts: { cat: 2 },
        stats: {
          totalObjects: 2,
          totalTypes: 1,
          averageConfidence: 0.95,
          maxConfidence: 0.95,
          minConfidence: 0.95
        }
      };

      azureVisionService.detectObjects.mockResolvedValue(mockDetection);

      await visionController.detectObjects(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        detection: expect.objectContaining({
          objectSummary: expect.any(Object)
        })
      }));
    });

    it('should generate question suggestions with exactly 4 options', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

      const mockDetection = {
        topObjects: [
          { name: 'cat', confidence: 0.95, count: 2 },
          { name: 'dog', confidence: 0.88, count: 1 },
          { name: 'sofa', confidence: 0.82, count: 1 }
        ],
        objectCounts: { cat: 2, dog: 1, sofa: 1 },
        stats: {
          totalObjects: 4,
          totalTypes: 3,
          averageConfidence: 0.883,
          maxConfidence: 0.95,
          minConfidence: 0.82
        }
      };

      azureVisionService.detectObjects.mockResolvedValue(mockDetection);

      await visionController.detectObjects(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        questionSuggestions: expect.objectContaining({
          identification: expect.objectContaining({
            options: expect.arrayContaining([
              expect.any(Object)
            ]),
            type: 'identification'
          }),
          counting: expect.objectContaining({
            type: 'counting',
            options: expect.any(Array)
          }),
          multipleChoice: expect.objectContaining({
            type: 'multipleChoice',
            options: expect.any(Array)
          })
        })
      }));
    });

    it('should handle null/empty detection results', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

      azureVisionService.detectObjects.mockResolvedValue(null);

      await visionController.detectObjects(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'DETECTION_ERROR'
      }));
    });

    it('should handle Azure service errors', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

      azureVisionService.detectObjects.mockRejectedValue(
        new Error('Azure timeout')
      );

      await visionController.detectObjects(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false,
        code: 'DETECTION_ERROR'
      }));
    });

    it('should include cost information in response', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      };

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

      await visionController.detectObjects(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        cost: expect.objectContaining({
          usd: expect.any(Number),
          note: expect.any(String)
        })
      }));
    });

    it('should handle file upload for object detection', async () => {
      const imageBuffer = Buffer.from('fake-image-data');
      req.file = {
        buffer: imageBuffer,
        mimetype: 'image/png'
      };

      const mockDetection = {
        topObjects: [{ name: 'object', confidence: 0.85, count: 1 }],
        objectCounts: { object: 1 },
        stats: {
          totalObjects: 1,
          totalTypes: 1,
          averageConfidence: 0.85,
          maxConfidence: 0.85,
          minConfidence: 0.85
        }
      };

      azureVisionService.detectObjects.mockResolvedValue(mockDetection);

      await visionController.detectObjects(req, res);

      expect(azureVisionService.detectObjects).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });

    it('should use custom language for object detection', async () => {
      req.body = {
        imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        language: 'fr'
      };

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

      await visionController.detectObjects(req, res);

      expect(azureVisionService.detectObjects).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({ language: 'fr' })
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        language: 'fr'
      }));
    });
  });

  describe('🛠️  Helper Functions and Utilities', () => {
    let req;
    let res;

    beforeEach(() => {
      req = { body: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      azureVisionService.enabled = true;
      jest.clearAllMocks();
    });

    it('should build question suggestions from analysis', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = { imageBase64: testImageBase64 };

      const mockAnalysis = {
        description: {
          primary: { text: 'Un gato durmiendo', confidence: 0.92 },
          captions: []
        },
        tags: [
          { name: 'cat', confidence: 0.95 },
          { name: 'sleeping', confidence: 0.88 }
        ],
        categories: [{ name: 'animal_cat', confidence: 0.8 }],
        objects: [
          { name: 'cat', confidence: 0.9, rectangle: null }
        ],
        color: { dominantColors: ['Gray'] },
        metadata: { width: 640, height: 480, format: 'png' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      await visionController.analyzeImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        questionSuggestions: expect.objectContaining({
          question: expect.any(String),
          descriptionContext: 'Un gato durmiendo',
          categorySuggestion: 'animal_cat',
          options: expect.any(Array),
          suggestedAnswer: expect.any(String),
          confidence: 0.92
        })
      }));
    });

    it('should summarize duplicate objects correctly', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = { imageBase64: testImageBase64 };

      const mockAnalysis = {
        description: {
          primary: { text: 'Múltiples gatos', confidence: 0.88 },
          captions: []
        },
        tags: [],
        categories: [],
        objects: [
          { name: 'cat', confidence: 0.95 },
          { name: 'cat', confidence: 0.92 },
          { name: 'cat', confidence: 0.88 },
          { name: 'sofa', confidence: 0.85 }
        ],
        color: { dominantColors: ['Brown'] },
        metadata: { width: 800, height: 600, format: 'jpeg' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      await visionController.analyzeImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        analysis: expect.objectContaining({
          objectSummary: expect.arrayContaining([
            expect.objectContaining({ name: 'cat', count: 3 }),
            expect.objectContaining({ name: 'sofa', count: 1 })
          ])
        })
      }));
    });

    it('should include timestamp in response', async () => {
      const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      req.body = { imageBase64: testImageBase64 };

      const mockAnalysis = {
        description: {
          primary: { text: 'Test', confidence: 0.8 },
          captions: []
        },
        tags: [],
        categories: [],
        objects: [],
        color: { dominantColors: [] },
        metadata: { width: 100, height: 100, format: 'png' }
      };

      azureVisionService.analyzeImage.mockResolvedValue(mockAnalysis);

      await visionController.analyzeImage(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        processedAt: expect.stringMatching(/\d{4}-\d{2}-\d{2}T/)
      }));
    });
  });
});

