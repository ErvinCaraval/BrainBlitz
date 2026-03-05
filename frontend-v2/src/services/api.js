// Cache para almacenar las respuestas de la API
let topicsCache = null;
let difficultyLevelsCache = null;
let cacheTimeout = 5 * 60 * 1000; // 5 minutos

export const clearCache = () => {
  topicsCache = null;
  difficultyLevelsCache = null;
};

export const fetchWithRetry = async (url, options = {}, retries = 3) => {
  let lastError;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      lastError = error;
      if (i < retries - 1) {
        // Esperar un tiempo exponencial antes de reintentar
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
  
  throw lastError;
};

export const fetchTopics = async () => {
  if (topicsCache && (Date.now() - topicsCache.timestamp) < cacheTimeout) {
    return topicsCache.data;
  }

  const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  try {
    const data = await fetchWithRetry(`${apiBase}/ai/topics`);
    if (data.success && Array.isArray(data.topics)) {
      topicsCache = {
        data: data.topics,
        timestamp: Date.now()
      };
      return data.topics;
    }
    throw new Error('Formato de respuesta inválido');
  } catch (error) {
    console.error('Error fetching topics:', error);
    // Si hay cache antiguo, lo usamos como fallback
    if (topicsCache?.data) {
      return topicsCache.data;
    }
    throw error;
  }
};

export const fetchDifficultyLevels = async () => {
  if (difficultyLevelsCache && (Date.now() - difficultyLevelsCache.timestamp) < cacheTimeout) {
    return difficultyLevelsCache.data;
  }

  const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  try {
    const data = await fetchWithRetry(`${apiBase}/ai/difficulty-levels`);
    if (data.success) {
      difficultyLevelsCache = {
        data: data.levels,
        timestamp: Date.now()
      };
      return data.levels;
    }
    throw new Error('Formato de respuesta inválido');
  } catch (error) {
    console.error('Error fetching difficulty levels:', error);
    if (difficultyLevelsCache?.data) {
      return difficultyLevelsCache.data;
    }
    throw error;
  }
};