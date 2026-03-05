import { useRef, useEffect, useState, useCallback } from 'react';
import { FaceDetector, FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Hook para detección facial en tiempo real con MediaPipe
 * Requisitos específicos:
 * - Tamaño del rostro entre 37% y 40%
 * - Iluminación >= 80
 * Solo habilita captura cuando se cumplen AMBOS requisitos
 */
export function useMediaPipeFaceDetection() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [detectionResult, setDetectionResult] = useState(null);
  const [validationStatus, setValidationStatus] = useState({
    isValid: false,
    color: 'red', // 'red' | 'yellow' | 'green'
    message: 'Iniciando detección...',
    details: {}
  });

  const faceDetectorRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // Inicializar MediaPipe
  useEffect(() => {
    let mounted = true;

    const initializeMediaPipe = async () => {
      try {
        // Inicializar FilesetResolver para Vision Tasks usando archivos en public/wasm
        const visionFilesetResolver = await FilesetResolver.forVisionTasks('/wasm');

        // Inicializar FaceDetector
        const faceDetector = await FaceDetector.createFromOptions(visionFilesetResolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          minDetectionConfidence: 0.5
        });

        // Inicializar FaceLandmarker
        const faceLandmarker = await FaceLandmarker.createFromOptions(visionFilesetResolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          numFaces: 1
        });

        if (mounted) {
          faceDetectorRef.current = faceDetector;
          faceLandmarkerRef.current = faceLandmarker;
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('Error inicializando MediaPipe con GPU:', error);
        // Fallback a CPU si GPU falla
        try {
          const visionFilesetResolver = await FilesetResolver.forVisionTasks('/wasm');

          const faceDetector = await FaceDetector.createFromOptions(visionFilesetResolver, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            minDetectionConfidence: 0.5
          });

          const faceLandmarker = await FaceLandmarker.createFromOptions(visionFilesetResolver, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            outputFaceBlendshapes: true,
            outputFacialTransformationMatrixes: true,
            numFaces: 1
          });

          if (mounted) {
            faceDetectorRef.current = faceDetector;
            faceLandmarkerRef.current = faceLandmarker;
            setIsInitialized(true);
          }
        } catch (fallbackError) {
          console.error('Error en fallback CPU:', fallbackError);
          if (mounted) {
            setValidationStatus({
              isValid: false,
              color: 'red',
              message: 'Error al inicializar detección facial',
              details: {}
            });
          }
        }
      }
    };

    initializeMediaPipe();

    return () => {
      mounted = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  /**
   * Calcula la nitidez de una imagen usando Laplacian
   */
  const calculateSharpness = useCallback((imageData) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    let sum = 0;
    let count = 0;

    // Aplicar kernel Laplacian simplificado
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const rightGray = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3;
        const bottomGray = (data[(idx + width * 4) + 0] + data[(idx + width * 4) + 1] + data[(idx + width * 4) + 2]) / 3;
        const laplacian = Math.abs(2 * gray - rightGray - bottomGray);
        sum += laplacian;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }, []);

  /**
   * Calcula la iluminación promedio de una región
   */
  const calculateBrightness = useCallback((imageData, x, y, width, height) => {
    const data = imageData.data;
    let sum = 0;
    let count = 0;

    const startX = Math.max(0, Math.floor(x));
    const startY = Math.max(0, Math.floor(y));
    const endX = Math.min(imageData.width, Math.floor(x + width));
    const endY = Math.min(imageData.height, Math.floor(y + height));

    for (let py = startY; py < endY; py += 2) { // Sample cada 2 píxeles para performance
      for (let px = startX; px < endX; px += 2) {
        const idx = (py * imageData.width + px) * 4;
        // Calcular luminosidad usando fórmula estándar
        const brightness = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
        sum += brightness;
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }, []);

  /**
   * Calcula orientación del rostro (pitch, yaw, roll) desde landmarks
   */
  const calculateFaceOrientation = useCallback((landmarks, transformationMatrix) => {
    if (!landmarks || landmarks.length < 5) {
      // Intentar usar transformation matrix si está disponible
      if (transformationMatrix && transformationMatrix.length >= 16) {
        // Extraer rotación de la matriz de transformación
        const m = transformationMatrix;
        // Calcular pitch, yaw, roll desde la matriz
        const pitch = Math.asin(-m[9]) * (180 / Math.PI);
        const yaw = Math.atan2(m[8], m[10]) * (180 / Math.PI);
        const roll = Math.atan2(m[1], m[5]) * (180 / Math.PI);
        return { pitch, yaw, roll };
      }
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Puntos clave de landmarks (índices aproximados de MediaPipe)
    const nose = landmarks[4] || landmarks[0];
    const leftEye = landmarks[2] || landmarks[33] || landmarks[1];
    const rightEye = landmarks[5] || landmarks[263] || landmarks[1];
    const mouth = landmarks[9] || landmarks[13] || landmarks[0];

    if (!nose || !leftEye || !rightEye || !mouth) {
      return { pitch: 0, yaw: 0, roll: 0 };
    }

    // Calcular vectores
    const eyeVector = {
      x: rightEye.x - leftEye.x,
      y: rightEye.y - leftEye.y,
      z: (rightEye.z || 0) - (leftEye.z || 0)
    };

    // Calcular roll (rotación en Z)
    const roll = Math.atan2(eyeVector.y, eyeVector.x) * (180 / Math.PI);

    // Calcular pitch (inclinación arriba/abajo) - aproximado
    const eyeCenterX = (leftEye.x + rightEye.x) / 2;
    const eyeCenterY = (leftEye.y + rightEye.y) / 2;
    const eyeNoseDistance = Math.sqrt(
      Math.pow(nose.x - eyeCenterX, 2) +
      Math.pow(nose.y - eyeCenterY, 2)
    );
    const eyeMouthDistance = Math.sqrt(
      Math.pow(mouth.x - eyeCenterX, 2) +
      Math.pow(mouth.y - eyeCenterY, 2)
    );
    const pitch = Math.atan2(eyeNoseDistance - eyeMouthDistance, eyeMouthDistance) * (180 / Math.PI);

    // Calcular yaw (giro izquierda/derecha) - aproximado
    const leftEyeNoseDist = Math.sqrt(
      Math.pow(nose.x - leftEye.x, 2) + Math.pow(nose.y - leftEye.y, 2)
    );
    const rightEyeNoseDist = Math.sqrt(
      Math.pow(nose.x - rightEye.x, 2) + Math.pow(nose.y - rightEye.y, 2)
    );
    const yaw = Math.atan2(leftEyeNoseDist - rightEyeNoseDist, (leftEyeNoseDist + rightEyeNoseDist) / 2) * (180 / Math.PI);

    return { pitch, yaw, roll };
  }, []);

  /**
   * Valida un rostro detectado
   * REQUISITOS ESTRICTOS:
   * - Tamaño del rostro entre 37% y 40%
   * - Iluminación >= 80
   */
  const validateFace = useCallback((detection, landmarks, transformationMatrix, imageData, videoWidth, videoHeight) => {
    if (!detection || !detection.boundingBox) {
      return {
        isValid: false,
        color: 'red',
        message: 'No se detecta ningún rostro',
        details: {}
      };
    }

    const bbox = detection.boundingBox;
    const faceWidth = bbox.width;
    const faceHeight = bbox.height;
    const faceArea = faceWidth * faceHeight;
    const videoArea = videoWidth * videoHeight;
    const facePercentage = (faceArea / videoArea) * 100;

    // Calcular orientación
    const orientation = calculateFaceOrientation(landmarks, transformationMatrix);

    // Calcular iluminación en la región del rostro
    const brightness = calculateBrightness(
      imageData,
      bbox.originX,
      bbox.originY,
      bbox.width,
      bbox.height
    );

    // Calcular nitidez en la región del rostro (muestreo simplificado)
    const faceStartX = Math.max(1, Math.floor(bbox.originX));
    const faceStartY = Math.max(1, Math.floor(bbox.originY));
    const faceEndX = Math.min(imageData.width - 1, Math.floor(bbox.originX + bbox.width));
    const faceEndY = Math.min(imageData.height - 1, Math.floor(bbox.originY + bbox.height));
    
    let sharpnessSum = 0;
    let sharpnessCount = 0;
    const data = imageData.data;
    const width = imageData.width;
    
    // Muestrear cada 3 píxeles para mejor rendimiento
    for (let y = faceStartY; y < faceEndY - 1; y += 3) {
      for (let x = faceStartX; x < faceEndX - 1; x += 3) {
        const idx = (y * width + x) * 4;
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        const rightIdx = (y * width + (x + 1)) * 4;
        const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
        const bottomIdx = ((y + 1) * width + x) * 4;
        const bottomGray = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
        const laplacian = Math.abs(2 * gray - rightGray - bottomGray);
        sharpnessSum += laplacian;
        sharpnessCount++;
      }
    }
    const sharpness = sharpnessCount > 0 ? sharpnessSum / sharpnessCount : 0;

    // Verificar centrado
    const centerX = (bbox.originX + bbox.width / 2) / videoWidth;
    const centerY = (bbox.originY + bbox.height / 2) / videoHeight;
    const isCentered = Math.abs(centerX - 0.5) < 0.4 && Math.abs(centerY - 0.5) < 0.4;

    // REQUISITOS OBLIGATORIOS PARA HABILITAR CAPTURA:
    // 1. Tamaño del rostro entre 37% y 40%
    // 2. Iluminación >= 80
    
    const minFacePercentage = 37;
    const maxFacePercentage = 40;
    const minBrightness = 80;
    
    const checks = {
      hasFace: true,
      singleFace: true, // Se verifica en el nivel superior
      faceSizeInRange: facePercentage >= minFacePercentage && facePercentage <= maxFacePercentage,
      brightness: brightness >= minBrightness,
      isCentered: isCentered,
      orientation: Math.abs(orientation.pitch) < 25 && 
                   Math.abs(orientation.yaw) < 25 && 
                   Math.abs(orientation.roll) < 25
    };

    // Determinar si se puede capturar
    // SOLO permite captura si:
    // - Hay un rostro único
    // - El tamaño está entre 37% y 40%
    // - La iluminación es >= 80
    const canCapture = checks.hasFace && 
                       checks.singleFace && 
                       checks.faceSizeInRange && 
                       checks.brightness;

    let color = 'red';
    let message = 'No se detecta ningún rostro';

    if (!checks.hasFace) {
      message = 'No se detecta ningún rostro';
      color = 'red';
    } else if (!checks.singleFace) {
      message = 'Hay múltiples rostros. Por favor, asegúrate de que solo aparezcas tú.';
      color = 'red';
    } else if (!checks.faceSizeInRange) {
      if (facePercentage < minFacePercentage) {
        message = `Acércate más (${Math.round(facePercentage)}% - necesitas entre 37% y 40%)`;
      } else {
        message = `Aléjate un poco (${Math.round(facePercentage)}% - necesitas entre 37% y 40%)`;
      }
      color = 'yellow';
    } else if (!checks.brightness) {
      message = `Iluminación insuficiente (${Math.round(brightness)} - necesitas >= 80)`;
      color = 'yellow';
    } else if (canCapture) {
      // TODO PERFECTO - puede capturar
      message = '¡Perfecto! Listo para capturar foto';
      color = 'green';
    } else {
      // Fallback (no debería llegar aquí normalmente)
      message = 'Ajusta tu posición';
      color = 'yellow';
    }

    return {
      isValid: canCapture, // Solo válido si cumple AMBOS requisitos
      color,
      message,
      details: {
        facePercentage: Math.round(facePercentage),
        brightness: Math.round(brightness),
        sharpness: Math.round(sharpness),
        orientation,
        checks,
        bbox
      }
    };
  }, [calculateFaceOrientation, calculateBrightness, calculateSharpness]);

  /**
   * Procesa un frame del video
   */
  const processFrame = useCallback((video, canvas) => {
    if (!video || !canvas || !isInitialized || !faceDetectorRef.current || !faceLandmarkerRef.current) {
      return;
    }

    const currentTime = performance.now();
    if (currentTime - lastVideoTimeRef.current < 33) { // ~30fps
      return;
    }
    lastVideoTimeRef.current = currentTime;

    // Verificar que el video tenga dimensiones válidas
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const canvasCtx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibujar frame del video
    canvasCtx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Obtener imageData para análisis
    const imageData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);

    try {
      // Detectar rostros
      const detections = faceDetectorRef.current.detectForVideo(video, currentTime);
      
      // Detectar landmarks
      const landmarksResult = faceLandmarkerRef.current.detectForVideo(video, currentTime);

      // Validar número de rostros
      if (!detections.detections || detections.detections.length === 0) {
        setDetectionResult(null);
        setValidationStatus({
          isValid: false,
          color: 'red',
          message: 'No se detecta ningún rostro',
          details: {}
        });
        return;
      }

      if (detections.detections.length > 1) {
        setDetectionResult(null);
        setValidationStatus({
          isValid: false,
          color: 'red',
          message: 'Hay múltiples rostros. Por favor, asegúrate de que solo aparezcas tú.',
          details: {}
        });
        return;
      }

      const detection = detections.detections[0];
      const landmarks = landmarksResult.faceLandmarks && landmarksResult.faceLandmarks[0] 
        ? landmarksResult.faceLandmarks[0] 
        : null;
      const transformationMatrix = landmarksResult.facialTransformationMatrixes && landmarksResult.facialTransformationMatrixes[0]
        ? landmarksResult.facialTransformationMatrixes[0]
        : null;

      // Validar rostro
      const validation = validateFace(
        detection,
        landmarks,
        transformationMatrix,
        imageData,
        canvas.width,
        canvas.height
      );

      setDetectionResult({
        detection,
        landmarks,
        transformationMatrix,
        validation
      });

      setValidationStatus(validation);

      // Dibujar bounding box y landmarks
      drawDetection(canvasCtx, detection, landmarks, validation.color);
    } catch (error) {
      console.error('Error procesando frame:', error);
    }
  }, [isInitialized, validateFace]);

  /**
   * Dibuja el bounding box y landmarks en el canvas
   */
  const drawDetection = useCallback((ctx, detection, landmarks, color) => {
    if (!detection || !detection.boundingBox) return;

    const bbox = detection.boundingBox;
    const x = bbox.originX;
    const y = bbox.originY;
    const width = bbox.width;
    const height = bbox.height;

    // Color según validación
    const colors = {
      red: '#ef4444',
      yellow: '#eab308',
      green: '#22c55e'
    };
    const strokeColor = colors[color] || colors.red;

    // Dibujar bounding box
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([]);
    ctx.strokeRect(x, y, width, height);

    // Dibujar landmarks si están disponibles
    if (landmarks && landmarks.length > 0) {
      ctx.fillStyle = strokeColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;

      // Dibujar puntos clave (ojos, nariz, boca) - usar índices aproximados
      const keyPointIndices = [33, 263, 4, 13]; // Ojo izquierdo, ojo derecho, nariz, boca (índices MediaPipe)
      keyPointIndices.forEach(idx => {
        if (landmarks[idx]) {
          const point = landmarks[idx];
          ctx.beginPath();
          ctx.arc(point.x * ctx.canvas.width, point.y * ctx.canvas.height, 3, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }
  }, []);

  /**
   * Inicia el procesamiento continuo de frames
   */
  const startDetection = useCallback((videoRef, canvasRef) => {
    if (!videoRef.current || !canvasRef.current || !isInitialized) {
      return;
    }

    const process = () => {
      if (videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
        processFrame(videoRef.current, canvasRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(process);
    };

    process();
  }, [isInitialized, processFrame]);

  /**
   * Detiene el procesamiento
   */
  const stopDetection = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    lastVideoTimeRef.current = -1;
  }, []);

  return {
    isInitialized,
    detectionResult,
    validationStatus,
    startDetection,
    stopDetection,
    processFrame
  };
}