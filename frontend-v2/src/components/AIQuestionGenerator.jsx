import React, { useState, useEffect } from 'react';
import { useVoice } from '../VoiceContext';
import { useAuth } from '../AuthContext';
import ManualQuestionForm from './ManualQuestionForm';
import OCRQuestionCapture from './OCRQuestionCapture';
import ImageAnalysisQuestionCreator from './ImageAnalysisQuestionCreator';
import ObjectDetectionQuestionCreator from './ObjectDetectionQuestionCreator';
import { fetchTopics, fetchDifficultyLevels } from '../services/api';
import Button from './ui/Button';
import Input from './ui/Input';
import Alert from './ui/Alert';
import Modal from './ui/Modal';
import Spinner from './ui/Spinner';
import LoadingOverlay from './ui/LoadingOverlay';

const AIQuestionGenerator = ({ onQuestionsGenerated, onClose }) => {
  const { isVoiceModeEnabled, speak } = useVoice();
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [questionCount, setQuestionCount] = useState(null);
  const [questionCountInput, setQuestionCountInput] = useState('');
  const [useAI, setUseAI] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showOCRForm, setShowOCRForm] = useState(false);
  const [showImageAnalysisForm, setShowImageAnalysisForm] = useState(false);
  const [showObjectDetectionForm, setShowObjectDetectionForm] = useState(false);
  const [manualCount, setManualCount] = useState(null);
  const [manualCountInput, setManualCountInput] = useState('');
  const [manualStep, setManualStep] = useState(0);
  const [manualQuestions, setManualQuestions] = useState([]);
  const [manualTopic, setManualTopic] = useState('');
  const [ocrQuestions, setOcrQuestions] = useState([]);
  const [visionQuestions, setVisionQuestions] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [difficultyLevels, setDifficultyLevels] = useState([]);

  useEffect(() => {
    loadTopics();
    loadDifficultyLevels();
  }, []);

  // Mantener inputs string sincronizados cuando el valor numérico cambie por stepper u otros
  useEffect(() => { setQuestionCountInput(typeof questionCount === 'number' ? String(questionCount) : ''); }, [questionCount]);
  useEffect(() => { setManualCountInput(typeof manualCount === 'number' ? String(manualCount) : ''); }, [manualCount]);

  const loadTopics = async () => {
    try {
      const topics = await fetchTopics();
      setTopics(topics);
      if (topics.length > 0) {
        setSelectedTopic(topics[0]);
      }
    } catch (error) {
      setError('Error obteniendo temas. Por favor intenta de nuevo.');
    }
  };

  const loadDifficultyLevels = async () => {
    try {
      const levels = await fetchDifficultyLevels();
      setDifficultyLevels(levels);
    } catch (error) {
      setError('No se pudieron cargar los niveles de dificultad. Por favor, intenta de nuevo más tarde.');
    }
  };

  const generateQuestions = async () => {
    if (!selectedTopic) {
      setError('Por favor selecciona un tema válido');
      return;
    }

    if (!questionCount || questionCount < 1) {
      setError('Por favor ingresa una cantidad válida de preguntas (mínimo 1)');
      return;
    }

    setLoading(true);
    setError('');
    console.log(`🤖 Iniciando generación de ${questionCount} preguntas sobre "${selectedTopic}" (dificultad: ${selectedDifficulty})...`);

    try {
      const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      if (!apiBase) {
        throw new Error('Error de configuración: URL del API no definida');
      }
      
      const token = user && user.getIdToken ? await user.getIdToken() : null;
      console.log('📡 Enviando solicitud al backend...');
      
      const response = await fetch(`${apiBase}/ai/generate-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          count: questionCount,
          useAI: useAI
        }),
      });

      console.log(`📥 Respuesta recibida con status ${response.status}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Error del servidor: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.questions || data.questions.length === 0) {
        throw new Error(data.error || 'Error desconocido al generar preguntas');
      }

      console.log(`✅ Se generaron ${data.questions.length} preguntas exitosamente`);
      
      // Guardar preguntas en Firestore y esperar confirmación exitosa
      const questionsWithMeta = data.questions.map(q => ({
        // Si las opciones existen, barajarlas y actualizar el índice de la respuesta correcta de forma robusta
        ...(() => {
          if (!Array.isArray(q.options) || typeof q.correctAnswerIndex !== 'number') return q;
          // Asociar cada opción con su índice original
          const optionsWithIndex = q.options.map((opt, idx) => ({ opt, origIdx: idx }));
          // Barajar
          for (let i = optionsWithIndex.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
          }
          // Buscar la nueva posición de la opción que era la correcta
          const newCorrectIndex = optionsWithIndex.findIndex(o => o.origIdx === q.correctAnswerIndex);
          return {
            ...q,
            options: optionsWithIndex.map(o => o.opt),
            correctAnswerIndex: newCorrectIndex
          };
        })(),
        createdBy: user?.uid || 'anon',
        createdAt: Date.now(),
        category: selectedTopic,
        difficulty: selectedDifficulty
      }));
      
      console.log('💾 Guardando preguntas en Firestore...');
      const bulkToken = user && user.getIdToken ? await user.getIdToken() : null;
      const saveResponse = await fetch(`${apiBase}/questions/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(bulkToken ? { Authorization: `Bearer ${bulkToken}` } : {})
        },
        body: JSON.stringify({ questions: questionsWithMeta })
      });
      
      const saveResult = await saveResponse.json();
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Error al guardar las preguntas en la base de datos');
      }

      console.log('✅ Preguntas guardadas exitosamente');
      
      // Solo después de guardar exitosamente, notificar al componente padre
      onQuestionsGenerated(data.questions);
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      setError(error.message || 'Error al generar preguntas. Por favor, intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  // Mantener vacío por defecto; no autocompletar cantidad

  return (
    <Modal open={true} title="🤖 Generador de Preguntas" onClose={onClose}>
      {isVoiceModeEnabled && (!showManualForm && !showOCRForm && !showImageAnalysisForm && !showObjectDetectionForm) && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={async () => {
              const parts = [];
              if (!showManualForm && !useAI) {
                parts.push('Estás en el generador de preguntas.');
                parts.push('Botón Crear con IA: genera preguntas automáticamente usando inteligencia artificial.');
                parts.push('Botón Escribir preguntas: te permite escribir preguntas manualmente.');
                parts.push('Selecciona una opción para continuar.');
              } else if (useAI && !showManualForm) {
                parts.push('Formulario para generar preguntas con inteligencia artificial.');
                parts.push('Campo Tema: selecciona el tema de las preguntas.');
                parts.push('Campo Dificultad: elige la dificultad.');
                parts.push('Campo Cantidad: indica cuántas preguntas quieres generar.');
                parts.push('Botón Crear preguntas: genera las preguntas.');
                parts.push('Botón Atrás: vuelve a la pantalla anterior.');
              }
              await speak(parts.join(' '), { action: 'page_guide', questionId: 'ai_question_generator', force: true });
            }}
            aria-label="Explicar la página"
            onFocus={() => speak('Explicar página: describe la función de cada botón y campo en esta vista.', { force: true })}
            onMouseEnter={() => speak('Explicar página: describe la función de cada botón y campo en esta vista.', { force: true })}
          >
            🛈 Explicar página
          </Button>
        </div>
      )}
      {loading && <LoadingOverlay text="Generando…" mobileOnly />}
      {error && <Alert intent="error">{error}</Alert>}
      {statusMessage && <Alert intent="success">{statusMessage}</Alert>}
      {!showManualForm && !useAI && !showOCRForm && !showImageAnalysisForm && !showObjectDetectionForm && (
        <div className="flex flex-col gap-3">
          <Button
            onClick={() => {
              setUseAI(true);
              setShowManualForm(false);
              setShowOCRForm(false);
              setShowImageAnalysisForm(false);
              setShowObjectDetectionForm(false);
            }}
            size="lg"
            onFocus={() => isVoiceModeEnabled && speak('Crear con IA: genera preguntas automáticamente usando inteligencia artificial.', { force: true })}
            onMouseEnter={() => isVoiceModeEnabled && speak('Crear con IA: genera preguntas automáticamente usando inteligencia artificial.', { force: true })}
          >
            🤖 Crear con IA
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setShowManualForm(true);
              setUseAI(false);
              setShowOCRForm(false);
              setShowImageAnalysisForm(false);
              setShowObjectDetectionForm(false);
              setManualStep(0);
              setManualQuestions([]);
            }}
            onFocus={() => isVoiceModeEnabled && speak('Escribir preguntas: te permite escribir preguntas manualmente.', { force: true })}
            onMouseEnter={() => isVoiceModeEnabled && speak('Escribir preguntas: te permite escribir preguntas manualmente.', { force: true })}
          >
            ✏️ Escribir preguntas
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => { setShowOCRForm(true); setUseAI(false); setShowImageAnalysisForm(false); setShowObjectDetectionForm(false); }}
            onFocus={() => isVoiceModeEnabled && speak('Capturar pregunta: extrae preguntas de imágenes usando OCR.', { force: true })}
            onMouseEnter={() => isVoiceModeEnabled && speak('Capturar pregunta: extrae preguntas de imágenes usando OCR.', { force: true })}
          >
            📸 Capturar pregunta
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setShowImageAnalysisForm(true);
              setUseAI(false);
              setShowManualForm(false);
              setShowOCRForm(false);
              setShowObjectDetectionForm(false);
            }}
            onFocus={() => isVoiceModeEnabled && speak('Analizar imagen: genera preguntas automáticamente usando Azure Computer Vision.', { force: true })}
            onMouseEnter={() => isVoiceModeEnabled && speak('Analizar imagen: genera preguntas automáticamente usando Azure Computer Vision.', { force: true })}
          >
            🖼️ Analizar imagen
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => {
              setShowObjectDetectionForm(true);
              setUseAI(false);
              setShowManualForm(false);
              setShowOCRForm(false);
              setShowImageAnalysisForm(false);
            }}
            onFocus={() => isVoiceModeEnabled && speak('Detectar objetos: crea preguntas interactivas identificando objetos específicos en imágenes.', { force: true })}
            onMouseEnter={() => isVoiceModeEnabled && speak('Detectar objetos: crea preguntas interactivas identificando objetos específicos en imágenes.', { force: true })}
          >
            🎯 Detectar objetos
          </Button>
        </div>
      )}
      {!showManualForm && useAI && !showOCRForm && (
        <form
          className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await generateQuestions();
          }}
        >
          <div>
            <label htmlFor="topic" className="block mb-1 text-sm text-white/80">Tema</label>
            <select
              id="topic"
              className="block w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-md focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30 focus:outline-none"
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              disabled={topics.length === 0}
            >
              {topics.length === 0 ? (
                <option value="">No hay temas</option>
              ) : (
                topics.map(topic => (
                  <option key={topic} value={topic}>{topic}</option>
                ))
              )}
            </select>
          </div>
          <div>
            <label htmlFor="difficulty" className="block mb-1 text-sm text-white/80">Dificultad</label>
            <select
              id="difficulty"
              className="block w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-md focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30 focus:outline-none"
              value={selectedDifficulty}
              onChange={(e) => setSelectedDifficulty(e.target.value)}
            >
              <option value="easy">Fácil</option>
              <option value="medium">Media</option>
              <option value="hard">Difícil</option>
            </select>
          </div>
          <div>
            <label htmlFor="numQuestions" className="block mb-1 text-sm text-white/80">Cantidad</label>
              <div>
                <Input
                id="numQuestions"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={questionCountInput}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D+/g, '')
                  setQuestionCountInput(digits)
                  const num = digits ? parseInt(digits, 10) : NaN
                  if (!Number.isNaN(num)) setQuestionCount(num); else setQuestionCount(null)
                }}
                onBlur={() => {
                  const num = parseInt(questionCountInput || '', 10)
                  if (Number.isNaN(num) || num < 1) {
                    setQuestionCount(null)
                    setQuestionCountInput('')
                    return
                  }
                  const normalized = Math.max(1, num)
                  setQuestionCount(normalized)
                  setQuestionCountInput(String(normalized))
                }}
                required
                placeholder="Cantidad"
                className="w-28 text-center"
              />
              {(questionCountInput === '' || questionCount === null) && (
                <div className={`mt-1 text-xs ${questionCountInput === '' ? 'text-white/60' : 'text-red-300'}`}>
                  {questionCountInput === '' ? 'Ingresa un número (>= 1)' : 'Valor inválido'}
                </div>
              )}
              </div>
          </div>
          {error && <Alert intent="error" className="sm:col-span-3">{error}</Alert>}
          <div className="sm:col-span-3 mt-2 flex flex-wrap gap-3 justify-end items-center">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setUseAI(false)}
              disabled={loading}
              onFocus={() => isVoiceModeEnabled && speak('Atrás: vuelve a la pantalla anterior.', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Atrás: vuelve a la pantalla anterior.', { force: true })}
            >
              Atrás
            </Button>
            <Button
              type="submit"
              disabled={loading || !selectedTopic || questionCount === null}
              title={!selectedTopic ? 'Selecciona un tema' : questionCount === null ? 'Ingresa la cantidad de preguntas' : 'Crear preguntas'}
              onFocus={() => isVoiceModeEnabled && speak('Crear preguntas: genera las preguntas con inteligencia artificial.', { force: true })}
              onMouseEnter={() => isVoiceModeEnabled && speak('Crear preguntas: genera las preguntas con inteligencia artificial.', { force: true })}
            >
              {loading ? (<><Spinner size={16} className="mr-2" />Creando…</>) : 'Crear preguntas'}
            </Button>
          </div>
        </form>
      )}
      {showManualForm && (
        <div className="mt-2">
          {manualStep === 0 ? (
            <form
              className="grid grid-cols-1 gap-4"
              onSubmit={e => { e.preventDefault(); setManualStep(1); setManualQuestions([]); setManualTopic(selectedTopic); }}
            >
              <div>
                <label className="block mb-1 text-sm text-white/80">Tema</label>
                <select
                  value={selectedTopic}
                  onChange={e => setSelectedTopic(e.target.value)}
                  className="block w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-md focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30 focus:outline-none"
                >
                  {topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm text-white/80">¿Cuántas preguntas?</label>
                <div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={manualCountInput}
                    onChange={e => {
                      const digits = e.target.value.replace(/\D+/g, '')
                      setManualCountInput(digits)
                      const num = digits ? parseInt(digits, 10) : NaN
                      if (!Number.isNaN(num)) setManualCount(num); else setManualCount(null)
                    }}
                    onBlur={() => {
                      const num = parseInt(manualCountInput || '', 10)
                      if (Number.isNaN(num) || num < 1) {
                        setManualCount(null)
                        setManualCountInput('')
                        return
                      }
                      const normalized = Math.max(1, num)
                      setManualCount(normalized)
                      setManualCountInput(String(normalized))
                    }}
                    required
                    placeholder="Cantidad"
                    className="w-28 text-center"
                  />
                  {(manualCountInput === '' || manualCount === null) && (
                    <div className={`mt-1 text-xs ${manualCountInput === '' ? 'text-white/60' : 'text-red-300'}`}>
                      {manualCountInput === '' ? 'Ingresa un número (>= 1)' : 'Valor inválido'}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowManualForm(false)}
                  onFocus={() => isVoiceModeEnabled && speak('Volver: cierra el formulario de preguntas manuales y regresa a la pantalla anterior.', { force: true })}
                  onMouseEnter={() => isVoiceModeEnabled && speak('Volver: cierra el formulario de preguntas manuales y regresa a la pantalla anterior.', { force: true })}
                >
                  Volver
                </Button>
                <Button
                  type="submit"
                  onFocus={() => isVoiceModeEnabled && speak('Empezar: inicia la creación manual de preguntas.', { force: true })}
                  onMouseEnter={() => isVoiceModeEnabled && speak('Empezar: inicia la creación manual de preguntas.', { force: true })}
                >
                  Empezar
                </Button>
              </div>
            </form>
          ) : (
            <div>
              <div className="text-center mb-3 font-bold">¡Vamos! Pregunta {manualQuestions.length + 1} de {manualCount}</div>
              <ManualQuestionForm
                topics={[manualTopic]}
                onQuestionCreated={async (q) => {
                                    // q is the payload prepared by the child
                                    try {
                                      setLoading(true);
                                      setError('');

                                      const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                                      if (!apiBase) {
                                        throw new Error('Error de configuración: URL del API no definida');
                                      }
                                      if (!user || !user.getIdToken) {
                                        throw new Error('Debes iniciar sesión para crear preguntas');
                                      }
                                      const token = await user.getIdToken();

                                      // Save single question
                                      const response = await fetch(`${apiBase}/questions`, {
                                        method: 'POST',
                                        headers: {
                                          'Content-Type': 'application/json',
                                          Authorization: `Bearer ${token}`
                                        },
                                        body: JSON.stringify(q)
                                      });

                                      const data = await response.json();
                                      if (!response.ok) {
                                        throw new Error(data.error || 'Error al guardar la pregunta');
                                      }

                                      const saved = data.question || { ...q };
                                      const next = [...manualQuestions, { ...saved, category: manualTopic }];

                                      // If last question, bulk save (server may already store them individually, but keep compatibility)
                                      if (next.length === manualCount) {
                                        // Do a bulk save to keep existing API usage
                                        const bulkResp = await fetch(`${apiBase}/questions/bulk`, {
                                          method: 'POST',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${token}`
                                          },
                                          body: JSON.stringify({ questions: next })
                                        });
                                        const bulkData = await bulkResp.json();
                                        if (!bulkResp.ok) {
                                          throw new Error(bulkData.error || 'Error al guardar las preguntas en lote');
                                        }

                                        if (onQuestionsGenerated) {
                                          onQuestionsGenerated(next);
                                        }

                                        setStatusMessage('¡Todas las preguntas han sido guardadas exitosamente!');
                                        setTimeout(() => {
                                          setShowManualForm(false);
                                          setStatusMessage('');
                                        }, 1500);
                                        return next;
                                      } else {
                                        setManualQuestions(next);
                                        setManualStep(prev => prev + 1);
                                        setStatusMessage(`¡Pregunta ${next.length} de ${manualCount} guardada exitosamente!`);
                                        setTimeout(() => setStatusMessage(''), 1500);
                                        return saved;
                                      }
                                    } catch (error) {
                                      setError('No se pudo guardar la pregunta: ' + (error.message || 'Por favor, intenta de nuevo.'));
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  onCancel={() => { setShowManualForm(false); }}
                                />
            </div>
          )}
        </div>
      )}
      {showOCRForm && (
        <OCRQuestionCapture
          topics={topics}
          onQuestionExtracted={async (questionPayload) => {
            setLoading(true);
            setError('');
            try {
              const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
              const token = user && user.getIdToken ? await user.getIdToken() : null;
              const response = await fetch(`${apiBase}/questions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(questionPayload)
              });

              if (response.ok) {
                const result = await response.json();
                const savedQuestion = result.question || { ...questionPayload };
                const updatedQuestions = [...ocrQuestions, savedQuestion];
                setOcrQuestions(updatedQuestions);
                
                setStatusMessage(`✅ Pregunta ${updatedQuestions.length} guardada exitosamente. Puedes agregar más o finalizar.`);
                setLoading(false);
                
                // Mantener modal abierto para agregar más preguntas
                // No cierra automáticamente después de guardar
              } else {
                setError('No se pudo guardar la pregunta');
                setLoading(false);
              }
            } catch (error) {
              setError('Error al guardar la pregunta: ' + (error.message || 'Por favor, intenta de nuevo.'));
              setLoading(false);
            }
          }}
          onCancel={() => { 
            setShowOCRForm(false);
            
            // Si hay preguntas guardadas, notifica al parent
            if (ocrQuestions.length > 0) {
              setStatusMessage(`✅ Se guardaron ${ocrQuestions.length} pregunta(s) de OCR`);
              
              setTimeout(() => {
                onQuestionsGenerated(ocrQuestions);
                setOcrQuestions([]);
                setStatusMessage('');
              }, 1500);
            }
          }}
        />
      )}
      {showImageAnalysisForm && (
        <ImageAnalysisQuestionCreator
          topics={topics}
          onQuestionCreated={async (questionPayload) => {
            setLoading(true);
            setError('');
            try {
              const apiBase =
                (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) ||
                import.meta.env.VITE_API_URL ||
                'http://localhost:5000/api';
              const token = user && user.getIdToken ? await user.getIdToken() : null;
              const response = await fetch(`${apiBase}/questions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(questionPayload)
              });
              const result = await response.json();
              if (!response.ok) {
                throw new Error(result.error || 'No se pudo guardar la pregunta');
              }
              const savedQuestion = result.question || { ...questionPayload };
              const updated = [...visionQuestions, savedQuestion];
              setVisionQuestions(updated);
              setStatusMessage(`✅ Pregunta ${updated.length} guardada desde análisis de imagen`);
              return savedQuestion;
            } catch (err) {
              setError('Error al guardar la pregunta: ' + (err.message || 'Intenta de nuevo.'));
              throw err;
            } finally {
              setLoading(false);
            }
          }}
          onCancel={() => {
            setShowImageAnalysisForm(false);
            if (visionQuestions.length > 0) {
              setStatusMessage(`✅ Se guardaron ${visionQuestions.length} pregunta(s) desde análisis de imagen`);
              setTimeout(() => {
                onQuestionsGenerated(visionQuestions);
                setVisionQuestions([]);
                setStatusMessage('');
              }, 1500);
            }
          }}
        />
      )}
      {showObjectDetectionForm && (
        <ObjectDetectionQuestionCreator
          topics={topics}
          onQuestionCreated={async (questionPayload) => {
            setLoading(true);
            setError('');
            try {
              const apiBase =
                (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) ||
                import.meta.env.VITE_API_URL ||
                'http://localhost:5000/api';
              const token = user && user.getIdToken ? await user.getIdToken() : null;
              const response = await fetch(`${apiBase}/questions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {})
                },
                body: JSON.stringify(questionPayload)
              });
              const result = await response.json();
              if (!response.ok) {
                throw new Error(result.error || 'No se pudo guardar la pregunta');
              }
              const savedQuestion = result.question || { ...questionPayload };
              const updated = [...visionQuestions, savedQuestion];
              setVisionQuestions(updated);
              setStatusMessage(`✅ Pregunta guardada. Puedes crear otra o finalizar.`);
              // NO cerrar el formulario - permitir crear múltiples preguntas
              // setShowObjectDetectionForm(false); <- ELIMINADO
              
              setTimeout(() => {
                setStatusMessage('');
              }, 2000);
              
              return savedQuestion;
            } catch (err) {
              setError('Error al guardar la pregunta: ' + (err.message || 'Intenta de nuevo.'));
              throw err;
            } finally {
              setLoading(false);
            }
          }}
          onCancel={() => {
            // Cuando el usuario cancela, finalizamos con todas las preguntas acumuladas
            setShowObjectDetectionForm(false);
            setTimeout(() => {
              onQuestionsGenerated(visionQuestions);
              setVisionQuestions([]);
              setStatusMessage('');
            }, 300);
          }}
        />
      )}
    </Modal>
  );
}

export default AIQuestionGenerator;