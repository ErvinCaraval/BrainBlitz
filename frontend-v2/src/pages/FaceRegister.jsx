import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import FaceCaptureCamera from '../components/FaceCaptureCamera';
import { optimizeImage, getImageSize, optimizeImageUltra } from '../utils/imageOptimizer';
import { cacheFaceEmbeddings } from '../services/faceCache';

export default function FaceRegister() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [useUltraCompression, setUseUltraCompression] = useState(false); // Opción nueva
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [hasRegistration, setHasRegistration] = useState(false);

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
      console.log(`✓ Imagen optimizada (${useUltraCompression ? 'ULTRA' : 'ESTÁNDAR'}): ${originalSize}KB → ${optimizedSize}KB (${reduction}% reducción)`);
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

  const registerFace = async () => {
    if (!capturedImage) {
      setError('Por favor, captura una foto primero');
      return;
    }

    if (!user) {
      setError('Debes estar autenticado para registrar tu cara. Redirigiendo al login...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      return;
    }

    setLoading(true);
    setProgress('Preparando registro...');
    setError('');
    setSuccess('');

    try {
      console.log('1. Iniciando registro facial...');
      
      // Obtener token de Firebase
      let token;
      try {
        setProgress('Obteniendo autenticación...');
        token = await user.getIdToken();
        console.log('2. Token obtenido correctamente');
      } catch (tokenErr) {
        console.error('Error obteniendo token:', tokenErr);
        throw new Error('No se pudo obtener el token de autenticación. Por favor, inicia sesión nuevamente.');
      }

      // Obtener URL base de la API
      const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      console.log('3. API URL:', apiBase);
      console.log('4. Tamaño de imagen:', capturedImage.length, 'caracteres');

      // Crear un timeout para la petición (30 segundos - ULTRA OPTIMIZADO)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout

      try {
        console.log('5. Enviando petición al backend...');
        setProgress('Enviando imagen...');
        // Comprimir payload para envío más rápido
        const payload = JSON.stringify({
          image: capturedImage,
          token: token
        });
        console.log(`Tamaño del payload: ${(payload.length / 1024).toFixed(2)}KB`);
        
        // Enviar imagen al backend
        const response = await fetch(`${apiBase}/face/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Accept-Encoding': 'gzip, deflate' // Permitir compresión
          },
          body: payload,
          signal: controller.signal,
          priority: 'high' // Prioridad alta de red
        });

        clearTimeout(timeoutId);
        console.log('6. Respuesta recibida. Status:', response.status);
        setProgress('Procesando resultado...');

        // Verificar que la respuesta sea JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('Respuesta no es JSON:', text.substring(0, 200));
          throw new Error(`El servidor devolvió un error (${response.status}). Verifica la consola para más detalles.`);
        }

        const data = await response.json();
        console.log('7. Datos JSON parseados:', data);

        if (!response.ok) {
          console.error('Respuesta no OK:', data);
          throw new Error(data.error || `Error en el servidor (${response.status})`);
        }

        if (data.success) {
          console.log('8. Registro facial exitoso!');
          setSuccess('¡Registro facial completado exitosamente!');
          setProgress('');
          
          // Cachear embeddings localmente si están disponibles (para login rápido)
          if (data.embeddings && user?.email) {
            try {
              await cacheFaceEmbeddings(user.email, data.embeddings, {
                registrationDate: new Date().toISOString()
              });
            } catch (cacheErr) {
              console.warn('No se pudo cachear embeddings, pero el registro fue exitoso:', cacheErr);
            }
          }
          
          // Redirigir a completar perfil o dashboard después de 2 segundos
          setTimeout(() => {
            // Verificar si el usuario tiene displayName, si no, ir a complete-profile
            if (!user?.displayName) {
              navigate('/complete-profile');
            } else {
              navigate('/dashboard');
            }
          }, 2000);
        } else {
          throw new Error(data.error || 'Error en el registro');
        }
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        
        if (fetchErr.name === 'AbortError') {
          console.error('Timeout en la petición');
          throw new Error('La petición tardó demasiado tiempo. Intenta con una imagen más pequeña.');
        }
        
        if (fetchErr instanceof TypeError) {
          console.error('Error de conexión:', fetchErr);
          throw new Error(`No se pudo conectar al servidor (${apiBase}). Verifica que esté activo.`);
        }
        
        throw fetchErr;
      }
    } catch (err) {
      const errorMsg = err.message || 'Error al registrar la cara. Por favor, intenta de nuevo.';
      setError(errorMsg);
      console.error('Error en registro facial:', err);
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  // Check if current user already has a facial registration
  useEffect(() => {
    const check = async () => {
      if (!user) return setHasRegistration(false);
      try {
        const token = await user.getIdToken();
        const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const res = await fetch(`${apiBase}/face/exists`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setHasRegistration(!!data.exists);
      } catch (err) {
        console.error('Error checking face registration:', err);
      }
    };
    check();
  }, [user]);

  const deleteFaceRegistration = async () => {
    if (!user) {
      setError('Debes estar autenticado para eliminar tu registro facial');
      return;
    }
    if (!confirm('¿Estás seguro de eliminar tu registro facial? Esta acción no se puede deshacer.')) return;

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const res = await fetch(`${apiBase}/face/${user.uid}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error eliminando registro facial');
      setSuccess('Registro facial eliminado correctamente');
      setHasRegistration(false);
      setPreview(null);
      setCapturedImage(null);
    } catch (err) {
      setError(err.message || 'Error eliminando registro facial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold">📸 Registro Facial</h1>
          <p className="text-white/70 mt-2">
            {user ? 
              'Captura una foto de tu rostro para habilitar el login facial' :
              'Paso 2: Captura una foto de tu rostro para completar tu registro'
            }
          </p>
          {!user && (
            <p className="text-white/50 text-sm mt-1">
              Ya creaste tu cuenta, ahora completa tu registro con reconocimiento facial
            </p>
          )}
          
          {/* Opción de compresión ultra para conexiones lentas */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer hover:text-white">
              <input
                type="checkbox"
                checked={useUltraCompression}
                onChange={(e) => setUseUltraCompression(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 accent-bb-primary cursor-pointer"
              />
              <span>🚀 Compresión Ultra (si es muy lento)</span>
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-xl p-6">
          {error && <Alert intent="error" className="mb-4">{error}</Alert>}
          {success && <Alert intent="success" className="mb-4">{success}</Alert>}
          {progress && <Alert intent="info" className="mb-4">⏳ {progress}</Alert>}

          {!preview ? (
            <FaceCaptureCamera
              onCapture={handleCapture}
              onCancel={() => navigate('/dashboard')}
              disabled={loading}
              buttonText="📷 Capturar Foto"
              showCancel={true}
            />
          ) : (
            <div className="space-y-4">
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
                  onClick={registerFace}
                  disabled={loading}
                  size="lg"
                >
                  {loading ? '⏳ Registrando...' : '✅ Registrar Cara'}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <div className="flex items-center justify-center gap-3">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="ghost"
                size="sm"
              >
                ← Volver al Dashboard
              </Button>

              {hasRegistration && (
                <Button
                  onClick={deleteFaceRegistration}
                  variant="destructive"
                  size="sm"
                  disabled={loading}
                >
                  🗑️ Eliminar registro facial
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
