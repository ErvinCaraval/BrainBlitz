/**
 * Memory Optimizer Utility
 * Helps reduce memory usage by cleaning up buffers and triggering garbage collection
 */

/**
 * Clean up large buffers and trigger garbage collection
 * Use this after processing large files/images
 */
function cleanupMemory() {
  if (global.gc) {
    global.gc();
  }
}

/**
 * Compress Base64 image string by reducing quality
 * @param {string} base64String - The Base64 encoded image
 * @param {number} quality - Quality level (1-100, lower = smaller file)
 * @returns {Promise<string>} - Compressed Base64 string
 */
async function compressBase64Image(base64String, quality = 80) {
  try {
    const sharp = require('sharp');
    
    // Convert Base64 to Buffer
    const buffer = Buffer.from(base64String.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    
    // Compress image
    const compressedBuffer = await sharp(buffer)
      .resize(1280, 1024, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality, progressive: true })
      .toBuffer();
    
    // Convert back to Base64
    const compressedBase64 = compressedBuffer.toString('base64');
    
    // Clean up buffers
    buffer = null;
    cleanupMemory();
    
    return `data:image/jpeg;base64,${compressedBase64}`;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}

/**
 * Process image in chunks to avoid memory spike
 * @param {string} base64String - The Base64 encoded image
 * @param {Function} processor - Function to process the image
 * @returns {Promise} - Result of processor
 */
async function processImageInChunks(base64String, processor) {
  try {
    // Remove data URL prefix
    const cleanBase64 = base64String.replace(/^data:image\/\w+;base64,/, '');
    
    // Convert to Buffer
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // Process
    const result = await processor(buffer);
    
    // Clean up
    buffer = null;
    cleanupMemory();
    
    return result;
  } catch (error) {
    console.error('Error processing image:', error);
    throw error;
  }
}

/**
 * Clear unused variables to free memory
 */
function clearVariables(...variables) {
  variables.forEach(v => {
    v = null;
  });
  cleanupMemory();
}

/**
 * Get current memory usage in MB
 */
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024)
  };
}

/**
 * Log memory usage for debugging
 */
function logMemoryUsage(label = 'Memory Usage') {
  const usage = getMemoryUsage();
  console.log(`${label}:`, usage);
  return usage;
}

/**
 * Streaming response for large data
 * Prevents loading entire response in memory
 */
function createMemoryEfficientStream(data, chunkSize = 64 * 1024) {
  const { Readable } = require('stream');
  
  let index = 0;
  return new Readable({
    read() {
      if (index < data.length) {
        const chunk = data.slice(index, index + chunkSize);
        index += chunkSize;
        this.push(chunk);
      } else {
        this.push(null);
      }
    }
  });
}

module.exports = {
  cleanupMemory,
  compressBase64Image,
  processImageInChunks,
  clearVariables,
  getMemoryUsage,
  logMemoryUsage,
  createMemoryEfficientStream
};
