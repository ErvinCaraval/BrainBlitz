import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useVoice } from '../VoiceContext';
import Button from './ui/Button';
import Alert from './ui/Alert';
import { Card, CardBody, CardHeader } from './ui/Card';
import LoadingOverlay from './ui/LoadingOverlay';

export default function VoiceHistory() {
  const { user } = useAuth();
  const { voiceInteractionsService } = useVoice();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const isVoiceAnswer = (interaction) => {
    return interaction && ['voice_answer', 'voice_answer_assemblyai'].includes(interaction.action);
  };

  const isAssemblyAIUsed = (interaction) => {
    if (!interaction) return false;
    const md = interaction.metadata || {};
    return (
      interaction.action === 'voice_answer_assemblyai' ||
      md.assemblyAIProcessed === true ||
      md.assemblyAIUsed === true ||
      (md.assemblyAIResult && md.assemblyAIResult.success === true)
    );
  };

  useEffect(() => {
    if (user) {
      loadHistory();
      loadStats();
    }
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;
    
    setLoading(true);
    setError('');
    
    try {
      const historyData = await voiceInteractionsService.getUserVoiceHistory(user.uid);
      setHistory(historyData);
    } catch (error) {
      setError('Error cargando el historial de voz');
      console.error('Error loading voice history:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user) return;
    
    try {
      const statsData = await voiceInteractionsService.getUserVoiceStats(user.uid);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading voice stats:', error);
    }
  };

  const deleteHistory = async () => {
    if (!user) return;
    
    if (!confirm('¿Estás seguro de que quieres eliminar todo tu historial de voz? Esta acción no se puede deshacer.')) {
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      await voiceInteractionsService.deleteUserVoiceHistory(user.uid);
      setHistory([]);
      setStats({ total: 0, averageDuration: 0 });
      setMessage('Historial eliminado correctamente');
    } catch (error) {
      setError('Error eliminando el historial');
      console.error('Error deleting voice history:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportHistory = () => {
    if (history.length === 0) {
      setMessage('No hay historial para exportar');
      return;
    }
    
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `voice-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setMessage('Historial exportado correctamente');
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatDate = (timestamp) => {
    // Handle Firestore Timestamp object, ISO string, or number
    if (!timestamp) return '';
    // Firestore Timestamp object: { seconds, nanoseconds }
    if (typeof timestamp === 'object' && timestamp.seconds) {
      return new Date(timestamp.seconds * 1000).toLocaleString('es-ES');
    }
    // If it's a string or number, try to parse as Date
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toLocaleString('es-ES');
    }
    return '';
  };

  const totalVoiceAnswers = history.filter(isVoiceAnswer).length;
  const assemblyAIVoiceAnswers = history.filter((h) => isVoiceAnswer(h) && isAssemblyAIUsed(h)).length;

  const getActionLabel = (action) => {
    const labels = {
      'question_read': 'Lectura de pregunta',
      'option_read': 'Lectura de opción',
      'voice_answer': 'Respuesta por voz',
      'voice_answer_assemblyai': 'Respuesta por voz (AssemblyAI)',
      'settings_changed': 'Cambio de configuración',
      'tutorial_start': 'Inicio de tutorial',
      'tutorial_step': 'Paso de tutorial',
      'tutorial_end': 'Fin de tutorial',
      'text_read': 'Lectura de texto'
    };
    return labels[action] || action;
  };

  if (!user) {
    return (
      <Card>
        <CardBody>
          <Alert intent="warning">
            Debes iniciar sesión para ver tu historial de voz.
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold">Estadísticas de Voz</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-blue-400">{stats.total || 0}</div>
              <div className="text-sm text-white/70">Total de interacciones</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-green-400">
                {stats.averageDuration ? formatDuration(stats.averageDuration) : '0ms'}
              </div>
              <div className="text-sm text-white/70">Duración promedio</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-purple-400">{totalVoiceAnswers}</div>
              <div className="text-sm text-white/70">Respuestas por voz</div>
            </div>
            <div className="text-center p-4 bg-white/5 rounded-lg">
              <div className="text-2xl font-bold text-indigo-400">{assemblyAIVoiceAnswers}</div>
              <div className="text-sm text-white/70">Resp. por voz (AssemblyAI)</div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* History Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-semibold">Historial de Interacciones</h3>
            <div className="flex gap-2">
              <Button
                onClick={exportHistory}
                variant="secondary"
                size="sm"
                disabled={history.length === 0}
              >
                📥 Exportar
              </Button>
              <Button
                onClick={deleteHistory}
                variant="outline"
                size="sm"
                disabled={history.length === 0}
              >
                🗑️ Eliminar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <LoadingOverlay />
          ) : error ? (
            <Alert intent="error">{error}</Alert>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <div className="text-4xl mb-4">🎤</div>
              <p>No hay interacciones de voz registradas</p>
              <p className="text-sm">Las interacciones aparecerán aquí cuando uses el modo de voz</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((interaction, index) => (
                <div
                  key={index}
                  className="p-4 bg-white/5 rounded-lg border border-white/10"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-white/90">
                      {getActionLabel(interaction.action)}
                    </div>
                    <div className="text-xs text-white/60">
                      {formatDate(interaction.timestamp)}
                    </div>
                  </div>
                  
                  {interaction.voiceText && (
                    <div className="text-sm text-white/80 mb-2">
                      &quot;{interaction.voiceText}&quot;
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center text-xs text-white/60">
                    <div>
                      {interaction.duration > 0 && (
                        <span>Duración: {formatDuration(interaction.duration)}</span>
                      )}
                    </div>
                    <div>
                      {interaction.confidence && (
                        <span>Confianza: {Math.round(interaction.confidence * 100)}%</span>
                      )}
                    </div>
                  </div>
                  
                  {isVoiceAnswer(interaction) && (
                    <div className="mt-2 text-xs">
                      <span className={`inline-block px-2 py-1 rounded ${isAssemblyAIUsed(interaction) ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}`}>
                        AssemblyAI: {isAssemblyAIUsed(interaction) ? 'Sí' : 'No'}
                      </span>
                    </div>
                  )}

                  {interaction.metadata && Object.keys(interaction.metadata).length > 0 && (
                    <details className="mt-2">
                      <summary className="text-xs text-white/60 cursor-pointer">
                        Ver detalles
                      </summary>
                      <pre className="text-xs text-white/50 mt-1 p-2 bg-black/20 rounded">
                        {JSON.stringify(interaction.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
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
