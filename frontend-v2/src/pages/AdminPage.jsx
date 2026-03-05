import React, { useEffect, useState } from 'react';
import adminService from '../services/adminService';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import LoadingOverlay from '../components/ui/LoadingOverlay';
import OCRQuestionCapture from '../components/OCRQuestionCapture';

const emptyForm = {
  text: '',
  options: ['', '', '', ''],
  correctAnswerIndex: 0,
  category: '',
  explanation: ''
};

export default function AdminPage() {
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessibilityStats, setAccessibilityStats] = useState({});
  const [accessibilitySettings, setAccessibilitySettings] = useState({});
  const [loadingAccessibility, setLoadingAccessibility] = useState(false);
  const [message, setMessage] = useState('');
  const [ocrMode, setOcrMode] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAllQuestions();
      setQuestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching questions:', error);
      setMessage('Error cargando preguntas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchQuestions(); 
    fetchAccessibilityData();
  }, []);

  const handleOCRQuestionExtracted = (question) => {
    setForm(question);
    setOcrMode(false);
    setMessage('Pregunta extraída del OCR. Edita según sea necesario.');
  };
  const fetchAccessibilityData = async () => {
    setLoadingAccessibility(true);
    try {
      const stats = await adminService.getAccessibilityStats();
      const settings = await adminService.getAccessibilitySettings();
      setAccessibilityStats(stats);
      setAccessibilitySettings(settings);
    } catch (error) {
      console.error('Error fetching accessibility data:', error);
      setMessage('Error cargando datos de accesibilidad');
    } finally {
      setLoadingAccessibility(false);
    }
  };

  const updateAccessibilitySettings = async (newSettings) => {
    setLoadingAccessibility(true);
    try {
      const updatedSettings = await adminService.updateAccessibilitySettings(newSettings);
      setAccessibilitySettings(updatedSettings);
      setMessage('Configuración de accesibilidad actualizada correctamente');
    } catch (error) {
      console.error('Error updating accessibility settings:', error);
      setMessage('Error actualizando configuración de accesibilidad');
    } finally {
      setLoadingAccessibility(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };
  const handleOptionChange = (idx, value) => {
    setForm(f => {
      const options = [...f.options];
      options[idx] = value;
      return { ...f, options };
    });
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await adminService.updateQuestion(editingId, form);
        setMessage('Pregunta actualizada correctamente');
      } else {
        await adminService.createQuestion(form);
        setMessage('Pregunta creada correctamente');
      }
      setForm(emptyForm);
      setEditingId(null);
      fetchQuestions();
    } catch (error) {
      console.error('Error saving question:', error);
      setMessage('Error guardando pregunta');
    }
  };
  const handleEdit = (q) => {
    setForm(q);
    setEditingId(q.id);
  };
  const handleDelete = async (id) => {
    try {
      await adminService.deleteQuestion(id);
      setMessage('Pregunta eliminada correctamente');
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      setMessage('Error eliminando pregunta');
    }
  };

  return (
    <div className="container min-h-screen px-4 py-8 space-y-6">
      {loadingAccessibility && <LoadingOverlay />}
      
      {/* Accessibility Admin Section */}
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold">Panel de Accesibilidad</h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Accessibility Stats */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Estadísticas de Accesibilidad</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="text-2xl font-bold text-blue-400">
                  {accessibilityStats.totalUsersWithVoiceMode || 0}
                </div>
                <div className="text-sm text-white/70">Usuarios con modo de voz</div>
              </div>
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="text-2xl font-bold text-green-400">
                  {accessibilityStats.totalVoiceInteractions || 0}
                </div>
                <div className="text-sm text-white/70">Interacciones de voz</div>
              </div>
              <div className="p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                <div className="text-2xl font-bold text-purple-400">
                  {accessibilityStats.voiceModeAdoptionRate || 0}%
                </div>
                <div className="text-sm text-white/70">Tasa de adopción</div>
              </div>
              <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                <div className="text-2xl font-bold text-orange-400">
                  {accessibilityStats.averageVoiceSessionDuration || 0}s
                </div>
                <div className="text-sm text-white/70">Duración promedio</div>
              </div>
            </div>
          </div>

          {/* Accessibility Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Configuración Global de Accesibilidad</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="voiceModeEnabled"
                  checked={accessibilitySettings.voiceModeEnabled || false}
                  onChange={(e) => updateAccessibilitySettings({ 
                    voiceModeEnabled: e.target.checked 
                  })}
                  className="h-4 w-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                />
                <label htmlFor="voiceModeEnabled" className="text-sm text-white/80">
                  Habilitar modo de voz globalmente
                </label>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block mb-2 text-sm font-medium text-white/80">
                    Velocidad de voz por defecto
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={accessibilitySettings.defaultVoiceSettings?.rate || 1.0}
                    onChange={(e) => updateAccessibilitySettings({
                      defaultVoiceSettings: {
                        ...accessibilitySettings.defaultVoiceSettings,
                        rate: parseFloat(e.target.value)
                      }
                    })}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="text-xs text-white/60 mt-1">
                    {accessibilitySettings.defaultVoiceSettings?.rate || 1.0}x
                  </div>
                </div>
                
                <div>
                  <label className="block mb-2 text-sm font-medium text-white/80">
                    Volumen por defecto
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={accessibilitySettings.defaultVoiceSettings?.volume || 1.0}
                    onChange={(e) => updateAccessibilitySettings({
                      defaultVoiceSettings: {
                        ...accessibilitySettings.defaultVoiceSettings,
                        volume: parseFloat(e.target.value)
                      }
                    })}
                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="text-xs text-white/60 mt-1">
                    {Math.round((accessibilitySettings.defaultVoiceSettings?.volume || 1.0) * 100)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Feature Toggles */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Funcionalidades de Accesibilidad</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accessibilitySettings.features && Object.entries(accessibilitySettings.features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id={feature}
                    checked={enabled}
                    onChange={(e) => updateAccessibilitySettings({
                      features: {
                        ...accessibilitySettings.features,
                        [feature]: e.target.checked
                      }
                    })}
                    className="h-4 w-4 text-blue-600 bg-white/10 border-white/20 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label htmlFor={feature} className="text-sm text-white/80 capitalize">
                    {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Admin Panel</h2>
            <Button 
              type="button"
              variant={ocrMode ? "primary" : "secondary"}
              onClick={() => setOcrMode(!ocrMode)}
            >
              {ocrMode ? 'Modo Manual' : 'Modo OCR'}
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {ocrMode ? (
            <OCRQuestionCapture 
              topics={["General", "Arte", "Ciencia", "Historia", "Deportes"]}
              onQuestionExtracted={handleOCRQuestionExtracted}
              onCancel={() => setOcrMode(false)}
            />
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-3">
            <Input name="text" value={form.text} onChange={handleChange} placeholder="Question text" required />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input name="category" value={form.category} onChange={handleChange} placeholder="Category" required />
              <Input name="explanation" value={form.explanation} onChange={handleChange} placeholder="Explanation" required />
              <div className="grid gap-2">
                <span className="text-sm text-white/70">Correcta</span>
                <div className="flex flex-wrap gap-3">
                  {form.options.map((_, idx) => (
                    <label key={idx} className="inline-flex items-center gap-2 text-sm">
                      <input type="radio" name="correctAnswerIndex" checked={form.correctAnswerIndex === idx} onChange={() => setForm(f => ({ ...f, correctAnswerIndex: idx }))} className="h-4 w-4" />
                      <span>{idx + 1}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {form.options.map((opt, idx) => (
                <Input key={idx} value={opt} onChange={e => handleOptionChange(idx, e.target.value)} placeholder={`Option ${idx + 1}`} required />
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              {editingId && <Button type="button" variant="secondary" onClick={() => { setForm(emptyForm); setEditingId(null); }}>Cancel</Button>}
              <Button type="submit">{editingId ? 'Update' : 'Add'} Question</Button>
            </div>
            </form>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="pb-2"><h3 className="text-xl font-semibold">Questions</h3></CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex items-center gap-3 text-white/80"><div className="loading-spinner" /> Loading…</div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left">
                  <tr className="border-b border-white/10">
                    <th className="py-2 pr-3">Text</th>
                    <th className="py-2 pr-3">Category</th>
                    <th className="py-2 pr-3">Options</th>
                    <th className="py-2 pr-3">Correct</th>
                    <th className="py-2 pr-3">Explanation</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map(q => (
                    <tr key={q.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 pr-3 align-top">{q.text}</td>
                      <td className="py-2 pr-3 align-top">{q.category}</td>
                      <td className="py-2 pr-3 align-top">{q.options.join(', ')}</td>
                      <td className="py-2 pr-3 align-top">{q.options[q.correctAnswerIndex]}</td>
                      <td className="py-2 pr-3 align-top">{q.explanation}</td>
                      <td className="py-2 flex gap-2">
                        <Button variant="secondary" onClick={() => handleEdit(q)}>Edit</Button>
                        <Button variant="outline" onClick={() => handleDelete(q.id)}>Delete</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
      
      {message && (
        <Alert intent={message.includes('Error') ? 'error' : 'success'}>
          {message}
        </Alert>
      )}
    </div>
  );
}