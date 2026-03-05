import React, { useState, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { useVoice } from '../VoiceContext';
import Button from './ui/Button';
import Input from './ui/Input';
import Alert from './ui/Alert';
import Spinner from './ui/Spinner';
import Badge from './ui/Badge';

const MAX_IMAGE_SIZE = 4 * 1024 * 1024; // 4MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Imagen que se guarda dentro de la pregunta (y se replica en el documento de la partida)
// Mantenerla pequeña evita que los documentos de Firestore superen el límite de 1 MB.
const MAX_GAME_IMAGE_BYTES = 80 * 1024; // ~80KB por imagen

const INITIAL_OPTIONS = ['', '', '', ''];

const buildUniqueList = (items = []) => {
  const seen = new Set();
  return items.filter(item => {
    const key = item?.toLowerCase?.() || item;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function capitalize(text = '') {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const getBase64PayloadBytes = (base64 = '') => {
  if (!base64 || typeof base64 !== 'string') return 0;
  const payload = base64.includes(',') ? base64.split(',')[1] : base64;
  // Fórmula estándar para estimar bytes reales a partir de base64
  return Math.floor((payload.length * 3) / 4);
};

const loadImageElement = (dataUrl) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });

// Reduce resolución/calidad hasta que el base64 quede por debajo de maxBytes
const downscaleBase64 = async (dataUrl, maxBytes, maxDimension = 640) => {
  const image = await loadImageElement(dataUrl);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const qualities = [0.8, 0.7, 0.6, 0.5, 0.4];
  for (const quality of qualities) {
    const output = canvas.toDataURL('image/jpeg', quality);
    if (getBase64PayloadBytes(output) <= maxBytes) {
      return output;
    }
  }
  return canvas.toDataURL('image/jpeg', 0.35);
};

const ensureBase64UnderLimit = async (dataUrl, maxBytes = MAX_GAME_IMAGE_BYTES) => {
  if (!dataUrl) return dataUrl;
  if (getBase64PayloadBytes(dataUrl) <= maxBytes) {
    return dataUrl;
  }
  try {
    return await downscaleBase64(dataUrl, maxBytes);
  } catch {
    // Si algo falla al comprimir, devolvemos la original (peor de los casos)
    return dataUrl;
  }
};

const ImageAnalysisQuestionCreator = ({ topics = [], onQuestionCreated, onCancel }) => {
  const { user } = useAuth();
  const { isVoiceModeEnabled, speak } = useVoice();
  const fileInputRef = useRef(null);
  const apiBase =
    (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) ||
    import.meta.env.VITE_API_URL ||
    'http://localhost:5000/api';

  const [selectedTopic, setSelectedTopic] = useState(topics[0] || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [questionSuggestions, setQuestionSuggestions] = useState(null);
  const [questionDraft, setQuestionDraft] = useState({
    text: '',
    options: [...INITIAL_OPTIONS],
    correctIndex: 0,
    explanation: '',
    imageBase64: ''
  });
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const validateFile = (file) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Formato inválido. Usa JPG, PNG o WebP.';
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return 'La imagen debe ser menor a 4MB.';
    }
    return null;
  };

  const readFileAsDataURL = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      const preview = await readFileAsDataURL(file);
      // Comprimir la imagen para que sea segura de guardar/reutilizar en partidas
      const optimized = await ensureBase64UnderLimit(preview);

      setImageFile(file);
      setImagePreview(preview);
      setAnalysis(null);
      setQuestionSuggestions(null);
      setQuestionDraft({
        text: '',
        options: [...INITIAL_OPTIONS],
        correctIndex: 0,
        explanation: '',
        imageBase64: optimized
      });
      setError('');
      setSuccessMessage('');
      setJustSaved(false);
      if (isVoiceModeEnabled) {
        speak('Imagen seleccionada. Ahora pulsa analizar imagen para obtener una sugerencia de pregunta.', {
          force: false,
          action: 'image_selected'
        });
      }
    } catch (err) {
      setError(err.message);
      if (isVoiceModeEnabled) {
        speak(`Error al leer la imagen: ${err.message}`, {
          force: false,
          action: 'image_error'
        });
      }
    }
  };

  const analyzeImage = async () => {
    if (!apiBase) {
      setError('Configura la variable VITE_API_URL para usar esta función.');
      return;
    }
    if (!imageFile || !imagePreview) {
      setError('Selecciona una imagen válida antes de analizar.');
      return;
    }

    setAnalyzing(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = user && user.getIdToken ? await user.getIdToken() : null;
      const response = await fetch(`${apiBase}/vision/analyze-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          imageBase64: imagePreview,
          mimeType: imageFile.type,
          language: 'es'
        })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error analizando la imagen');
      }
      setAnalysis(data.analysis);
      setQuestionSuggestions(data.questionSuggestions || null);
      // Usar siempre la versión comprimida que ya guardamos en questionDraft
      autoPopulateDraft(
        data.analysis,
        data.questionSuggestions,
        questionDraft.imageBase64 || imagePreview
      );
      setSuccessMessage('Imagen analizada exitosamente');

      if (isVoiceModeEnabled) {
        const caption = data.analysis?.description?.primary?.text;
        const spoken = caption
          ? `Análisis completo. Descripción principal: ${caption}. Ahora revisa la pregunta sugerida y las opciones antes de guardar.`
          : 'Análisis completo. Ahora revisa la pregunta sugerida y las opciones antes de guardar.';
        speak(spoken, { force: false, action: 'image_analysis_done' });
      }
    } catch (err) {
      const message = err.message || 'No se pudo analizar la imagen';
      setError(message);
      if (isVoiceModeEnabled) {
        speak(`Error al analizar la imagen: ${message}`, {
          force: false,
          action: 'image_analysis_error'
        });
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const autoPopulateDraft = (analysisResult, suggestions, imageBase64) => {
    const primaryCaption = analysisResult?.description?.primary?.text;
    const baseQuestion = suggestions?.question
      ? suggestions.question
      : primaryCaption
        ? '¿Qué describe mejor esta imagen?'
        : '¿Qué se muestra en la imagen?';

    const tagNames = (analysisResult?.tags || []).map(tag => tag.name).filter(Boolean);
    const objectNames = (analysisResult?.objects || []).map(obj => obj.name).filter(Boolean);
    const suggestionOptions = suggestions?.options || [];
    const mergedOptions = buildUniqueList([
      ...suggestionOptions,
      ...tagNames,
      ...objectNames
    ]).map(capitalize);

    while (mergedOptions.length < 4) {
      mergedOptions.push('');
    }

    const trimmedOptions = mergedOptions.slice(0, 4);
    const suggestedAnswer = suggestions?.suggestedAnswer || trimmedOptions[0];
    const suggestedIndex = trimmedOptions.findIndex(opt => opt && opt.toLowerCase() === (suggestedAnswer || '').toLowerCase());

    setQuestionDraft({
      text: baseQuestion,
      options: trimmedOptions,
      correctIndex: suggestedIndex >= 0 ? suggestedIndex : 0,
      explanation: suggestions?.descriptionContext
        ? `Contexto: ${suggestions.descriptionContext}`
        : 'Pregunta generada a partir del análisis de la imagen.',
      imageBase64: imageBase64
    });
    if (!selectedTopic && topics.length > 0) {
      setSelectedTopic(topics[0]);
    }
  };

  const handleOptionChange = (idx, value) => {
    setJustSaved(false);
    setQuestionDraft(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => (i === idx ? value : opt))
    }));
  };

  const validateQuestionDraft = () => {
    if (!questionDraft.text.trim()) {
      return 'Escribe la pregunta sugerida antes de guardar.';
    }
    const filledOptions = questionDraft.options.filter(opt => opt.trim());
    if (filledOptions.length < 2) {
      return 'Completa al menos 2 opciones de respuesta.';
    }
    if (!questionDraft.options[questionDraft.correctIndex]?.trim()) {
      return 'Selecciona una respuesta correcta válida.';
    }
    if (!selectedTopic) {
      return 'Selecciona un tema para la pregunta.';
    }
    return '';
  };

  const handleSaveQuestion = async () => {
    const validationError = validateQuestionDraft();
    if (validationError) {
      setError(validationError);
      if (isVoiceModeEnabled) {
        speak(validationError, { force: false, action: 'image_question_validation_error' });
      }
      return;
    }

    if (!onQuestionCreated) {
      setError('No se proporcionó manejador para guardar la pregunta.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccessMessage('');

    const payload = {
      text: questionDraft.text.trim(),
      options: questionDraft.options.map(opt => opt.trim()),
      correctAnswerIndex: questionDraft.correctIndex,
      category: selectedTopic,
      explanation: questionDraft.explanation || '',
      imageBase64: questionDraft.imageBase64,
      imageAnalysis: analysis
    };

    try {
      await Promise.resolve(onQuestionCreated(payload));
      setSuccessMessage('Pregunta generada y enviada correctamente.');
      setJustSaved(true);
      if (isVoiceModeEnabled) {
        speak('Pregunta guardada exitosamente. Puedes crear otra pregunta con esta imagen o volver al panel.', {
          force: false,
          action: 'image_question_saved'
        });
      }
      // Permitir crear más preguntas sin cerrar el flujo
      setTimeout(() => setSuccessMessage(''), 2000);
      setTimeout(() => setJustSaved(false), 3000);
    } catch (err) {
      setError(err.message || 'No se pudo guardar la pregunta');
      setJustSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const resetFlow = () => {
    setImageFile(null);
    setImagePreview('');
    setAnalysis(null);
    setQuestionSuggestions(null);
    setQuestionDraft({
      text: '',
      options: [...INITIAL_OPTIONS],
      correctIndex: 0,
      explanation: '',
      imageBase64: ''
    });
    setError('');
    setSuccessMessage('');
    setJustSaved(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="grid gap-4 p-4">
      {isVoiceModeEnabled && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={async () => {
              const script = [
                'Sube una imagen relacionada con tu pregunta.',
                'Haz clic en Analizar imagen para obtener descripciones, etiquetas y objetos detectados.',
                'Edita la pregunta sugerida y las opciones antes de guardar.',
                'Al finalizar, guarda la pregunta o vuelve atrás.'
              ];
              await speak(script.join(' '), { force: true, action: 'image_analysis_help' });
            }}
            onMouseEnter={() => isVoiceModeEnabled && speak('Explicar flujo: describe cómo usar esta herramienta para crear preguntas desde imágenes.', { force: true })}
            onFocus={() => isVoiceModeEnabled && speak('Explicar flujo: describe cómo usar esta herramienta para crear preguntas desde imágenes.', { force: true })}
          >
            🛈 Explicar flujo
          </Button>
        </div>
      )}

      {error && <Alert intent="error">{error}</Alert>}
      {successMessage && <Alert intent="success">{successMessage}</Alert>}

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h3 className="text-lg font-bold">1. Subir imagen</h3>
        <label
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/20 bg-white/5 px-4 py-10 text-center text-sm text-white/70 hover:border-bb-primary/60 hover:bg-white/10 transition cursor-pointer"
          onMouseEnter={() => isVoiceModeEnabled && speak(imagePreview ? 'Imagen seleccionada. Haz clic para cambiar la imagen.' : 'Área de subida de imagen. Haz clic o arrastra una imagen JPG, PNG o WebP de máximo 4 megabytes.', { force: true })}
          onFocus={() => isVoiceModeEnabled && speak(imagePreview ? 'Imagen seleccionada. Haz clic para cambiar la imagen.' : 'Área de subida de imagen. Haz clic o arrastra una imagen JPG, PNG o WebP de máximo 4 megabytes.', { force: true })}
        >
          {imagePreview ? (
            <img src={imagePreview} alt="Vista previa" className="max-h-64 rounded-lg object-contain" />
          ) : (
            <>
              <span className="text-2xl">🖼️</span>
              <span>Haz clic o arrastra una imagen (JPG, PNG, WebP, máx. 4MB)</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            disabled={!imageFile || analyzing}
            onClick={analyzeImage}
            onMouseEnter={() => isVoiceModeEnabled && !analyzing && speak('Analizar imagen: analiza la imagen con inteligencia artificial para generar descripciones, etiquetas y sugerencias de pregunta.', { force: true })}
            onFocus={() => isVoiceModeEnabled && !analyzing && speak('Analizar imagen: analiza la imagen con inteligencia artificial para generar descripciones, etiquetas y sugerencias de pregunta.', { force: true })}
          >
            {analyzing ? (
              <>
                <Spinner size={16} className="mr-2" />
                Analizando…
              </>
            ) : '🔍 Analizar imagen'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!imageFile || analyzing}
            onClick={resetFlow}
            onMouseEnter={() => isVoiceModeEnabled && speak('Limpiar: elimina la imagen y el análisis actual para empezar de nuevo.', { force: true })}
            onFocus={() => isVoiceModeEnabled && speak('Limpiar: elimina la imagen y el análisis actual para empezar de nuevo.', { force: true })}
          >
            Limpiar
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            onMouseEnter={() => isVoiceModeEnabled && speak('Volver: cierra esta herramienta y regresa al generador de preguntas.', { force: true })}
            onFocus={() => isVoiceModeEnabled && speak('Volver: cierra esta herramienta y regresa al generador de preguntas.', { force: true })}
          >
            Volver
          </Button>
        </div>
      </div>

      {analysis && (
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-bold">2. Resultados del análisis</h3>
          {analysis?.description?.primary?.text && (
            <div 
              className="rounded-xl border border-white/10 bg-bb-primary/10 p-3"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Descripción principal: ${analysis.description.primary.text}. Confianza: ${(analysis.description.primary.confidence * 100).toFixed(1)} por ciento.`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Descripción principal: ${analysis.description.primary.text}. Confianza: ${(analysis.description.primary.confidence * 100).toFixed(1)} por ciento.`, { force: true })}
              tabIndex={0}
              role="region"
              aria-label="Descripción principal del análisis"
            >
              <p className="text-sm text-white/70 uppercase tracking-wide">Descripción principal</p>
              <p className="text-base font-semibold text-white mt-1">{analysis.description.primary.text}</p>
              <p className="text-xs text-white/60 mt-1">
                Confianza: {(analysis.description.primary.confidence * 100).toFixed(1)}%
              </p>
            </div>
          )}

          {analysis.tags?.length > 0 && (
            <div 
              className="grid gap-2"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Tags detectados: ${analysis.tags.map(t => `${t.name} con ${(t.confidence * 100).toFixed(0)} por ciento de confianza`).join(', ')}.`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Tags detectados: ${analysis.tags.map(t => `${t.name} con ${(t.confidence * 100).toFixed(0)} por ciento de confianza`).join(', ')}.`, { force: true })}
              tabIndex={0}
              role="region"
              aria-label="Tags detectados"
            >
              <p className="text-sm text-white/70 font-semibold">Tags detectados</p>
              <div className="flex flex-wrap gap-2">
                {analysis.tags.map(tag => (
                  <Badge key={tag.name} variant="primary">
                    {tag.name} • {(tag.confidence * 100).toFixed(0)}%
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.categories?.length > 0 && (
            <div 
              className="grid gap-1"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Categorías detectadas: ${analysis.categories.map(c => `${c.name} con ${(c.confidence * 100).toFixed(1)} por ciento`).join(', ')}.`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Categorías detectadas: ${analysis.categories.map(c => `${c.name} con ${(c.confidence * 100).toFixed(1)} por ciento`).join(', ')}.`, { force: true })}
              tabIndex={0}
              role="region"
              aria-label="Categorías detectadas"
            >
              <p className="text-sm text-white/70 font-semibold">Categorías</p>
              {analysis.categories.map(cat => (
                <p key={cat.name} className="text-sm text-white/80">
                  {cat.name} ({(cat.confidence * 100).toFixed(1)}%)
                </p>
              ))}
            </div>
          )}

          {analysis.objectSummary?.length > 0 && (
            <div 
              className="grid gap-1"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Objetos detectados: ${analysis.objectSummary.map(o => `${capitalize(o.name)} ${o.count} ${o.count === 1 ? 'vez' : 'veces'}`).join(', ')}.`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Objetos detectados: ${analysis.objectSummary.map(o => `${capitalize(o.name)} ${o.count} ${o.count === 1 ? 'vez' : 'veces'}`).join(', ')}.`, { force: true })}
              tabIndex={0}
              role="region"
              aria-label="Objetos detectados"
            >
              <p className="text-sm text-white/70 font-semibold">Objetos detectados</p>
              {analysis.objectSummary.map(obj => (
                <p key={obj.name} className="text-sm text-white/80">
                  {capitalize(obj.name)} • {obj.count} {obj.count === 1 ? 'vez' : 'veces'}
                </p>
              ))}
            </div>
          )}

          {analysis.colors && (
            <div 
              className="grid gap-2"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Colores dominantes: ${(analysis.colors.dominantColors || []).join(', ')}. ${analysis.colors.accentColor ? `Color de acento: ${analysis.colors.accentColor}.` : ''}`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Colores dominantes: ${(analysis.colors.dominantColors || []).join(', ')}. ${analysis.colors.accentColor ? `Color de acento: ${analysis.colors.accentColor}.` : ''}`, { force: true })}
              tabIndex={0}
              role="region"
              aria-label="Colores dominantes"
            >
              <p className="text-sm text-white/70 font-semibold">Colores dominantes</p>
              <div className="flex flex-wrap gap-2">
                {(analysis.colors.dominantColors || []).map(color => (
                  <span
                    key={color}
                    className="px-3 py-1 text-xs font-semibold rounded-full border border-white/10 bg-white/10 text-white/80"
                  >
                    {color}
                  </span>
                ))}
                {analysis.colors.accentColor && (
                  <span className="flex items-center gap-2 text-xs text-white/80">
                    Acento:
                    <span
                      className="inline-flex h-4 w-4 rounded-full border border-white/40"
                      style={{ backgroundColor: `#${analysis.colors.accentColor}` }}
                    />
                    #{analysis.colors.accentColor}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {analysis && (
        <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-lg font-bold">3. Generar pregunta</h3>
          {questionSuggestions && (
            <div 
              className="rounded-xl border border-bb-primary/40 bg-bb-primary/10 p-3 text-sm text-white/80"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Sugerencia de pregunta: ${questionSuggestions.question}. ${questionSuggestions.descriptionContext ? `Contexto: ${questionSuggestions.descriptionContext}.` : ''} ${questionSuggestions.categorySuggestion ? `Categoría sugerida: ${questionSuggestions.categorySuggestion}.` : ''}`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Sugerencia de pregunta: ${questionSuggestions.question}. ${questionSuggestions.descriptionContext ? `Contexto: ${questionSuggestions.descriptionContext}.` : ''} ${questionSuggestions.categorySuggestion ? `Categoría sugerida: ${questionSuggestions.categorySuggestion}.` : ''}`, { force: true })}
              tabIndex={0}
              role="region"
              aria-label="Sugerencia de pregunta"
            >
              <p className="font-semibold">Sugerencia:</p>
              <ul className="list-disc pl-5 space-y-1 mt-1">
                <li>Pregunta base: {questionSuggestions.question}</li>
                {questionSuggestions.descriptionContext && (
                  <li>Contexto: {questionSuggestions.descriptionContext}</li>
                )}
                {questionSuggestions.categorySuggestion && (
                  <li>Categoría sugerida: {questionSuggestions.categorySuggestion}</li>
                )}
              </ul>
            </div>
          )}

          <div className="grid gap-3">
            <label className="text-sm text-white/70 font-semibold">Tema</label>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="rounded-xl border-2 border-white/10 bg-white/5 px-4 py-2 text-white focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Tema: selecciona el tema de la pregunta. Tema actual: ${selectedTopic}.`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Tema: selecciona el tema de la pregunta. Tema actual: ${selectedTopic}.`, { force: true })}
            >
              {topics.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-white/70 font-semibold">Pregunta propuesta</label>
            <textarea
              value={questionDraft.text}
              onChange={(e) => {
                setJustSaved(false);
                setQuestionDraft(prev => ({ ...prev, text: e.target.value }));
              }}
              rows={3}
              className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-2 text-white focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30"
              placeholder="¿Qué se muestra en la imagen?"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Pregunta propuesta: edita el texto de la pregunta. ${questionDraft.text ? `Texto actual: ${questionDraft.text}` : 'Campo vacío, escribe la pregunta aquí.'}`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Pregunta propuesta: edita el texto de la pregunta. ${questionDraft.text ? `Texto actual: ${questionDraft.text}` : 'Campo vacío, escribe la pregunta aquí.'}`, { force: true })}
            />
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-white/70 font-semibold">Opciones de respuesta</label>
              <span className="text-xs text-white/50">Marca la correcta</span>
            </div>
            <div className="grid gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
              {questionDraft.options.map((option, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-bb-primary min-w-[2rem]">
                    {String.fromCharCode(65 + idx)})
                  </span>
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder="Escribe una opción…"
                    className="flex-1"
                    onMouseEnter={() => isVoiceModeEnabled && speak(`Opción ${String.fromCharCode(65 + idx)}: ${option || 'campo vacío, escribe una opción aquí.'}`, { force: true })}
                    onFocus={() => isVoiceModeEnabled && speak(`Opción ${String.fromCharCode(65 + idx)}: ${option || 'campo vacío, escribe una opción aquí.'}`, { force: true })}
                  />
                  <label 
                    className="inline-flex items-center gap-2 cursor-pointer text-xs text-white/70"
                    onMouseEnter={() => isVoiceModeEnabled && speak(`Marcar opción ${String.fromCharCode(65 + idx)} como correcta. ${questionDraft.correctIndex === idx ? 'Esta opción está marcada como correcta.' : 'Haz clic para marcar esta opción como la respuesta correcta.'}`, { force: true })}
                    onFocus={() => isVoiceModeEnabled && speak(`Marcar opción ${String.fromCharCode(65 + idx)} como correcta. ${questionDraft.correctIndex === idx ? 'Esta opción está marcada como correcta.' : 'Haz clic para marcar esta opción como la respuesta correcta.'}`, { force: true })}
                  >
                    <input
                      type="radio"
                      name="correctOption"
                      checked={questionDraft.correctIndex === idx}
                      onChange={() => {
                        setJustSaved(false);
                        setQuestionDraft(prev => ({ ...prev, correctIndex: idx }));
                      }}
                      className="h-4 w-4 accent-bb-primary cursor-pointer"
                    />
                    Correcta
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-white/70 font-semibold">Explicación (opcional)</label>
            <textarea
              value={questionDraft.explanation}
              onChange={(e) => {
                setJustSaved(false);
                setQuestionDraft(prev => ({ ...prev, explanation: e.target.value }));
              }}
              rows={2}
              className="w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-2 text-white focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30"
              placeholder="Añade un contexto o pista opcional…"
              onMouseEnter={() => isVoiceModeEnabled && speak(`Explicación opcional: añade un contexto o pista para la pregunta. ${questionDraft.explanation ? `Texto actual: ${questionDraft.explanation}` : 'Campo vacío, puedes añadir una explicación opcional.'}`, { force: true })}
              onFocus={() => isVoiceModeEnabled && speak(`Explicación opcional: añade un contexto o pista para la pregunta. ${questionDraft.explanation ? `Texto actual: ${questionDraft.explanation}` : 'Campo vacío, puedes añadir una explicación opcional.'}`, { force: true })}
            />
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleSaveQuestion}
                disabled={saving}
                onMouseEnter={() => isVoiceModeEnabled && !saving && speak('Guardar pregunta: guarda la pregunta actual con la imagen y el análisis. Puedes crear más preguntas después.', { force: true })}
                onFocus={() => isVoiceModeEnabled && !saving && speak('Guardar pregunta: guarda la pregunta actual con la imagen y el análisis. Puedes crear más preguntas después.', { force: true })}
              >
                {saving ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Guardando…
                  </>
                ) : 'Guardar pregunta'}
              </Button>
              {justSaved && (
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400 font-medium animate-in fade-in duration-300">
                  <span className="text-lg">✓</span>
                  <span>Guardado</span>
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              onMouseEnter={() => isVoiceModeEnabled && speak('Finalizar: cierra esta herramienta y regresa al generador de preguntas. Las preguntas guardadas estarán disponibles.', { force: true })}
              onFocus={() => isVoiceModeEnabled && speak('Finalizar: cierra esta herramienta y regresa al generador de preguntas. Las preguntas guardadas estarán disponibles.', { force: true })}
            >
              Finalizar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageAnalysisQuestionCreator;

