import React, { useState, useEffect } from 'react';

const SimpleVoiceTest = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Verificar soporte
    const supported = 'speechSynthesis' in window;
    setIsSupported(supported);

    if (supported) {
      // Cargar voces
      const loadVoices = () => {
        const availableVoices = speechSynthesis.getVoices();
        setVoices(availableVoices);
        console.log('Voces disponibles:', availableVoices);
      };

      loadVoices();
      
      // Recargar voces cuando cambien
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, []);

  const speakText = (text) => {
    if (!isSupported) {
      setMessage('Tu navegador no soporta síntesis de voz');
      return;
    }

    // Detener cualquier voz actual
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Configuración básica
    utterance.rate = 1.0;
    utterance.volume = 1.0;
    utterance.pitch = 1.0;
    utterance.lang = 'es-ES';

    utterance.onstart = () => {
      setIsSpeaking(true);
      setMessage('Comenzando a hablar...');
      console.log('Comenzando a hablar...');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setMessage('Terminó de hablar');
      console.log('Terminó de hablar');
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      setMessage('Error: ' + event.error);
      console.error('Error en síntesis de voz:', event.error);
    };

    console.log('Iniciando síntesis de voz...');
    speechSynthesis.speak(utterance);
  };

  const testBasic = () => {
    setMessage('Probando voz...');
    speakText('Hola, este es un test básico de voz');
  };

  const testLong = () => {
    setMessage('Probando voz larga...');
    speakText('Hola, este es un test más largo de voz. Si puedes escuchar esto, el sistema de síntesis de voz está funcionando correctamente en tu navegador.');
  };

  const stopSpeaking = () => {
    speechSynthesis.cancel();
    setIsSpeaking(false);
    setMessage('Voz detenida');
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">🔊 Prueba Simple de Voz</h2>
      
      <div className="space-y-4">
        {/* Estado del sistema */}
        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Estado del Sistema:</h3>
          <ul className="space-y-1">
            <li><strong>Soporte Web Speech API:</strong> {isSupported ? '✅ Sí' : '❌ No'}</li>
            <li><strong>Estado actual:</strong> {isSpeaking ? '🔊 Hablando' : '🔇 Silencioso'}</li>
            <li><strong>Voces disponibles:</strong> {voices.length}</li>
            <li><strong>Navegador:</strong> {navigator.userAgent.split(' ')[0]}</li>
          </ul>
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className="p-3 bg-blue-100 border border-blue-300 rounded">
            <strong>Estado:</strong> {message}
          </div>
        )}

        {/* Botones de prueba */}
        <div className="space-y-2">
          <button
            onClick={testBasic}
            disabled={!isSupported || isSpeaking}
            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            🔊 Prueba Básica
          </button>
          
          <button
            onClick={testLong}
            disabled={!isSupported || isSpeaking}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            🔊 Prueba Larga
          </button>
          
          <button
            onClick={stopSpeaking}
            disabled={!isSpeaking}
            className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            ⏹️ Detener
          </button>
        </div>

        {/* Lista de voces */}
        {voices.length > 0 && (
          <div className="p-4 bg-blue-50 rounded">
            <h3 className="font-bold mb-2">Voces Disponibles:</h3>
            <div className="max-h-32 overflow-y-auto">
              {voices.map((voice, index) => (
                <div key={index} className="text-sm p-1 border-b">
                  <strong>{voice.name}</strong> - {voice.lang}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instrucciones */}
        <div className="p-4 bg-yellow-50 rounded">
          <h3 className="font-bold mb-2">Instrucciones:</h3>
          <ul className="text-sm space-y-1">
            <li>• Haz clic en &quot;Prueba Básica&quot; para un test corto</li>
            <li>• Haz clic en &quot;Prueba Larga&quot; para un test más completo</li>
            <li>• Si no escuchas nada, verifica el volumen del sistema</li>
            <li>• Asegúrate de que no hay bloqueos de audio en el navegador</li>
            <li>• Revisa la consola del navegador (F12) para ver errores</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default SimpleVoiceTest;