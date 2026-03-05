import React, { useState, useEffect } from 'react';
import { useVoice } from '../VoiceContext';
import Button from './ui/Button';
import Input from './ui/Input';
import Alert from './ui/Alert';
import { Card, CardBody, CardHeader } from './ui/Card';
import voiceService from '../services/voiceService';

// Función para obtener nombres de idiomas amigables
const getLangName = (locale) => {
  const langNames = {
    'es-ES': 'Español (España)',
    'es-MX': 'Español (México)',
    'es-AR': 'Español (Argentina)',
    'es-CO': 'Español (Colombia)',
    'en-US': 'Inglés (Estados Unidos)',
    'en-GB': 'Inglés (Reino Unido)',
    'pt-BR': 'Portugués (Brasil)',
    'fr-FR': 'Francés',
    'de-DE': 'Alemán',
    'it-IT': 'Italiano'
  };
  return langNames[locale] || locale;
};

export default function VoiceSettings() {
  const { 
    isVoiceModeEnabled, 
    getVoiceSettings, 
    updateVoiceSettings, 
    getVoiceStatus,
    isVoiceAvailable,
    speak 
  } = useVoice();
  
  const [settings, setSettings] = useState({
    rate: 1.0,
    volume: 1.0,
    pitch: 1.0,
    voiceName: null,
    language: 'es-ES',
    style: 'general', // Estilo de habla para Azure
    role: 'default' // Rol de la voz para Azure
  });
  
  const [availableVoices, setAvailableVoices] = useState([]);
  const [status, setStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [languages, setLanguages] = useState([]);

  useEffect(() => {
    const initializeVoiceSettings = async () => {
      setLoading(true);
      setMessage('');
      
      try {
        // Load saved settings first
        loadSettings();
        
        // Get current status including voice availability
        let status = getVoiceStatus();
        setStatus(status);

        // Attempt to get available voices
        let voicesArray = [];
        
        // Try to get voices from the service first
        try {
          await voiceService.loadVoices();
          voicesArray = voiceService.getAvailableVoices();
          
          // Refresh status after loading voices
          status = getVoiceStatus();
          setStatus(status);
        } catch (err) {
          console.error('Error loading voices from service:', err);
          setMessage('Error al cargar las voces desde el servicio');
        }

        // If we have voices, update the component state
        if (Array.isArray(voicesArray) && voicesArray.length > 0) {
          console.log('Available voices:', voicesArray);
          setAvailableVoices(voicesArray);

          // Extract and sort unique languages
          const uniqueLanguages = [...new Set(voicesArray
            .map(voice => voice.locale)
            .filter(locale => typeof locale === 'string' && locale.trim().length > 0)
          )].sort();
          
          console.log('Unique languages:', uniqueLanguages);
          setLanguages(uniqueLanguages);

          // Validate current voice selection
          const currentSettings = getVoiceSettings();
          if (currentSettings.voiceName) {
            const voiceExists = voicesArray.some(v => v.name === currentSettings.voiceName);
            if (!voiceExists) {
              // Select a default voice for the current language
              const voicesForLanguage = voicesArray.filter(v => v.locale === currentSettings.language);
              if (voicesForLanguage.length > 0) {
                handleVoiceChange(voicesForLanguage[0].name);
              }
            }
          }
        } else {
          console.warn('No voices available');
          setMessage('No hay voces disponibles');
        }
      } catch (error) {
        console.error('Error initializing voice settings:', error);
        setMessage('Error al inicializar la configuración de voz');
      } finally {
        setLoading(false);
      }
    };
    
    initializeVoiceSettings();
  }, []);

  const loadSettings = () => {
    const currentSettings = getVoiceSettings();
    
    // Validar que el idioma actual tenga voces disponibles
    if (currentSettings.language) {
      const hasVoicesForLanguage = availableVoices.some(
        voice => voice.locale === currentSettings.language
      );
      
      if (!hasVoicesForLanguage) {
        // Si no hay voces para el idioma actual, usar español por defecto
        currentSettings.language = 'es-ES';
        console.log('Resetting to default language: es-ES');
      }
    }
    
    setSettings(currentSettings);
    console.log('Loaded settings:', currentSettings);
  };

  const loadStatus = () => {
    const currentStatus = getVoiceStatus();
    setStatus(currentStatus);
    
    // Get voices from speechSynthesis API directly
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices) {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices || []);
    } else {
      setAvailableVoices([]);
    }
  };

  const handleSettingChange = async (key, value) => {
    try {
      // Validar el cambio antes de aplicarlo
      if (key === 'language') {
        // Verificar que el idioma exista en las voces disponibles
        const isValidLanguage = availableVoices.some(voice => voice.locale === value);
        if (!isValidLanguage) {
          console.error('Invalid language selected:', value);
          setMessage('Error: Idioma no válido');
          return;
        }

        // Encontrar voces disponibles para el nuevo idioma
        const voicesForLanguage = availableVoices.filter(voice => voice.locale === value);
        
        // Crear nuevas configuraciones
        const newSettings = { 
          ...settings, 
          language: value 
        };

        // Si la voz actual no es válida para el nuevo idioma, seleccionar una nueva
        const currentVoice = availableVoices.find(v => v.name === settings.voiceName);
        if (!currentVoice || currentVoice.locale !== value) {
          if (voicesForLanguage.length > 0) {
            newSettings.voiceName = voicesForLanguage[0].name;
            console.log('Selecting new voice for language:', newSettings.voiceName);
          }
        }

        // Actualizar estado local
        setSettings(newSettings);
        
        // Actualizar servicio de voz
        await updateVoiceSettings(newSettings);
        
        setMessage(`Idioma cambiado a ${getLangName(value)}`);
      } else {
        // Para otros cambios de configuración
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        await updateVoiceSettings(newSettings);
      }
    } catch (err) {
      console.error('Error updating settings:', err);
      setMessage('Error al guardar la configuración');
    }
  };

  const handleVoiceChange = (voiceName) => {
    console.log('handleVoiceChange called with', voiceName);
    
    const selectedVoice = availableVoices.find(voice => voice.name === voiceName);
    if (selectedVoice) {
      console.log('selectedVoice:', selectedVoice);
      
      // Create a settings update with both voice and language
      const newSettings = {
        ...settings,
        voiceName: selectedVoice.name,
        language: selectedVoice.locale
      };
      
      // Update local state
      setSettings(newSettings);
      
      // Update shared service/context
      try {
        updateVoiceSettings(newSettings);
      } catch (err) {
        console.error('Error updating voice settings:', err);
        setMessage('Error al guardar la voz seleccionada');
      }
    } else {
      console.warn('No matching voice found for', voiceName, 'availableVoices:', availableVoices);
      setMessage('Error: No se encontró la voz seleccionada');
    }
  };

  const testVoice = async () => {
    if (!isVoiceModeEnabled) {
      setMessage('Activa el modo de voz primero');
      return;
    }

    setLoading(true);
    setMessage('');
    
    try {
      await speak('Esta es una prueba de voz. Puedes ajustar la velocidad, volumen y tono según tus preferencias.');
      setMessage('Prueba de voz completada');
    } catch (error) {
      setMessage('Error en la prueba de voz: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetToDefaults = () => {
    const defaultSettings = {
      rate: 1.0,
      volume: 1.0,
      pitch: 1.0,
      voice: null,
      language: 'es-ES'
    };
    setSettings(defaultSettings);
    updateVoiceSettings(defaultSettings);
    setMessage('Configuración restaurada a valores por defecto');
  };

  if (!isVoiceAvailable) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold">Configuración de Voz</h3>
        </CardHeader>
        <CardBody>
          <Alert intent="warning">
            La funcionalidad de voz no está disponible en tu navegador. 
            Asegúrate de usar un navegador compatible como Chrome, Firefox o Safari.
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-xl font-semibold">Configuración de Voz</h3>
          <p className="text-white/70">
            Personaliza la voz, velocidad y volumen para una mejor experiencia auditiva.
          </p>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Language Selection */}
          <div>
            <label className="block mb-2 text-sm font-medium text-white/80">
              Idioma {loading ? '(Cargando...)' : `(${languages.length} disponibles)`}
            </label>
            <select
              value={settings.language}
              onChange={(e) => handleSettingChange('language', e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {languages.length === 0 ? (
                <option value="">Cargando idiomas...</option>
              ) : (
                languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {getLangName(lang)}
                  </option>
                ))
              )}
            </select>
          </div>
          
          {message && (
            <div className="text-sm text-yellow-400">
              {message}
            </div>
          )}

          {/* Voice Selection */}
          <div>
            <label className="block mb-2 text-sm font-medium text-white/80">
              Voz
            </label>
            <select
              value={settings.voiceName || ''}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecciona una voz</option>
              {availableVoices
                .filter(voice => voice.locale === settings.language)
                .map((voice, index) => (
                  <option key={index} value={voice.name}>
                    {voice.displayName ? `${voice.displayName} ${voice.gender ? `(${voice.gender === 'Female' ? 'Femenina' : 'Masculina'})` : ''}` : `${voice.name} ${voice.gender ? `(${voice.gender === 'Female' ? 'Femenina' : 'Masculina'})` : ''}`}
                  </option>
              ))}
            </select>
          </div>

          {/* Rate (Speed) */}
          <div>
            <label className="block mb-2 text-sm font-medium text-white/80">
              Velocidad: {settings.rate}x
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.rate}
              onChange={(e) => handleSettingChange('rate', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-white/60 mt-1">
              <span>0.5x</span>
              <span>1x</span>
              <span>2x</span>
            </div>
          </div>

          {/* Volume */}
          <div>
            <label className="block mb-2 text-sm font-medium text-white/80">
              Volumen: {Math.round(settings.volume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.volume}
              onChange={(e) => handleSettingChange('volume', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-white/60 mt-1">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Pitch */}
          <div>
            <label className="block mb-2 text-sm font-medium text-white/80">
              Tono: {settings.pitch}
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.pitch}
              onChange={(e) => handleSettingChange('pitch', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-white/60 mt-1">
              <span>Bajo</span>
              <span>Normal</span>
              <span>Alto</span>
            </div>
          </div>

          {/* single Language selector is above; removed duplicate below */}

          {/* Status Info */}
          <div className="p-4 bg-white/5 rounded-lg">
            <h4 className="text-sm font-medium text-white/80 mb-2">Estado del Sistema</h4>
            <div className="text-xs text-white/60 space-y-1">
              <div>Disponible: {status.isAvailable ? '✅ Sí' : '❌ No'}</div>
              <div>Reproduciendo: {status.isSpeaking ? '🔊 Sí' : '🔇 No'}</div>
              <div>Voces disponibles: {Array.isArray(status.availableVoices) ? status.availableVoices.length : (status.availableVoices || 0)}</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={testVoice}
              disabled={loading || !isVoiceModeEnabled}
              variant="primary"
            >
              {loading ? 'Probando...' : '🔊 Probar Voz'}
            </Button>
            
            <Button
              onClick={resetToDefaults}
              variant="secondary"
            >
              🔄 Restaurar
            </Button>
          </div>

          {message && (
            <Alert intent={message.includes('Error') ? 'error' : 'success'}>
              {message}
            </Alert>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

