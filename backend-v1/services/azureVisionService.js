const axios = require('axios');

const DEFAULT_VISUAL_FEATURES = ['Description', 'Tags', 'Categories', 'Objects', 'Color'];

class AzureVisionService {
  constructor() {
    const apiKey = process.env.AZURE_CV_API_KEY;
    const endpoint = process.env.AZURE_CV_ENDPOINT;

    if (!apiKey || !endpoint) {
      console.warn('⚠️  Azure Computer Vision credentials not configured - Analyze Image service disabled');
      this.enabled = false;
      return;
    }

    this.enabled = true;
    this.apiKey = apiKey;
    this.endpoint = endpoint.endsWith('/') ? endpoint : `${endpoint}/`;
    this.analyzeUrl = `${this.endpoint}vision/v3.2/analyze`;

    console.log('✅ Azure Computer Vision Analyze service initialized');
  }

  /**
   * Calls Azure Computer Vision Analyze endpoint
   * @param {Buffer} imageBuffer
   * @param {object} options
   * @returns {Promise<object>}
   */
  async analyzeImage(imageBuffer, options = {}) {
    if (!this.enabled) {
      throw new Error('Azure Computer Vision Analyze service is not configured');
    }

    if (!Buffer.isBuffer(imageBuffer)) {
      throw new Error('Invalid image buffer');
    }

    const visualFeatures = options.visualFeatures || DEFAULT_VISUAL_FEATURES;
    const language = options.language || 'es';
    const details = options.details || []; // e.g., ['Landmarks', 'Celebrities']

    const params = new URLSearchParams({
      visualFeatures: visualFeatures.join(','),
      language
    });

    if (details.length) {
      params.append('details', details.join(','));
    }

    try {
      const response = await axios.post(
        `${this.analyzeUrl}?${params.toString()}`,
        imageBuffer,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'Content-Type': 'application/octet-stream'
          },
          timeout: options.timeout || 45000
        }
      );

