import React, { useState, useEffect, useCallback } from 'react';
import { useVoice } from '../VoiceContext';
import { useAuth } from '../AuthContext';
import Button from './ui/Button';
import Input from './ui/Input';
import Alert from './ui/Alert';

const ManualQuestionForm = ({ topics, onQuestionCreated, onCancel }) => {
  const { isVoiceModeEnabled, speak } = useVoice();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    question: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    selectedTopic: topics[0] || ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleOptionChange = (idx, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === idx ? value : opt)
    }));
  };

  const validateForm = useCallback(() => {
    if (!formData.question.trim()) {
      return 'La pregunta es requerida';
    }
    if (formData.options.some(opt => !opt.trim())) {
      return 'Todas las opciones son requeridas';
    }
    return '';
  }, [formData]);

  useEffect(() => {
    const validationError = validateForm();
    setError(validationError);
  }, [formData, user, validateForm]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      // Build payload and hand off to parent for saving. Parent will perform the network request.
      const payload = {
        text: formData.question,
        options: formData.options,
        correctAnswerIndex: formData.correctIndex,
        category: formData.selectedTopic,
        explanation: ''
      };

      setSuccessMessage('Guardando...');
      if (onQuestionCreated) {
        const result = await Promise.resolve(onQuestionCreated(payload));
        // If parent returns the saved question, show its text in the success message
        const savedText = result && result.text ? result.text : payload.text;
        setSuccessMessage(`Pregunta creada: "${savedText}"`);
      } else {
        setSuccessMessage('¡Pregunta preparada!');
      }
    } catch (err) {
      console.error('Error al preparar la pregunta:', err);
      setError(err.message || 'Error al guardar la pregunta');
    } finally {
      setLoading(false);
    }
  };

  return (
  <form className="grid gap-4" onSubmit={handleSubmit}>
      {isVoiceModeEnabled && (
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={async () => {
              const parts = [];
              parts.push('Formulario para escribir preguntas manualmente.');
              parts.push('Campo Tema: selecciona el tema de la pregunta.');
              parts.push('Campo Pregunta: escribe el texto de la pregunta.');
              parts.push('Opciones: escribe las posibles respuestas. Marca cuál es la correcta con el botón de opción.');
              parts.push('Botón Atrás: vuelve al generador de preguntas.');
              parts.push('Botón Guardar: guarda la pregunta actual.');
              await speak(parts.join(' '), { action: 'page_guide', questionId: 'manual_question_form', force: true });
            }}
            aria-label="Explicar la página"
          >
            🛈 Explicar página
          </Button>
        </div>
      )}
      
      <div className="p-4 bg-gradient-to-br from-bb-primary/20 to-bb-primary/10 rounded-xl border-2 border-bb-primary/40 mb-4">
        <h3 className="text-lg font-bold mb-1">✏️ Escribe tu pregunta</h3>
        <p className="text-xs text-white/70">Rellena todos los campos correctamente</p>
      </div>

      {error && <Alert intent="error">{error}</Alert>}
      {successMessage && <Alert intent="success">{successMessage}</Alert>}

      {/* Tema */}
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-white" htmlFor="topic-select">Tema *</label>
        <select
          id="topic-select"
          value={formData.selectedTopic}
          onChange={e => setFormData(prev => ({ ...prev, selectedTopic: e.target.value }))}
          disabled={loading}
          className="block w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white backdrop-blur-md focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30 focus:outline-none transition"
        >
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* Pregunta */}
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-white" htmlFor="question-input">Pregunta *</label>
        <Input
          id="question-input"
          type="text"
          value={formData.question}
          onChange={e => setFormData(prev => ({ ...prev, question: e.target.value }))}
          disabled={loading}
          placeholder="Escribe la pregunta aquí..."
          required
        />
      </div>

      {/* Opciones */}
      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold text-white">Opciones de respuesta *</label>
          <span className="text-xs text-white/60">4 opciones requeridas</span>
        </div>
        <div className="grid gap-3 p-3 bg-white/5 rounded-lg border border-white/10">
          {formData.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className="font-bold text-bb-primary text-lg min-w-[2rem]">{String.fromCharCode(65 + idx)})</span>
              <Input
                type="text"
                value={opt}
                onChange={e => handleOptionChange(idx, e.target.value)}
                disabled={loading}
                placeholder="Escribe la opción..."
                className="flex-1"
                required
              />
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="correctOption"
                  checked={formData.correctIndex === idx}
                  onChange={() => setFormData(prev => ({ ...prev, correctIndex: idx }))}
                  disabled={loading}
                  className="h-5 w-5 accent-bb-primary cursor-pointer"
                />
                <span className="text-xs text-white/70 whitespace-nowrap">Correcta</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Resumen de respuesta correcta */}
      <div className="p-3 bg-bb-primary/15 rounded-lg border border-bb-primary/40">
        <p className="text-xs text-white/70 mb-1">Respuesta correcta seleccionada:</p>
        <p className="text-sm font-semibold text-white">
          {String.fromCharCode(65 + formData.correctIndex)}) {formData.options[formData.correctIndex] || '(sin llenar)'}
        </p>
      </div>

      {/* Botones de acción */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
          className="flex-1"
          onFocus={() => isVoiceModeEnabled && speak('Atrás: vuelve al generador de preguntas.', { force: true })}
          onMouseEnter={() => isVoiceModeEnabled && speak('Atrás: vuelve al generador de preguntas.', { force: true })}
        >
          Atrás
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="flex-1"
          onFocus={() => isVoiceModeEnabled && speak('Guardar: guarda la pregunta actual.', { force: true })}
          onMouseEnter={() => isVoiceModeEnabled && speak('Guardar: guarda la pregunta actual.', { force: true })}
        >
          {loading ? '⏳ Guardando…' : '✓ Guardar'}
        </Button>
      </div>
    </form>
  );
};

export default ManualQuestionForm;
