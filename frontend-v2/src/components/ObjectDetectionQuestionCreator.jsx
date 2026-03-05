import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useVoice } from '../VoiceContext';
import Button from './ui/Button';
import Alert from './ui/Alert';
import Spinner from './ui/Spinner';
import './ObjectDetectionQuestionCreator.css';

const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * HU-VC4: Object Detection Question Creator
 * Allows teachers to create interactive questions based on detected objects
 */
export default function ObjectDetectionQuestionCreator({ 
  topics = [], 
  onQuestionCreated, 
  onCancel 
}) {
  const { user } = useAuth();
  const { isVoiceModeEnabled, speak } = useVoice();
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  
  const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  // State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [detection, setDetection] = useState(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.5);
  const [selectedObject, setSelectedObject] = useState(null);
  const [questionType, setQuestionType] = useState('identification');
  const [hoveredObject, setHoveredObject] = useState(null);
  const [step, setStep] = useState('upload'); // upload | results | preview
  const [questionsCreated, setQuestionsCreated] = useState(0);
  const [justSavedQuestion, setJustSavedQuestion] = useState(false);
  const [questionDraft, setQuestionDraft] = useState({
    text: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    explanation: ''
  });

  // Handlers
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('❌ Formato inválido. Usa JPG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('❌ La imagen debe ser menor a 4MB.');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target.result);
      setStep('upload');
      // Resetear contadores cuando se carga una nueva imagen
      setQuestionsCreated(0);
      setJustSavedQuestion(false);
      if (isVoiceModeEnabled) {
        speak('Imagen seleccionada correctamente. Presiona detectar objetos para continuar.', { force: true });
      }
      setError('');
      setSuccessMessage('✅ Imagen cargada');
    };
    reader.readAsDataURL(file);
  };

  const detectObjects = async () => {
    if (!imagePreview) {
      setError('❌ Selecciona una imagen primero.');
      return;
    }

    setDetecting(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = user && user.getIdToken ? await user.getIdToken() : null;
      
      const response = await fetch(`${apiBase}/vision/detect-objects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          imageBase64: imagePreview,
          minConfidence: confidenceThreshold,
          language: 'es'
        })
      });

      const data = await response.json();

      if (!data.success) {
        setError(`❌ ${data.error || 'Error detectando objetos'}`);
        return;
      }

      setDetection(data.detection);
      setError('');
      setSuccessMessage(`✅ Se detectaron ${data.detection.stats.totalObjects} objetos`);
      setSelectedObject(null);
      
      // Usar setTimeout para asegurar que el estado se actualice antes de dibujar
      setTimeout(() => {
        setStep('results');
        drawBoundingBoxes(data.detection.objects);
      }, 100);

      if (isVoiceModeEnabled) {
        const objectCount = data.detection.stats.totalObjects;
        const topObjects = data.detection.topObjects
          .slice(0, 3)
          .map(o => `${o.name} con ${(o.confidence * 100).toFixed(0)}% confianza`)
          .join(', ');
        
        speak(
          `Detección completada. Se encontraron ${objectCount} objeto${objectCount !== 1 ? 's' : ''}. 
           ${topObjects}. Selecciona un objeto para crear la pregunta.`,
          { force: true }
        );
      }
    } catch (err) {
      console.error('Error:', err);
      setError(`❌ ${err.message}`);
    } finally {
      setDetecting(false);
    }
  };

  const drawBoundingBoxes = (objects) => {
    if (!canvasRef.current || !imagePreview) return;

    const img = new Image();
    img.onload = () => {
      const canvas = canvasRef.current;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      // Draw image
      ctx.drawImage(img, 0, 0);

      // Draw bounding boxes
      objects.forEach((obj) => {
        if (!obj.rectangle) return;

        const { x, y, w, h } = obj.rectangle;
        
        // Color based on confidence
        const hue = Math.max(0, Math.min(120, obj.confidence * 120));
        const color = `hsl(${hue}, 100%, 50%)`;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Label background
        ctx.fillStyle = color;
        ctx.font = 'bold 14px Arial';
        const label = `${obj.name} (${(obj.confidence * 100).toFixed(0)}%)`;
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        
        ctx.fillRect(x, y - 28, textWidth + 8, 24);
        
        // Label text
        ctx.fillStyle = 'white';
        ctx.fillText(label, x + 4, y - 10);
      });
    };
    img.src = imagePreview;
  };

  const generateQuestion = () => {
    if (!detection || !selectedObject) {
      setError('❌ Selecciona un objeto primero.');
      return;
    }

    const filteredObjects = detection.objects
      .filter(obj => obj.confidence >= confidenceThreshold);

    let question = '';
    let options = [];
    let correctAnswerIndex = -1;
    let explanation = '';

    if (questionType === 'identification') {
      question = `¿Qué objeto aparece en esta imagen?`;
      
      // Primero: incluir el objeto seleccionado
      const uniqueObjects = [selectedObject.name];
      const seen = new Set([selectedObject.name]);
      
      // Luego: agregar otros objetos únicos hasta tener 4
      for (const obj of filteredObjects) {
        if (!seen.has(obj.name) && uniqueObjects.length < 4) {
          uniqueObjects.push(obj.name);
          seen.add(obj.name);
        }
      }
      
      // Si tenemos menos de 4 opciones, completar con objetos no filtrados
      if (uniqueObjects.length < 4) {
        for (const obj of detection.objects) {
          if (!seen.has(obj.name) && uniqueObjects.length < 4) {
            uniqueObjects.push(obj.name);
            seen.add(obj.name);
          }
        }
      }
      
      // Si aún tenemos menos de 4, duplicar algunos (fallback)
      while (uniqueObjects.length < 4) {
        uniqueObjects.push('Ninguno de los anteriores');
      }

      options = uniqueObjects;
      correctAnswerIndex = 0; // Por defecto, primera opción

      explanation = `Se detectaron ${detection.stats.totalObjects} objeto(s) en total.`;
    } else {
      const count = detection.objectCounts[selectedObject.name] || 0;
      question = `¿Cuánto${count !== 1 ? 's' : ''} ${selectedObject.name} hay en la imagen?`;
      options = ['0', '1', '2', '3', '4+'];
      correctAnswerIndex = count > 4 ? 4 : count;

      explanation = `Se detectó(ron) ${count} ${selectedObject.name}(s) en la imagen.`;
    }

    // Validar que tenemos exactamente 4 opciones
    if (options.length !== 4) {
      if (options.length < 4) {
        while (options.length < 4) {
          options.push('');
        }
      } else {
        options = options.slice(0, 4);
      }
    }

    // Llenar el draft de pregunta para edición
    setQuestionDraft({
      text: question,
      options: options,
      correctIndex: correctAnswerIndex,
      explanation: explanation
    });

    setStep('preview');
    
    if (isVoiceModeEnabled) {
      speak(`Pregunta generada. ${question}. Las opciones son: ${options.filter(o => o).join(', ')}. Edita antes de guardar.`, { force: true });
    }
  };

  const confirmQuestion = () => {
    // Validar que tenemos pregunta y opciones válidas
    if (!questionDraft.text.trim()) {
      setError('❌ La pregunta no puede estar vacía.');
      return;
    }

    const validOptions = questionDraft.options.filter(opt => opt.trim());
    if (validOptions.length < 2) {
      setError('❌ Necesitas al menos 2 opciones válidas.');
      return;
    }

    if (!questionDraft.options[questionDraft.correctIndex]?.trim()) {
      setError('❌ La opción correcta no puede estar vacía.');
      return;
    }

    const questionData = {
      text: questionDraft.text.trim(),
      options: questionDraft.options.map(opt => opt.trim()),
      correctAnswerIndex: questionDraft.correctIndex,
      category: 'Detección de Objetos',
      explanation: questionDraft.explanation || '',
      imageBase64: imagePreview,
      questionType: `detectionObjects_${questionType}`,
      difficulty: 'media',
      imageAnalysis: {
        detectedObjects: detection.objects,
        objectCounts: detection.objectCounts,
        totalObjects: detection.stats.totalObjects,
        service: 'Azure Computer Vision',
        timestamp: new Date().toISOString()
      }
    };

    // Llamar al callback para guardar la pregunta
    onQuestionCreated?.(questionData);
    
    // Mostrar mensaje de éxito y contar
    setQuestionsCreated(prev => prev + 1);
    setJustSavedQuestion(true);
    setSuccessMessage(`✅ Pregunta ${questionsCreated + 1} guardada`);
    
    if (isVoiceModeEnabled) {
      speak(`Pregunta ${questionsCreated + 1} guardada. Puedes crear otra pregunta con esta imagen.`, { force: true });
    }

    // Limpiar estado después de 2 segundos
    setTimeout(() => {
      setJustSavedQuestion(false);
      setSuccessMessage('');
    }, 2000);
    
    // Volver a vista de resultados para permitir crear otra pregunta
    setStep('results');
    setSelectedObject(null);
    setQuestionType('identification');
    setQuestionDraft({
      text: '',
      options: ['', '', '', ''],
      correctIndex: 0,
      explanation: ''
    });
  };

  // Filtered objects
  const filteredObjects = detection?.objects.filter(
    obj => obj.confidence >= confidenceThreshold
  ) || [];

  const handleCancel = () => {
    if (questionsCreated > 0) {
      if (isVoiceModeEnabled) {
        speak(`Se guardaron ${questionsCreated} pregunta${questionsCreated !== 1 ? 's' : ''}. Volviendo al panel de preguntas.`, { force: true });
      }
    }
    onCancel?.();
  };

  return (
    <div className="object-detection-creator">
      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="od-section">
          <div className="od-header">
            <h2>🎯 Crear Pregunta con Detección de Objetos</h2>
            <p>Sube una imagen y el sistema detectará automáticamente los objetos presentes</p>
          </div>

          <div className="od-upload-zone">
            <label className="od-upload-label">
              {imagePreview ? (
                <div className="od-preview-thumb">
                  <img src={imagePreview} alt="Preview" />
                  <div className="od-preview-overlay">✓ Imagen lista</div>
                </div>
              ) : (
                <div className="od-upload-empty">
                  <span className="od-upload-icon">🖼️</span>
                  <span className="od-upload-text">Haz clic o arrastra una imagen</span>
                  <span className="od-upload-hint">JPG, PNG o WebP (máximo 4MB)</span>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                onChange={handleFileChange}
                className="od-file-input"
              />
            </label>
          </div>

          {imagePreview && (
            <Button
              disabled={detecting}
              onClick={detectObjects}
              className="od-button-primary od-button-full"
            >
              {detecting ? (
                <>
                  <Spinner size="small" />
                  <span>Detectando objetos...</span>
                </>
              ) : (
                '☁️ Detectar Objetos'
              )}
            </Button>
          )}

          {error && <Alert intent="error">{error}</Alert>}
          {successMessage && <Alert intent="success">{successMessage}</Alert>}

          <Button variant="secondary" onClick={handleCancel} className="od-button-full">
            Cancelar
          </Button>
        </div>
      )}

      {/* Step 2: Results and Selection */}
      {step === 'results' && detection && (
        <div className="od-section">
          <div className="od-header">
            <h2>📊 Objetos Detectados</h2>
            <p>Se encontraron {detection.stats.totalObjects} objeto(s)</p>
          </div>

          <div className="od-canvas-container">
            <canvas
              ref={canvasRef}
              className="od-canvas"
            />
            <div className="od-canvas-legend">
              <span>🟢 Verde: Alta confianza (80-100%)</span>
              <span>🟡 Amarillo: Confianza media (50-80%)</span>
              <span>🔴 Rojo: Confianza baja (0-50%)</span>
            </div>
          </div>

          <div className="od-controls">
            <div className="od-confidence-slider">
              <label>Confianza mínima: {(confidenceThreshold * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="od-slider"
              />
              <div className="od-slider-labels">
                <span>Baja</span>
                <span>Media</span>
                <span>Alta</span>
              </div>
            </div>
          </div>

          <div className="od-objects-list">
            <h3>Selecciona un objeto:</h3>
            <div className="od-objects-grid">
              {filteredObjects.map((obj, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedObject(obj)}
                  onMouseEnter={() => setHoveredObject(obj.id)}
                  onMouseLeave={() => setHoveredObject(null)}
                  className={`od-object-card ${
                    selectedObject?.id === obj.id ? 'od-selected' : ''
                  } ${hoveredObject === obj.id ? 'od-hovered' : ''}`}
                >
                  <div className="od-object-name">{obj.name}</div>
                  <div className="od-object-confidence">
                    <div className="od-confidence-bar">
                      <div 
                        className="od-confidence-fill"
                        style={{ width: `${obj.confidence * 100}%` }}
                      />
                    </div>
                    <span>{(obj.confidence * 100).toFixed(0)}%</span>
                  </div>
                </button>
              ))}
            </div>

            {filteredObjects.length === 0 && (
              <div className="od-no-objects">
                <p>No hay objetos con la confianza mínima requerida</p>
                <button 
                  className="od-button-secondary"
                  onClick={() => setConfidenceThreshold(0.3)}
                >
                  Bajar umbral de confianza
                </button>
              </div>
            )}
          </div>

          <div className="od-stats">
            <div className="od-stat-card">
              <span className="od-stat-label">Total de objetos</span>
              <span className="od-stat-value">{detection.stats.totalObjects}</span>
            </div>
            <div className="od-stat-card">
              <span className="od-stat-label">Tipos únicos</span>
              <span className="od-stat-value">{detection.stats.totalTypes}</span>
            </div>
            <div className="od-stat-card">
              <span className="od-stat-label">Confianza promedio</span>
              <span className="od-stat-value">{(detection.stats.averageConfidence * 100).toFixed(0)}%</span>
            </div>
          </div>

          {selectedObject && (
            <div className="od-question-type">
              <h3>Tipo de pregunta:</h3>
              <div className="od-question-options">
                <label className="od-radio-option">
                  <input
                    type="radio"
                    value="identification"
                    checked={questionType === 'identification'}
                    onChange={(e) => setQuestionType(e.target.value)}
                  />
                  <span>🎯 ¿Qué objeto aparece?</span>
                </label>
                <label className="od-radio-option">
                  <input
                    type="radio"
                    value="counting"
                    checked={questionType === 'counting'}
                    onChange={(e) => setQuestionType(e.target.value)}
                  />
                  <span>🔢 ¿Cuánto{detection.objectCounts[selectedObject.name] !== 1 ? 's' : ''} {selectedObject.name} hay?</span>
                </label>
              </div>
            </div>
          )}

          {error && <Alert intent="error">{error}</Alert>}

          <div className="od-button-group">
            {selectedObject && (
              <Button
                onClick={generateQuestion}
                className="od-button-primary"
              >
                ✅ Generar Pregunta
              </Button>
            )}
            <Button variant="secondary" onClick={() => setStep('upload')} className="od-button-secondary">
              ← Volver
            </Button>
            {questionsCreated > 0 && (
              <Button variant="ghost" onClick={handleCancel} className="od-button-secondary">
                Finalizar ({questionsCreated} pregunta{questionsCreated !== 1 ? 's' : ''})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Preview and Editing */}
      {step === 'preview' && detection && (
        <div className="od-section">
          <div className="od-header">
            <h2>👁️ Editar Pregunta</h2>
            <p>Revisa y edita la pregunta antes de guardarla</p>
          </div>

          <div className="od-preview-card">
            <img src={imagePreview} alt="Question" className="od-preview-image" />
            
            <div className="od-preview-question">
              <h3>📝 Pregunta:</h3>
              <input
                type="text"
                value={questionDraft.text}
                onChange={(e) => setQuestionDraft(prev => ({ ...prev, text: e.target.value }))}
                className="od-input"
                placeholder="Escribe tu pregunta"
              />
            </div>

            <div className="od-preview-options">
              <h3>📋 Opciones de Respuesta:</h3>
              <div className="od-options-list">
                {questionDraft.options.map((opt, idx) => (
                  <div key={idx} className={`od-option-editor ${idx === questionDraft.correctIndex ? 'od-selected-correct' : ''}`}>
                    <label className="od-radio-option">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={idx === questionDraft.correctIndex}
                        onChange={() => setQuestionDraft(prev => ({ ...prev, correctIndex: idx }))}
                      />
                      <span className="od-option-letter">{String.fromCharCode(65 + idx)}.</span>
                    </label>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOptions = [...questionDraft.options];
                        newOptions[idx] = e.target.value;
                        setQuestionDraft(prev => ({ ...prev, options: newOptions }));
                      }}
                      className="od-option-input"
                      placeholder={`Opción ${idx + 1}`}
                    />
                    {idx === questionDraft.correctIndex && <span className="od-correct-badge">✓ Correcta</span>}
                  </div>
                ))}
              </div>
            </div>

            <div className="od-preview-explanation">
              <h3>💡 Explicación:</h3>
              <textarea
                value={questionDraft.explanation}
                onChange={(e) => setQuestionDraft(prev => ({ ...prev, explanation: e.target.value }))}
                className="od-explanation-textarea"
                placeholder="Explicación de la respuesta (opcional)"
                rows="3"
              />
            </div>
          </div>

          {error && <Alert intent="error">{error}</Alert>}

          <div className="od-button-group">
            <Button
              onClick={confirmQuestion}
              className="od-button-primary"
            >
              💾 Guardar Pregunta
            </Button>
            <Button variant="secondary" onClick={() => setStep('results')} className="od-button-secondary">
              ← Volver
            </Button>
            {questionsCreated > 0 && (
              <Button variant="ghost" onClick={handleCancel} className="od-button-secondary">
                Finalizar ({questionsCreated} pregunta{questionsCreated !== 1 ? 's' : ''})
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
