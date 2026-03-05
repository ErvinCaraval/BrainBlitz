import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../services/firebase';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import FaceCaptureCamera from '../components/FaceCaptureCamera';
import { optimizeImage, getImageSize, optimizeImageUltra } from '../utils/imageOptimizer';
import { getCachedFaceEmbeddings } from '../services/faceCache';

export default function FaceLogin() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState('email'); // 'email' o 'capture'
  const [useUltraCompression, setUseUltraCompression] = useState(false); // Opción nueva
  
  const navigate = useNavigate();

  const handleCapture = async (base64String) => {
    try {
      setProgress('Optimizando imagen...');
      // Seleccionar nivel de compresión
      const optimized = useUltraCompression
        ? await optimizeImageUltra(base64String)  // 160x160, calidad 0.2 - ULTRA
        : await optimizeImage(base64String, 200, 200, 0.3);  // 200x200, calidad 0.3 - Estándar
      const originalSize = getImageSize(base64String);
      const optimizedSize = getImageSize(optimized);
      const reduction = Math.round((1 - optimizedSize/originalSize) * 100);
      console.log(`✓ Imagen optimizada: ${originalSize}KB → ${optimizedSize}KB (${reduction}% reducción)`);
      setCapturedImage(optimized);
      setPreview(optimized);
      setProgress('');
    } catch (error) {
      console.error('Error optimizando imagen, usando original:', error);
      setCapturedImage(base64String);
      setPreview(base64String);
      setProgress('');
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    setPreview(null);
    setError('');
    setSuccess('');
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu email');
      return;
    }
    setError('');
    setStep('capture');
  };

  const loginWithFace = async () => {
    if (!capturedImage) {
      setError('Por favor, captura una foto primero');
      return;
    }

    if (!email) {
      setError('Email requerido');
      setStep('email');
      return;
    }

    setLoading(true);
    setProgress('Enviando imagen...');
    setError('');
    setSuccess('');

    try {
      // Obtener URL base de la API
      const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

      // Enviar imagen al backend para verificación
      setProgress('Verificando rostro...');
      const payload = JSON.stringify({
        image: capturedImage,
        email: email
      });
      console.log(`Tamaño del payload: ${(payload.length / 1024).toFixed(2)}KB`);
      
      const response = await fetch(`${apiBase}/face/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate' // Permitir compresión
        },
        body: payload,
        priority: 'high' // Prioridad alta de red
      });

      // Verificar que la respuesta sea JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Respuesta no es JSON:', text.substring(0, 200));
        throw new Error(`El servidor devolvió un error. Verifica que el backend esté corriendo en ${apiBase}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error en el login facial');
      }

      if (data.success && data.verified) {
        // Login exitoso - usar el customToken para autenticar
        if (data.customToken) {
          setProgress('Autenticando...');
          await signInWithCustomToken(auth, data.customToken);
          setSuccess('¡Login facial exitoso! Redirigiendo...');
          
          // Redirigir después de 1 segundo
          setTimeout(() => {
            navigate('/dashboard');
          }, 1000);
        } else {
          throw new Error('No se recibió token de autenticación');
        }
      } else {
        throw new Error(data.error || 'Las caras no coinciden. Acceso denegado.');
      }
    } catch (err) {
      setError(err.message || 'Error al verificar la cara. Por favor, intenta de nuevo.');
      console.error('Error en login facial:', err);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const backToEmail = () => {
    setStep('email');
    setCapturedImage(null);
    setPreview(null);
    setError('');
    setSuccess('');
  };

  return (
    <div className="container min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold">🔐 Login Facial</h1>
          <p className="text-white/70 mt-2">
            Inicia sesión usando reconocimiento facial
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-6">
          {error && <Alert intent="error" className="mb-4">{error}</Alert>}
          {success && <Alert intent="success" className="mb-4">{success}</Alert>}
          {progress && <Alert intent="info" className="mb-4">⏳ {progress}</Alert>}

          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm text-white/80" htmlFor="email">
                  Correo electrónico
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tú@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" size="lg" disabled={loading} className="w-full">
                Continuar con Login Facial
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {!preview ? (
                <FaceCaptureCamera
                  onCapture={handleCapture}
                  onCancel={backToEmail}
                  disabled={loading}
                  buttonText="📷 Capturar Foto"
                  showCancel={true}
                />
              ) : (
                <>
                  {/* Preview de la foto capturada */}
                  <div className="relative bg-black rounded-lg overflow-hidden">
                    <img
                      src={preview}
                      alt="Foto capturada"
                      className="w-full h-auto max-h-[480px] mx-auto"
                    />
                  </div>

                  {/* Botones de acción */}
                  <div className="flex gap-4 justify-center">
                    <Button
                      onClick={retakePhoto}
                      variant="outline"
                      disabled={loading}
                      size="lg"
                    >
                      🔄 Tomar Otra Foto
                    </Button>
                    <Button
                      onClick={loginWithFace}
                      disabled={loading}
                      size="lg"
                    >
                      {loading ? '⏳ Verificando...' : '✅ Verificar y Login'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="mt-6 text-center space-y-2">
            {step === 'email' && (
              <Button
                onClick={() => navigate('/login')}
                variant="ghost"
                size="sm"
              >
                ← Volver a Login Normal
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
