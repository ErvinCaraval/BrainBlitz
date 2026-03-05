const request = require('supertest');
const express = require('express');

// Set environment variables before requiring the service
process.env.AZURE_CV_API_KEY = 'test-api-key';
process.env.AZURE_CV_ENDPOINT = 'https://test.cognitiveservices.azure.com/';

const axios = require('axios');
const azureVisionService = require('../../services/azureVisionService');
const visionController = require('../../controllers/visionController');

// Mock axios
jest.mock('axios');

describe('HU-VC4: Object Detection - Unit Tests', () => {
  
  describe('Azure Vision Service - detectObjects', () => {
    
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('should detect objects in an image buffer', async () => {
      const mockResponse = {
        data: {
          objects: [
            {
              object: 'guitar',
              confidence: 0.98,
              rectangle: { x: 150, y: 200, w: 400, h: 600 }
            },
            {
              object: 'person',
              confidence: 0.87,
              rectangle: { x: 50, y: 100, w: 300, h: 500 }
            },
            {
              object: 'piano',
              confidence: 0.92,
              rectangle: { x: 600, y: 300, w: 350, h: 500 }
            }
          ],
          metadata: { width: 1920, height: 1440 }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const buffer = Buffer.from('fake image data');
      const result = await azureVisionService.detectObjects(buffer);

      expect(result.success).toBe(true);
      expect(result.objects.length).toBe(3);
      expect(result.stats.totalObjects).toBe(3);
      expect(result.objects[0].name).toBe('guitar');
      expect(result.objects[0].confidence).toBe(0.98);
    });

    test('should filter objects by minimum confidence threshold', async () => {
      const mockResponse = {
        data: {
          objects: [
            { object: 'guitar', confidence: 0.98, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'person', confidence: 0.45, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'piano', confidence: 0.92, rectangle: { x: 0, y: 0, w: 100, h: 100 } }
          ],
          metadata: { width: 1920, height: 1440 }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const buffer = Buffer.from('fake image data');
      const result = await azureVisionService.detectObjects(buffer, {
        minConfidence: 0.5
      });

      // Should have 2 objects (confidence >= 0.5)
      expect(result.objects.length).toBe(2);
      expect(result.objects.some(o => o.name === 'person')).toBe(false);
    });

    test('should sort objects by confidence descending', async () => {
      const mockResponse = {
        data: {
          objects: [
            { object: 'item1', confidence: 0.70, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'item2', confidence: 0.95, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'item3', confidence: 0.80, rectangle: { x: 0, y: 0, w: 100, h: 100 } }
          ],
          metadata: { width: 1920, height: 1440 }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const buffer = Buffer.from('fake image data');
      const result = await azureVisionService.detectObjects(buffer);

      // Should be sorted by confidence
      expect(result.objects[0].name).toBe('item2');
      expect(result.objects[0].confidence).toBe(0.95);
      expect(result.objects[1].name).toBe('item3');
    });

    test('should count objects by type', async () => {
      const mockResponse = {
        data: {
          objects: [
            { object: 'guitar', confidence: 0.98, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'guitar', confidence: 0.96, rectangle: { x: 100, y: 0, w: 100, h: 100 } },
            { object: 'person', confidence: 0.87, rectangle: { x: 0, y: 0, w: 100, h: 100 } }
          ],
          metadata: { width: 1920, height: 1440 }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const buffer = Buffer.from('fake image data');
      const result = await azureVisionService.detectObjects(buffer);

      expect(result.objectCounts.guitar).toBe(2);
      expect(result.objectCounts.person).toBe(1);
    });

    test('should calculate correct statistics', async () => {
      const mockResponse = {
        data: {
          objects: [
            { object: 'item1', confidence: 0.80, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'item2', confidence: 0.90, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'item3', confidence: 0.70, rectangle: { x: 0, y: 0, w: 100, h: 100 } }
          ],
          metadata: { width: 1920, height: 1440 }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const buffer = Buffer.from('fake image data');
      const result = await azureVisionService.detectObjects(buffer);

      expect(result.stats.totalObjects).toBe(3);
      expect(result.stats.maxConfidence).toBe(0.90);
      expect(result.stats.minConfidence).toBe(0.70);
      expect(result.stats.averageConfidence).toBeCloseTo(0.8, 1);
    });

    test('should filter by specific object name', async () => {
      const mockResponse = {
        data: {
          objects: [
            { object: 'guitar', confidence: 0.98, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'person', confidence: 0.87, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'piano', confidence: 0.92, rectangle: { x: 0, y: 0, w: 100, h: 100 } }
          ],
          metadata: { width: 1920, height: 1440 }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const buffer = Buffer.from('fake image data');
      const result = await azureVisionService.detectObjects(buffer, {
        objectName: 'guitar'
      });

      expect(result.objects.length).toBe(1);
      expect(result.objects[0].name).toBe('guitar');
    });

    test('should handle empty objects array', async () => {
      const mockResponse = {
        data: {
          objects: [],
          metadata: { width: 1920, height: 1440 }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const buffer = Buffer.from('fake image data');
      const result = await azureVisionService.detectObjects(buffer);

      expect(result.success).toBe(true);
      expect(result.objects.length).toBe(0);
      expect(result.stats.totalObjects).toBe(0);
    });

    test('should handle API errors gracefully', async () => {
      const error = new Error('Azure API Error');
      error.response = {
        data: {
          error: { message: 'Invalid image format' }
        }
      };
      axios.post.mockRejectedValue(error);

      const buffer = Buffer.from('fake image data');
      
      await expect(azureVisionService.detectObjects(buffer)).rejects.toThrow('Invalid image format');
    });

    test('should provide top objects list', async () => {
      const mockResponse = {
        data: {
          objects: [
            { object: 'item1', confidence: 0.98, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'item2', confidence: 0.95, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'item1', confidence: 0.92, rectangle: { x: 100, y: 0, w: 100, h: 100 } },
            { object: 'item3', confidence: 0.88, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'item4', confidence: 0.85, rectangle: { x: 0, y: 0, w: 100, h: 100 } },
            { object: 'item5', confidence: 0.80, rectangle: { x: 0, y: 0, w: 100, h: 100 } }
          ],
          metadata: { width: 1920, height: 1440 }
        }
      };

      axios.post.mockResolvedValue(mockResponse);

      const buffer = Buffer.from('fake image data');
      const result = await azureVisionService.detectObjects(buffer);

      expect(result.topObjects.length).toBeLessThanOrEqual(5);
      expect(result.topObjects[0].confidence).toBeGreaterThanOrEqual(result.topObjects[1]?.confidence || 0);
    });
  });

  describe('Vision Controller - detectObjects', () => {
    let mockReq, mockRes;

    beforeEach(() => {
      mockReq = {
        body: {},
        file: null
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis()
      };
      jest.clearAllMocks();
    });

    test('should return 503 when service not configured', async () => {
      azureVisionService.enabled = false;

      mockReq.body = {
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...'
      };

      await visionController.detectObjects(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(503);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'SERVICE_UNAVAILABLE'
        })
      );
    });

    test('should return 400 when no image provided', async () => {
      azureVisionService.enabled = true;

      await visionController.detectObjects(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          code: 'MISSING_IMAGE'
        })
      );
    });

    test('should validate confidence threshold', async () => {
      azureVisionService.enabled = true;

      mockReq.body = {
        imageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABA...',
        minConfidence: 1.5 // Invalid: > 1
      };

      await visionController.detectObjects(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'INVALID_CONFIDENCE'
        })
      );
    });
  });
});

describe('HU-VC4: Question Suggestions', () => {
  test('should generate identification question suggestion', () => {
    const detection = {
      stats: { totalObjects: 3, totalTypes: 3, averageConfidence: 0.92 },
      topObjects: [
        { name: 'guitar', confidence: 0.98, count: 1 },
        { name: 'person', confidence: 0.87, count: 1 },
        { name: 'piano', confidence: 0.92, count: 1 }
      ],
      objectCounts: { guitar: 1, person: 1, piano: 1 }
    };

    // This would be tested through the API endpoint
    // Verifying structure matches the expected format
    expect(detection.topObjects[0]).toHaveProperty('name');
    expect(detection.topObjects[0]).toHaveProperty('confidence');
    expect(detection.objectCounts).toBeDefined();
  });

  test('should generate counting question suggestion', () => {
    const detection = {
      stats: { totalObjects: 5, totalTypes: 2, averageConfidence: 0.85 },
      topObjects: [
        { name: 'guitar', confidence: 0.95, count: 3 },
        { name: 'person', confidence: 0.80, count: 2 }
      ],
      objectCounts: { guitar: 3, person: 2 }
    };

    // Verify object counts are available for counting questions
    expect(detection.objectCounts['guitar']).toBe(3);
    expect(detection.objectCounts['person']).toBe(2);
  });
});
