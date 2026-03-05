import React, { useRef, useEffect, useState } from 'react';
import { useMediaPipeFaceDetection } from '../hooks/useMediaPipeFaceDetection';
import Button from './ui/Button';
import Alert from './ui/Alert';

/**
 * Componente de captura facial con validación en tiempo real usando MediaPipe
 * Muestra video con bounding box de colores y mensajes guiados
 */
export default function FaceCaptureCamera({ 
  onCapture, 
  onCancel,
  disabled = false,
  buttonText = '📷 Capturar Foto',
  showCancel = true
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState('');

  const {
    isInitialized,
    validationStatus,
    startDetection,
    stopDetection
  } = useMediaPipeFaceDetection();

  // Inicializar cámara
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      stopDetection();
    };
  }, []);

  // Sincronizar tamaño del canvas con el video
  useEffect(() => {
    const syncCanvasSize = () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const rect = video.getBoundingClientRect();
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        // Las dimensiones reales del canvas se establecen en processFrame
      }
    };

    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', syncCanvasSize);
      syncCanvasSize();
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', syncCanvasSize);
      }
    };
  }, [stream]);

  // Iniciar detección cuando la cámara esté lista
  useEffect(() => {
    if (stream && videoRef.current && isInitialized && !isCapturing) {
      const startWhenReady = () => {
        if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
          startDetection(videoRef, canvasRef);
        }
      };

      videoRef.current.addEventListener('loadedmetadata', startWhenReady);

      if (videoRef.current.readyState >= 2) {
        startWhenReady();
      }

      return () => {
        if (videoRef.current) {
          videoRef.current.removeEventListener('loadedmetadata', startWhenReady);
        }
        stopDetection();
      };
    }

    return () => {
      stopDetection();
    };
  }, [stream, isInitialized, isCapturing, startDetection, stopDetection]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError('');
    } catch (err) {
      const errorMessage = err.name === 'NotAllowedError' 
        ? 'Permisos de cámara denegados. Por favor, permite el acceso a la cámara.'
        : err.name === 'NotFoundError'
        ? 'No se encontró ninguna cámara. Por favor, conecta una cámara.'
        : 'No se pudo acceder a la cámara. Por favor, verifica los permisos.';
      setError(errorMessage);
      console.error('Error accediendo a la cámara:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError('Error capturando la foto');
      return;
    }

    if (!validationStatus.isValid) {
      setError(validationStatus.message);
      return;
    }

    setIsCapturing(true);
    stopDetection();

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Configurar canvas con las dimensiones del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibujar el frame actual del video en el canvas (sin bounding boxes)
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir canvas a Base64
    canvas.toBlob(async (blob) => {
      if (blob) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result;
          if (onCapture) {
            onCapture(base64String);
          }
          setIsCapturing(false);
        };
        reader.onerror = () => {
          setError('Error al procesar la imagen');
          setIsCapturing(false);
        };
        reader.readAsDataURL(blob);
      } else {
        setError('Error al capturar la foto');
        setIsCapturing(false);
      }
    }, 'image/jpeg', 0.9);
  };

  // Color del borde según validación
  const borderColor = {
    red: 'border-red-500',
    yellow: 'border-yellow-500',
    green: 'border-green-500'
  }[validationStatus.color] || 'border-red-500';

  return (
    <div className="space-y-4">
      {error && <Alert intent="error">{error}</Alert>}

      {/* Video con overlay de canvas */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-auto max-h-[480px]"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 pointer-events-none"
          style={{ 
            width: '100%',
            height: '100%',
            borderWidth: validationStatus.color === 'green' ? '4px' : '3px',
            borderColor: validationStatus.color === 'green' ? '#22c55e' : validationStatus.color === 'yellow' ? '#eab308' : '#ef4444',
            borderStyle: 'solid',
            borderRadius: '0.5rem'
          }}
        />
        {!stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <p className="text-white">Iniciando cámara...</p>
          </div>
        )}
        {!isInitialized && stream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <p className="text-white">Inicializando detección facial...</p>
          </div>
        )}
      </div>

      {/* Mensaje de estado */}
      <div className={`text-center p-3 rounded-lg ${
        validationStatus.color === 'green' 
          ? 'bg-green-500/20 text-green-300 border border-green-500/50'
          : validationStatus.color === 'yellow'
          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50'
          : 'bg-red-500/20 text-red-300 border border-red-500/50'
      }`}>
        <p className="font-semibold">{validationStatus.message}</p>
        {validationStatus.details.facePercentage && (
          <p className="text-xs mt-1 opacity-80">
            Rostro: {validationStatus.details.facePercentage}% | 
            Iluminación: {validationStatus.details.brightness > 100 ? '✓' : '✗'} | 
            Nitidez: {validationStatus.details.sharpness > 50 ? '✓' : '✗'}
          </p>
        )}
      </div>

      {/* Botones de control */}
      <div className="flex gap-4 justify-center">
        <Button
          onClick={handleCapture}
          disabled={!stream || !isInitialized || !validationStatus.isValid || disabled || isCapturing}
          size="lg"
        >
          {isCapturing ? 'Capturando...' : buttonText}
        </Button>
        {showCancel && onCancel && (
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isCapturing}
            size="lg"
          >
            Cancelar
          </Button>
        )}
      </div>

      {/* Instrucciones */}
      <div className="text-center text-sm text-white/60 space-y-1">
        <p>💡 Asegúrate de tener buena iluminación</p>
        <p>💡 Mira directamente a la cámara</p>
        <p>💡 Mantén tu rostro centrado y estable</p>
        <p>💡 Espera a que el cuadro esté verde para capturar</p>
      </div>
    </div>
  );
}

