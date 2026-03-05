import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useVoice } from '../VoiceContext';
import backendAuthService from '../services/backendAuthService';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import VoiceSettings from '../components/VoiceSettings';
import VoiceHistory from '../components/VoiceHistory';
import AudioTutorial from '../components/AudioTutorial';
// Removed diagnostic from profile per request

function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { userHasVisualDifficulty, isVoiceModeEnabled, toggleVoiceMode } = useVoice();
  const [stats, setStats] = useState(null);
  const [apiError, setApiError] = useState('');
  const [apiRaw, setApiRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;
      let statsData = null;
      try {
        const apiBase = (typeof window !== 'undefined' && window.ENV?.VITE_API_URL) || import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        // ✅ Get Firebase ID token from user
        const token = user && (await user.getIdToken());
        const statsRes = await fetch(`${apiBase}/users/me/stats?uid=${user.uid}`,
          {
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'Content-Type': 'application/json'
            }
          }
        );
        if (statsRes.ok) {
          statsData = await statsRes.json();
          setApiRaw(statsData);
        } else {
          setApiError(`Error HTTP: ${statsRes.status}`);
        }
      } catch (err) {
        setApiError('Error de conexión: ' + err.message);
      }
      setStats(statsData?.stats || null);
      setLoading(false);
    }
    fetchProfile();
  }, [user]);

  if (loading) return (
    <div className="px-4 py-10 min-h-screen container">
      <Card>
        <CardBody className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" aria-busy="true"></div>
            <p className="text-white/70">Cargando perfil...</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
  const tabs = [
    { id: 'profile', label: 'Perfil', icon: '👤' },
    { id: 'voice-settings', label: 'Configuración de Voz', icon: '🎤' },
    { id: 'voice-history', label: 'Historial de Voz', icon: '📊' },
    { id: 'tutorial', label: 'Tutorial', icon: '📚' }
  ];

  return (
    <div className="container min-h-screen px-4 py-8 pt-24">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Back to Dashboard Button */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
            aria-label="Volver al dashboard"
          >
            <span className="text-lg">←</span>
            <span>Volver al Dashboard</span>
          </button>
        </div>

        {/* User Profile Header */}
        <Card>
          <CardHeader className="flex items-center gap-6 p-6">
            <div className="relative">
              <img
                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${user?.uid || 'user'}`}
                alt="Avatar del usuario"
                className="bg-white/10 rounded-full w-20 h-20 flex-shrink-0 border-2 border-white/20"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white/20 flex items-center justify-center">
                <div className="w-2 h-2 bg-white rounded-full"></div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-2xl mb-2 text-white">{user?.displayName || user?.email}</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-white/60 text-sm font-mono">UID: {user?.uid?.slice(0, 8)}...</span>
                {userHasVisualDifficulty && (
                  <span className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full border border-blue-500/30">
                    ♿ Accesibilidad habilitada
                  </span>
                )}
                <button
                  onClick={toggleVoiceMode}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 ${isVoiceModeEnabled ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-gray-500/20 text-gray-300 border border-gray-500/30 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30'}`}
                  aria-pressed={isVoiceModeEnabled}
                  type="button"
                >
                  {isVoiceModeEnabled ? '🎤 Modo de voz activo' : '🎤 Activar modo de voz'}
                </button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-1 border-b border-white/10 bg-white/5 rounded-t-lg p-1" role="tablist" aria-label="Navegación del perfil">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                activeTab === tab.id
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-lg'
                  : 'text-white/70 hover:text-white/90 hover:bg-white/10 border border-transparent'
              }`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              id={`tab-${tab.id}`}
            >
              <span className="text-base" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'profile' && (
          <Card role="tabpanel" id="tabpanel-profile" aria-labelledby="tab-profile">
            <CardHeader className="pb-4">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">📊</span>
                Estadísticas del Juego
              </h3>
            </CardHeader>
            <CardBody>
              {apiError && <Alert intent="error" className="mb-4">{apiError}</Alert>}
              {stats ? (
                <div className="gap-4 grid grid-cols-1 sm:grid-cols-3">
                  <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/20 px-6 py-5 border border-blue-500/20 rounded-xl hover:border-blue-400/30 transition-all duration-200 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-blue-300 text-sm font-medium">Partidas jugadas</div>
                      <span className="text-blue-400 text-lg">🎮</span>
                    </div>
                    <div className="font-bold text-3xl text-white group-hover:text-blue-100 transition-colors">{stats.gamesPlayed}</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500/10 to-green-600/20 px-6 py-5 border border-green-500/20 rounded-xl hover:border-green-400/30 transition-all duration-200 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-green-300 text-sm font-medium">Victorias</div>
                      <span className="text-green-400 text-lg">🏆</span>
                    </div>
                    <div className="font-bold text-3xl text-white group-hover:text-green-100 transition-colors">{stats.wins}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/20 px-6 py-5 border border-purple-500/20 rounded-xl hover:border-purple-400/30 transition-all duration-200 group">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-purple-300 text-sm font-medium">Respuestas correctas</div>
                      <span className="text-purple-400 text-lg">✅</span>
                    </div>
                    <div className="font-bold text-3xl text-white group-hover:text-purple-100 transition-colors">{stats.correctAnswers}</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-6xl mb-4">📈</div>
                  <p className="text-white/70 text-lg mb-4">No hay estadísticas disponibles</p>
                  <p className="text-white/50 text-sm">¡Juega algunas partidas para ver tus estadísticas aquí!</p>
                  {apiRaw && (
                    <details className="mt-6">
                      <summary className="underline cursor-pointer text-blue-400 hover:text-blue-300">Ver respuesta de la API</summary>
                      <pre className="bg-black/40 mt-3 p-4 rounded-xl overflow-auto text-xs text-white/80 border border-white/10">{JSON.stringify(apiRaw, null, 2)}</pre>
                    </details>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        {activeTab === 'voice-settings' && <VoiceSettings />}
        {activeTab === 'voice-history' && <VoiceHistory />}
        {activeTab === 'tutorial' && (
          <AudioTutorial 
            onComplete={() => setActiveTab('profile')}
            onSkip={() => setActiveTab('profile')}
          />
        )}
        {/* Diagnostic tab removed */}
      </div>
    </div>
  );
}

export default ProfilePage;