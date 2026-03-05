import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVoice } from '../VoiceContext';
import { useAuth } from '../AuthContext';
import Button from './ui/Button';
import Input from './ui/Input';
import Alert from './ui/Alert';
import Spinner from './ui/Spinner';

const OCRQuestionCapture = ({ topics, onQuestionExtracted, onCancel }) => {
  const { isVoiceModeEnabled, speak } = useVoice();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // ==================== STATE MANAGEMENT ====================
  const [mode, setMode] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(topics[0] || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [processedQuestion, setProcessedQuestion] = useState(null);
  const [correctAnswerIndex, setCorrectAnswerIndex] = useState(0);
  const [savedQuestions, setSavedQuestions] = useState([]);

  /**
   * Handle file selection from input
   */
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setError('Por favor selecciona una imagen (PNG, JPG, JPEG)');
      return;
    }

    // Validate file size (max 10MB for OCR)
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen es demasiado grande. Máximo 10MB');
      return;
    }

    setImageFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Announce to voice
    if (isVoiceModeEnabled) {
      speak(`Imagen seleccionada: ${file.name}. Presiona procesar para extraer la pregunta.`, { force: true });
    }
  };



  /**
   * Process image using OCR
   */
  const processImage = async () => {
    if (!imageFile) {
      setError('Por favor selecciona o captura una imagen');
      return;
    }

    if (!apiBase) {
      setError('Error de configuración: URL del API no definida');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Image = e.target.result;

        try {
          const response = await fetch(`${apiBase}/ocr/process-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              imageBase64: base64Image,
              mimeType: imageFile.type || 'image/jpeg',
              language: 'es'
            })
          });

          const data = await response.json();

          if (data.success) {
            // Check if OCR detection was successful or partial
            const hasQuestion = data.pregunta && !data.pregunta.includes('no detectada');
            const detectedOptions = Object.values(data.opciones || {}).filter(opt => opt && !opt.includes('no detectada'));
            
            if (!hasQuestion || detectedOptions.length === 0) {
              // Partial detection - show warning but allow manual completion
              setProcessedQuestion({
                pregunta: data.pregunta || '',
                opciones: data.opciones || { a: '', b: '', c: '', d: '' }
              });
              setSuccessMessage('⚠️ Detección parcial. Por favor completa los campos vacíos manualmente.');
              
              if (isVoiceModeEnabled) {
                speak('Extracción parcial. Por favor completa la pregunta y las opciones manualmente.', { force: true });
              }
            } else {
              // Full or mostly successful detection
              setProcessedQuestion({
                pregunta: data.pregunta,
                opciones: data.opciones
              });
              setSuccessMessage('✅ Pregunta extraída correctamente');

              if (isVoiceModeEnabled) {
                speak(`Pregunta detectada: ${data.pregunta}`, { force: true });
              }
            }
          } else {
            setError(data.error || 'Error procesando la imagen');
          }
        } catch (err) {
          setError(`Error al procesar la imagen: ${err.message}`);
        } finally {
          setLoading(false);
        }
      };

      reader.readAsDataURL(imageFile);
    } catch (err) {
      setError(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  /**
   * Confirm and submit the extracted question
   */
  const confirmQuestion = async () => {
    // Validation: check if we have a pregunta and at least 2 options
    const pregunta = processedQuestion.pregunta?.trim();
    const opciones = processedQuestion.opciones;
    const optionsArray = [
      opciones.a?.trim() || '',
      opciones.b?.trim() || '',
      opciones.c?.trim() || '',
      opciones.d?.trim() || ''
    ].filter(o => o);
    
    const hasAtLeastTwoOptions = optionsArray.length >= 2;

    if (!pregunta) {
      setError('Por favor escribe la pregunta');
      return;
    }

    if (!hasAtLeastTwoOptions) {
      setError('Por favor completa al menos 2 opciones de respuesta');
      return;
    }

    if (!selectedTopic) {
      setError('Por favor selecciona un tema');
      return;
    }

    // Validate that correctAnswerIndex is within bounds
    if (correctAnswerIndex < 0 || correctAnswerIndex >= optionsArray.length) {
      setError('Por favor selecciona cuál opción es correcta');
      return;
    }

    setLoading(true);
    setError('');

    // Create question payload
    const questionPayload = {
      text: pregunta,
      options: optionsArray,
      correctAnswerIndex: correctAnswerIndex,
      category: selectedTopic,
      explanation: ''
    };

    try {
      if (onQuestionExtracted) {
        // Wait for the callback to complete
        await onQuestionExtracted(questionPayload);
        
        // Show success message
        setSuccessMessage('✅ Pregunta guardada exitosamente');
        
        // Add to local saved questions list
        setSavedQuestions([...savedQuestions, questionPayload]);
        
        // Reset form after a short delay to show the success message
        // Mantener modal abierto para agregar más preguntas
        setTimeout(() => {
          setImageFile(null);
          setImagePreview(null);
          setProcessedQuestion(null);
          setMode(null);
          setCorrectAnswerIndex(0);
          setSuccessMessage('');
        }, 2000);
      }
    } catch (err) {
      setError(`Error al guardar la pregunta: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset form
   */
  const resetForm = () => {
    setImageFile(null);
    setImagePreview(null);
    setProcessedQuestion(null);
    setMode(null);
    setCorrectAnswerIndex(0);
    stopCamera();
    setError('');
    setSuccessMessage('');
  };

  useEffect(() => {
  if (isVoiceModeEnabled && !mode && !imageFile) {
    // Don't include 'speak' in dependencies to avoid infinite loops
    speak('Formulario de captura de pregunta. Selecciona una imagen o toma una foto.', { force: true });
  }
}, [isVoiceModeEnabled, mode, imageFile]);


  return (
    <div className="grid gap-4 p-4">
      {isVoiceModeEnabled && (
        <div className="flex justify-end mb-3 -mt-1">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={async () => {
              await speak('Captura de pregunta. Puedes subir una imagen o tomar una foto desde la cámara. La aplicación extraerá automáticamente el texto y las opciones.', {
                force: true
              });
            }}
            aria-label="Explicar la página"
          >
            🛈 Explicar página
          </Button>
        </div>
      )}

      {error && <Alert intent="error">{error}</Alert>}
      {successMessage && <Alert intent="success">{successMessage}</Alert>}

      {/* Show counter of saved questions at top when returning to image selection */}
      {savedQuestions.length > 0 && !processedQuestion && (
        <div className="p-3 bg-gradient-to-r from-green-500/20 to-green-500/10 rounded-lg border border-green-400/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-white">
                ✅ {savedQuestions.length} pregunta{savedQuestions.length !== 1 ? 's' : ''} guardada{savedQuestions.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-green-300 mt-1">💡 Puedes agregar más o finalizar</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMode('upload')}
              onFocus={() => isVoiceModeEnabled && speak('Subir otra imagen', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Subir otra imagen', { force: true })}
            >
              📷 Otra imagen
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
              onFocus={() => isVoiceModeEnabled && speak('Finalizar y cerrar', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Finalizar y cerrar', { force: true })}
            >
              ✓ Finalizar
            </Button>
          </div>
        </div>
      )}

      {/* Mode selection */}
      {!mode && !imageFile && !processedQuestion && (
        <div className="grid gap-3">
          <h3 className="text-lg font-bold">Crear pregunta</h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => setMode('upload')}
              size="lg"
              onFocus={() => isVoiceModeEnabled && speak('Subir imagen', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Subir imagen', { force: true })}
            >
              📱 Subir imagen
            </Button>
          </div>
        </div>
      )}

      {/* Upload mode */}
      {mode === 'upload' && !processedQuestion && (
        <div className="grid gap-3">
          <h3 className="text-lg font-bold">Subir imagen</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleFileSelect}
            className="block w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white"
          />
        </div>
      )}

      {/* Image preview and processing */}
      {imageFile && !processedQuestion && (
        <div className="grid gap-3">
          <h3 className="text-lg font-bold">Vista previa</h3>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="w-full max-h-96 rounded-xl object-contain border-2 border-white/10"
            />
          )}
          <div className="flex gap-3">
            <Button
              onClick={processImage}
              disabled={loading}
              size="lg"
              onFocus={() => isVoiceModeEnabled && speak('Procesar imagen', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Procesar imagen', { force: true })}
            >
              {loading ? <Spinner size="sm" /> : '⚡ Procesar'}
            </Button>
            <Button
              variant="secondary"
              onClick={resetForm}
              disabled={loading}
              onFocus={() => isVoiceModeEnabled && speak('Seleccionar otra imagen', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Seleccionar otra imagen', { force: true })}
            >
              Cambiar imagen
            </Button>
          </div>
        </div>
      )}

      {/* Processed question display and confirmation */}
      {processedQuestion && (
        <div className="grid gap-6">
          <div className="p-4 bg-gradient-to-br from-bb-primary/20 to-bb-primary/10 rounded-xl border-2 border-bb-primary/40">
            <h3 className="text-lg font-bold mb-2">📝 Pregunta extraída</h3>
            <p className="text-xs text-white/70">Completa los campos para guardar tu pregunta</p>
          </div>

          {!processedQuestion.pregunta || processedQuestion.pregunta.includes('Pregunta no detectada') ? (
            <div className="p-3 bg-orange-500/10 border border-orange-400/30 rounded-lg">
              <p className="text-sm text-orange-300">⚠️ <strong>Importante:</strong> OCR no detectó la pregunta correctamente. Por favor completa los campos manualmente.</p>
            </div>
          ) : null}

          {/* Tema */}
          <div className="grid gap-2.5">
            <label className="text-sm font-semibold text-white">Tema</label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="block w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-md focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30 focus:outline-none transition"
            >
              {topics.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Pregunta */}
          <div className="grid gap-2.5">
            <label className="text-sm font-semibold text-white">Pregunta</label>
            <textarea
              value={processedQuestion.pregunta || ''}
              placeholder="Escribe la pregunta aquí..."
              className="w-full p-4 rounded-xl bg-white/5 border-2 border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-bb-primary/30 focus:border-bb-primary resize-none transition text-base"
              rows="4"
              onChange={(e) => {
                setProcessedQuestion(prev => ({
                  ...prev,
                  pregunta: e.target.value
                }));
              }}
            />
          </div>

          {/* Opciones de respuesta */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-white">Opciones de respuesta</label>
              <span className="text-xs text-white/60">Mínimo 2 opciones</span>
            </div>
            <div className="grid gap-4 p-5 bg-white/5 rounded-lg border border-white/10">
              {['a', 'b', 'c', 'd'].map((key, idx) => {
                const optionText = processedQuestion.opciones[key];
                const isEmpty = !optionText || optionText.trim() === '' || optionText.includes('no detectada');
                return (
                  <div key={key} className="flex items-center gap-4">
                    <span className="font-bold text-bb-primary text-lg min-w-[2.5rem]">{key.toUpperCase()})</span>
                    <input
                      type="text"
                      value={optionText && !optionText.includes('no detectada') ? optionText : ''}
                      placeholder={isEmpty ? 'Opción opcional' : ''}
                      className={`flex-1 p-3 rounded-lg bg-white/5 border text-white text-sm focus:outline-none focus:ring-2 transition ${
                        isEmpty 
                          ? 'border-orange-400/50 focus:ring-orange-400/30' 
                          : 'border-white/10 focus:ring-bb-primary/30 focus:border-bb-primary'
                      }`}
                      onChange={(e) => {
                        setProcessedQuestion(prev => ({
                          ...prev,
                          opciones: {
                            ...prev.opciones,
                            [key]: e.target.value
                          }
                        }));
                      }}
                    />
                    <div className="flex-shrink-0">
                      <input
                        type="radio"
                        name="correctOption"
                        checked={correctAnswerIndex === idx}
                        onChange={() => setCorrectAnswerIndex(idx)}
                        disabled={loading || isEmpty}
                        className="h-5 w-5 cursor-pointer accent-bb-primary"
                        title={isEmpty ? 'Completa esta opción para seleccionar' : 'Respuesta correcta'}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {['a', 'b', 'c', 'd'].some(key => {
              const optionText = processedQuestion.opciones[key];
              return !optionText || optionText.trim() === '' || optionText.includes('no detectada');
            }) && (
              <p className="text-xs text-orange-300 flex items-center gap-1">
                <span>⚠️</span> Los campos destacados en naranja no fueron detectados. Edítalos manualmente.
              </p>
            )}
          </div>

          {/* Respuesta Correcta */}
          <div className="grid gap-3 p-5 bg-bb-primary/15 rounded-lg border border-bb-primary/40">
            <label className="text-sm font-semibold text-white flex items-center gap-2">
              <span>✓ Respuesta Correcta</span>
              <span className="text-xs font-normal text-white/60">(Selecciona arriba)</span>
            </label>
            <div className="text-sm text-white/80">
              {(() => {
                const selectedIdx = correctAnswerIndex;
                const optionsArray = ['a', 'b', 'c', 'd'];
                const selectedOption = optionsArray[selectedIdx];
                const selectedText = processedQuestion.opciones[selectedOption];
                return selectedText && !selectedText.includes('no detectada') 
                  ? `${selectedOption.toUpperCase()}) ${selectedText}` 
                  : 'Selecciona una opción válida';
              })()}
            </div>
          </div>

          {/* Info */}
          <p className="text-xs text-white/60 flex items-center gap-2 p-2 bg-white/5 rounded-lg">
            <span>ℹ️</span>
            <span>Puedes editar todos los campos. Asegúrate de que todo sea correcto antes de guardar.</span>
          </p>

          {/* Show saved questions counter */}
          {savedQuestions.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-green-500/20 to-green-500/10 rounded-lg border border-green-400/30">
              <p className="text-sm font-semibold text-white">
                ✅ {savedQuestions.length} pregunta{savedQuestions.length !== 1 ? 's' : ''} guardada{savedQuestions.length !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-green-300 mt-1">💡 Puedes guardar esta y agregar más, o finalizar</p>
            </div>
          )}

          {/* Action Buttons - Organized */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:flex md:gap-3 pt-2">
            <Button
              onClick={confirmQuestion}
              disabled={loading}
              onFocus={() => isVoiceModeEnabled && speak('Confirmar y guardar la pregunta', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Confirmar y guardar la pregunta', { force: true })}
            >
              {loading ? '⏳ Guardando…' : '✔️ Confirmar'}
            </Button>
            <Button
              variant="secondary"
              onClick={resetForm}
              disabled={loading}
              onFocus={() => isVoiceModeEnabled && speak('Cargar otra imagen', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Cargar otra imagen', { force: true })}
            >
              📷 Otra imagen
            </Button>
            {savedQuestions.length > 0 && (
              <Button
                variant="secondary"
                onClick={onCancel}
                disabled={loading}
                onFocus={() => isVoiceModeEnabled && speak('Finalizar y cerrar', { force: true })}
                onMouseEnter={() => isVoiceModeEnabled && speak('Finalizar y cerrar', { force: true })}
              >
                ✓ Finalizar
              </Button>
            )}
            {savedQuestions.length === 0 && (
              <Button
                variant="secondary"
                onClick={onCancel}
                disabled={loading}
                onFocus={() => isVoiceModeEnabled && speak('Volver atrás', { force: true })}
                onMouseEnter={() => isVoiceModeEnabled && speak('Volver atrás', { force: true })}
              >
                ← Atrás
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OCRQuestionCapture;
