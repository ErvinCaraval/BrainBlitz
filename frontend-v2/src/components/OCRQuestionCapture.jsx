import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVoice } from '../VoiceContext';
import { useAuth } from '../AuthContext';
import Button from './ui/Button';
import Alert from './ui/Alert';
import Spinner from './ui/Spinner';

const OCRQuestionCapture = ({ topics, onQuestionExtracted, onCancel }) => {
  const { isVoiceModeEnabled, speak } = useVoice();
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

  // ==================== VALIDATION UTILITIES ====================
  const validateImage = (file) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
      return 'Formato inválido. Solo PNG, JPG o JPEG.';
    }
    if (file.size > maxSize) {
      return 'Imagen demasiado grande. Máximo 10MB.';
    }
    return null;
  };

  const validateQuestion = () => {
    const pregunta = processedQuestion.pregunta?.trim();
    const opciones = processedQuestion.opciones;
    
    const optionsArray = ['a', 'b', 'c', 'd']
      .map(key => opciones[key]?.trim() || '')
      .filter(opt => opt && !opt.includes('no detectada'));

    if (!pregunta) return 'Escribe la pregunta.';
    if (optionsArray.length < 2) return 'Mínimo 2 opciones válidas.';
    if (!selectedTopic) return 'Selecciona un tema.';
    if (correctAnswerIndex >= optionsArray.length) return 'Selecciona respuesta correcta.';
    
    return null;
  };

  // ==================== FILE HANDLING ====================
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateImage(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setImageFile(file);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);

    if (isVoiceModeEnabled) {
      speak(`Imagen seleccionada: ${file.name}. Presiona procesar.`, { force: true });
    }
  };

  // ==================== OCR PROCESSING ====================
  const processImage = async () => {
    if (!imageFile || !apiBase) {
      setError('Selecciona una imagen válida o configura el API.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const response = await fetch(`${apiBase}/ocr/process-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: e.target.result,
              mimeType: imageFile.type || 'image/jpeg',
              language: 'es'
            })
          });

          const data = await response.json();

          if (data.success) {
            const hasQuestion = data.pregunta && !data.pregunta.includes('no detectada');
            const detectedOptions = Object.values(data.opciones || {})
              .filter(opt => opt && !opt.includes('no detectada'));

            if (!hasQuestion || detectedOptions.length === 0) {
              setSuccessMessage('⚠️ Detección parcial. Completa los campos.', { force: true });
              if (isVoiceModeEnabled) {
                speak('Extracción parcial. Completa manualmente.', { force: true });
              }
            } else {
              setSuccessMessage('✅ Pregunta extraída correctamente');
              if (isVoiceModeEnabled) {
                speak(`Pregunta detectada: ${data.pregunta}`, { force: true });
              }
            }

            setProcessedQuestion({
              pregunta: data.pregunta || '',
              opciones: data.opciones || { a: '', b: '', c: '', d: '' }
            });
          } else {
            setError(data.error || 'Error procesando imagen.');
          }
        } catch (err) {
          setError(`Error: ${err.message}`);
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

  // ==================== QUESTION CONFIRMATION ====================
  const confirmQuestion = async () => {
    const validationError = validateQuestion();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');

    const optionsArray = ['a', 'b', 'c', 'd']
      .map(key => processedQuestion.opciones[key]?.trim() || '')
      .filter(opt => opt && !opt.includes('no detectada'));

    const questionPayload = {
      text: processedQuestion.pregunta.trim(),
      options: optionsArray,
      correctAnswerIndex,
      category: selectedTopic,
      explanation: ''
    };

    try {
      if (onQuestionExtracted) {
        await onQuestionExtracted(questionPayload);
        setSavedQuestions([...savedQuestions, questionPayload]);
        setSuccessMessage('✅ Pregunta guardada exitosamente');

        if (isVoiceModeEnabled) {
          speak('Pregunta guardada. Puedes agregar más.', { force: true });
        }

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
      setError(`Error al guardar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ==================== FORM RESET ====================
  const resetForm = () => {
    setImageFile(null);
    setImagePreview(null);
    setProcessedQuestion(null);
    setMode(null);
    setCorrectAnswerIndex(0);
    setError('');
    setSuccessMessage('');
  };

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (isVoiceModeEnabled && !mode && !imageFile) {
      speak('Captura de pregunta. Sube una imagen para comenzar.', { force: true });
    }
  }, [isVoiceModeEnabled, mode, imageFile]);

  // ==================== RENDER ====================
  return (
    <div className="grid gap-4 p-4">
      {/* Voice Mode Help */}
      {isVoiceModeEnabled && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await speak('Sube una imagen. La aplicación extrae automáticamente texto y opciones. Edita si necesario y guarda.', { force: true });
            }}
          >
            🛈 Explicar
          </Button>
        </div>
      )}

      {/* Alerts */}
      {error && <Alert intent="error">{error}</Alert>}
      {successMessage && <Alert intent="success">{successMessage}</Alert>}

      {/* Questions Counter (After Save) */}
      {savedQuestions.length > 0 && !processedQuestion && (
        <div className="p-3 bg-gradient-to-r from-green-500/20 to-green-500/10 rounded-lg border border-green-400/30">
          <div className="mb-3">
            <p className="text-sm font-semibold text-white">
              ✅ {savedQuestions.length} pregunta{savedQuestions.length !== 1 ? 's' : ''} guardada{savedQuestions.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-green-300 mt-1">💡 Agregar más o finalizar</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMode('upload')}
            >
              📷 Otra imagen
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={onCancel}
            >
              ✓ Finalizar
            </Button>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      {!mode && !imageFile && !processedQuestion && (
        <div className="grid gap-3">
          <h3 className="text-lg font-bold">Crear pregunta desde imagen</h3>
          <Button
            onClick={() => setMode('upload')}
            size="lg"
          >
            📱 Subir imagen
          </Button>
        </div>
      )}

      {/* Upload Section */}
      {mode === 'upload' && !processedQuestion && (
        <div className="grid gap-3">
          <h3 className="text-lg font-bold">Subir imagen con texto</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleFileSelect}
            className="block w-full rounded-xl border-2 border-dashed border-white/20 bg-white/5 px-4 py-6 text-white cursor-pointer hover:border-white/40 hover:bg-white/10 transition"
          />
          <p className="text-xs text-white/50">PNG, JPG o JPEG. Máximo 10MB.</p>
        </div>
      )}

      {/* Preview Section */}
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
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={processImage}
              disabled={loading}
              size="lg"
            >
              {loading ? <Spinner size="sm" /> : '⚡ Procesar'}
            </Button>
            <Button
              variant="secondary"
              onClick={resetForm}
              disabled={loading}
            >
              Cambiar imagen
            </Button>
          </div>
        </div>
      )}

      {/* Question Editor */}
      {processedQuestion && (
        <div className="grid gap-6">
          {/* Header */}
          <div className="p-4 bg-gradient-to-br from-bb-primary/20 to-bb-primary/10 rounded-xl border-2 border-bb-primary/40">
            <h3 className="text-lg font-bold mb-2">📝 Editar Pregunta</h3>
            <p className="text-xs text-white/70">Verifica y completa todos los campos</p>
          </div>

          {/* Warning for Partial Detection */}
          {!processedQuestion.pregunta || processedQuestion.pregunta.includes('no detectada') && (
            <Alert intent="warning">
              ⚠️ <strong>Completar manualmente:</strong> OCR no detectó la pregunta correctamente.
            </Alert>
          )}

          {/* Topic Selection */}
          <div className="grid gap-2.5">
            <label className="text-sm font-semibold text-white">Tema</label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border-2 border-white/10 bg-white/5 text-white focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30 transition"
            >
              {topics.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Question Text */}
          <div className="grid gap-2.5">
            <label className="text-sm font-semibold text-white">Pregunta</label>
            <textarea
              value={processedQuestion.pregunta || ''}
              onChange={(e) => setProcessedQuestion(prev => ({
                ...prev,
                pregunta: e.target.value
              }))}
              placeholder="Escribe la pregunta..."
              className="w-full p-4 rounded-xl bg-white/5 border-2 border-white/10 text-white focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30 resize-none transition"
              rows="4"
            />
          </div>

          {/* Answer Options */}
          <div className="grid gap-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-white">Opciones de respuesta</label>
              <span className="text-xs text-white/60">Mínimo 2</span>
            </div>
            <div className="grid gap-3 p-4 bg-white/5 rounded-lg border border-white/10">
              {['a', 'b', 'c', 'd'].map((key, idx) => {
                const optionText = processedQuestion.opciones[key];
                const isEmpty = !optionText || optionText.trim() === '' || optionText.includes('no detectada');

                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="font-bold text-bb-primary text-lg w-8">{key.toUpperCase()})</span>
                    <input
                      type="text"
                      value={optionText && !optionText.includes('no detectada') ? optionText : ''}
                      onChange={(e) => setProcessedQuestion(prev => ({
                        ...prev,
                        opciones: { ...prev.opciones, [key]: e.target.value }
                      }))}
                      className={`flex-1 px-3 py-2 rounded-lg bg-white/5 border text-white text-sm focus:outline-none focus:ring-2 transition ${
                        isEmpty
                          ? 'border-orange-400/50 focus:ring-orange-400/30'
                          : 'border-white/10 focus:ring-bb-primary/30 focus:border-bb-primary'
                      }`}
                      placeholder={isEmpty ? 'Nueva opción' : ''}
                    />
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctAnswerIndex === idx}
                      onChange={() => setCorrectAnswerIndex(idx)}
                      disabled={isEmpty || loading}
                      className="h-5 w-5 cursor-pointer accent-bb-primary"
                    />
                  </div>
                );
              })}
            </div>
            {['a', 'b', 'c', 'd'].some(key => {
              const text = processedQuestion.opciones[key];
              return !text || text.trim() === '' || text.includes('no detectada');
            }) && (
              <p className="text-xs text-orange-300">⚠️ Campos en naranja necesitan edición.</p>
            )}
          </div>

          {/* Correct Answer Summary */}
          <div className="p-4 bg-bb-primary/15 rounded-lg border border-bb-primary/40">
            <p className="text-sm font-semibold text-white mb-2">✓ Respuesta Correcta:</p>
            <p className="text-sm text-white/80">
              {(() => {
                const optionsArray = ['a', 'b', 'c', 'd'];
                const selectedKey = optionsArray[correctAnswerIndex];
                const selectedText = processedQuestion.opciones[selectedKey];
                return selectedText && !selectedText.includes('no detectada')
                  ? `${selectedKey.toUpperCase()}) ${selectedText}`
                  : '⚠️ Selecciona una válida';
              })()}
            </p>
          </div>

          {/* Info Box */}
          <div className="p-3 bg-blue-500/10 border border-blue-400/30 rounded-lg">
            <p className="text-xs text-blue-300">ℹ️ Revisa todo antes de guardar. Puedes editar cualquier campo.</p>
          </div>

          {/* Saved Questions Badge */}
          {savedQuestions.length > 0 && (
            <div className="p-3 bg-green-500/10 border border-green-400/30 rounded-lg">
              <p className="text-sm font-semibold text-green-300">
                ✅ {savedQuestions.length} guardada{savedQuestions.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              onClick={confirmQuestion}
              disabled={loading}
              className="flex-1"
            >
              {loading ? '⏳ Guardando…' : '✔️ Guardar'}
            </Button>
            {savedQuestions.length > 0 ? (
              <Button
                variant="secondary"
                onClick={onCancel}
                disabled={loading}
                className="flex-1"
              >
                ✓ Finalizar
              </Button>
            ) : (
              <Button
                variant="secondary"
                onClick={onCancel}
                disabled={loading}
                className="flex-1"
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