      return this.normalizeResponse(response.data);
    } catch (error) {
      console.error('❌ Error calling Azure Analyze Image:', error.message);
      if (error.response) {
        console.error('Azure response data:', error.response.data);
      }
      throw new Error(error.response?.data?.error?.message || 'Azure Analyze request failed');
    }
  }

  /**
   * Detects objects in an image - HU-VC4 Specific
   * @param {Buffer} imageBuffer
   * @param {object} options
   * @returns {Promise<object>}
   */
  async detectObjects(imageBuffer, options = {}) {
    if (!this.enabled) {
      throw new Error('Azure Computer Vision service is not configured');
    }

    if (!Buffer.isBuffer(imageBuffer)) {
      throw new Error('Invalid image buffer');
    }

    const language = options.language || 'es';
    const minConfidence = options.minConfidence || 0.5;
    const objectName = options.objectName || null;

    const params = new URLSearchParams({
      visualFeatures: 'Objects',
      language
    });

    try {
      console.log('🔍 Detecting objects with Azure Computer Vision...');
      
      const response = await axios.post(
        `${this.analyzeUrl}?${params.toString()}`,
        imageBuffer,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.apiKey,
            'Content-Type': 'application/octet-stream'
          },
          timeout: options.timeout || 60000
        }
      );

      return this.normalizeObjectDetectionResponse(response.data, {
        minConfidence,
        objectName,
        language
      });
    } catch (error) {
      console.error('❌ Error calling Azure Object Detection:', error.message);
      if (error.response) {
        console.error('Azure response:', error.response.data);
      }
      throw new Error(error.response?.data?.error?.message || 'Azure Object Detection failed');
    }
  }

  /**
   * Normalize object detection response for HU-VC4
   * @param {object} data
   * @param {object} options
   * @returns {object}
   */
  normalizeObjectDetectionResponse(data = {}, options = {}) {
    const minConfidence = options.minConfidence || 0.5;
    const objectName = options.objectName || null;
    const language = options.language || 'es';

    // Extract and filter objects
    let objects = Array.isArray(data.objects) ? [...data.objects] : [];
    
    objects = objects
      .filter(obj => (obj.confidence || 0) >= minConfidence)
      .map((obj, idx) => ({
        id: idx,
        name: obj.object || 'unknown',
        confidence: obj.confidence || 0,
        rectangle: {
          x: obj.rectangle?.x || 0,
          y: obj.rectangle?.y || 0,
          w: obj.rectangle?.w || 0,
          h: obj.rectangle?.h || 0
        },
        // Bounding box normalizado (0-1) para frontend
        normalizedRectangle: {
          x: ((obj.rectangle?.x || 0) / (data.metadata?.width || 1)),
          y: ((obj.rectangle?.y || 0) / (data.metadata?.height || 1)),
          w: ((obj.rectangle?.w || 0) / (data.metadata?.width || 1)),
          h: ((obj.rectangle?.h || 0) / (data.metadata?.height || 1))
        },
        area: (obj.rectangle?.w || 0) * (obj.rectangle?.h || 0),
        parent: obj.parent 
          ? { 
              name: obj.parent.object || 'unknown', 
              confidence: obj.parent.confidence || 0 
            } 
          : null
      }))
      .sort((a, b) => b.confidence - a.confidence);

    // Filter by specific object name if provided
    if (objectName) {
      objects = objects.filter(obj => 
        obj.name.toLowerCase().includes(objectName.toLowerCase())
      );
    }

    // Count objects by type
    const objectCounts = objects.reduce((acc, obj) => {
      acc[obj.name] = (acc[obj.name] || 0) + 1;
      return acc;
    }, {});

    // Group objects by type
    const groupedByType = objects.reduce((acc, obj) => {
      if (!acc[obj.name]) {
        acc[obj.name] = [];
      }
      acc[obj.name].push(obj);
      return acc;
    }, {});

    // Calculate statistics
    const stats = {
      totalObjects: objects.length,
      totalTypes: Object.keys(objectCounts).length,
      averageConfidence: objects.length > 0
        ? (objects.reduce((sum, obj) => sum + obj.confidence, 0) / objects.length)
        : 0,
      maxConfidence: objects.length > 0 ? Math.max(...objects.map(o => o.confidence)) : 0,
      minConfidence: objects.length > 0 ? Math.min(...objects.map(o => o.confidence)) : 0
    };

    // Get most confident objects
    const topObjects = objects.slice(0, 5).map(obj => ({
      name: obj.name,
      confidence: obj.confidence,
      count: objectCounts[obj.name]
    }));

    return {
      success: true,
      objects,
      objectCounts,
      groupedByType,
      stats,
      topObjects,
      metadata: {
        width: data.metadata?.width || 0,
        height: data.metadata?.height || 0,
        service: 'Azure Computer Vision v3.2',
        timestamp: new Date().toISOString(),
        language,
        minConfidenceThreshold: options.minConfidence,
        detectionMode: 'objects'
      }
    };
  }

  /**
   * Normalize Azure response to a format easier to consume in controllers
   * @param {object} data
   * @returns {object}
   */
  normalizeResponse(data = {}) {
    const captions = Array.isArray(data.description?.captions)
      ? [...data.description.captions]
      : [];
    const sortedCaptions = captions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const primaryCaption = sortedCaptions[0] || null;

    const tags = Array.isArray(data.tags) ? [...data.tags] : [];
    tags.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    const descriptionTags = Array.isArray(data.description?.tags)
      ? data.description.tags
      : [];

    const categories = Array.isArray(data.categories) ? [...data.categories] : [];
    categories.sort((a, b) => (b.score || 0) - (a.score || 0));

    const objects = Array.isArray(data.objects) ? [...data.objects] : [];
    objects.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

    return {
      success: true,
      description: {
        primary: primaryCaption
          ? {
            text: primaryCaption.text,
            confidence: primaryCaption.confidence
          }
          : null,
        captions: sortedCaptions.map(caption => ({
          text: caption.text,
          confidence: caption.confidence
        })),
        tags: descriptionTags
      },
      tags: tags.map(tag => ({
        name: tag.name,
        confidence: tag.confidence
      })),
      categories: categories.map(category => ({
        name: category.name,
        confidence: category.score,
        detail: category.detail || null
      })),
      objects: objects.map(obj => ({
        name: obj.object,
        confidence: obj.confidence,
        rectangle: obj.rectangle || obj.boundingBox || null,
        parent: obj.parent ? { name: obj.parent.object, confidence: obj.parent.confidence } : null
      })),
      color: data.color
        ? {
          dominantColors: data.color.dominantColors || [],
          accentColor: data.color.accentColor || null,
          dominantForegroundColor: data.color.dominantForegroundColor || null,
          dominantBackgroundColor: data.color.dominantBackgroundColor || null,
          isBWImg: Boolean(data.color.isBWImg)
        }
        : null,
      metadata: data.metadata || {},
      raw: data
    };
  }
}

module.exports = new AzureVisionService();

