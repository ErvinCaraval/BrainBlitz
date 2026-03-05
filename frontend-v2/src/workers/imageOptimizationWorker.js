/**
 * WebWorker para optimizar imágenes sin bloquear la UI
 * Ejecuta en hilo separado para máxima velocidad
 */

// Escuchar mensajes del thread principal
self.onmessage = async (event) => {
  try {
    const { base64String, maxWidth = 200, maxHeight = 200, quality = 0.3, id } = event.data;

    // Optimizar imagen
    const optimized = await optimizeImageInWorker(base64String, maxWidth, maxHeight, quality);

    // Enviar resultado al thread principal
    self.postMessage({
      id,
      success: true,
      optimized,
      originalSize: getSize(base64String),
      optimizedSize: getSize(optimized)
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      success: false,
      error: error.message
    });
  }
};

/**
 * Optimiza imagen en el worker
 */
function optimizeImageInWorker(base64String, maxWidth, maxHeight, quality) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.convertToBlob({ type: 'image/jpeg', quality }).then((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve(reader.result);
          };
          reader.readAsDataURL(blob);
        });
      };

      img.onerror = () => {
        reject(new Error('Error al cargar la imagen en worker'));
      };

      img.src = base64String;
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Obtiene el tamaño de una imagen Base64
 */
function getSize(base64String) {
  if (!base64String) return 0;
  const base64 = base64String.includes(',') 
    ? base64String.split(',')[1] 
    : base64String;
  return Math.round((base64.length * 3) / 4 / 1024);
}
