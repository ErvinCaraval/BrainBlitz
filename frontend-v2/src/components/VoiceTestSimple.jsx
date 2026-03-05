import React, { useState, useEffect } from 'react';

const VoiceTestSimple = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const supported = 'speechSynthesis' in window;
    setIsSupported(supported);
    
    if (supported) {
      setMessage('Web Speech API está disponible');
    } else {
      setMessage('Web Speech API no está disponible');
    }
  }, []);

  const testVoice = () => {
    if (!isSupported) {
      setMessage('Tu navegador no soporta síntesis de voz');
      return;
    }

    setMessage('Probando voz...');
    const utterance = new SpeechSynthesisUtterance('Hola, este es un test de voz desde la aplicación React');
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.volume = 1.0;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setMessage('Comenzando a hablar...');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setMessage('Terminó de hablar');
    };

    utterance.onerror = (event) => {
      setIsSpeaking(false);
      setMessage('Error: ' + event.error);
    };

    speechSynthesis.speak(utterance);
  };

  return (
    <div className="p-4 bg-blue-500/20 border border-blue-500/40 rounded-lg">
      <h3 className="text-lg font-bold mb-2">🔊 Prueba de Voz Simple</h3>
      <p className="text-sm mb-2">Estado: {message}</p>
      <p className="text-sm mb-2">Soporte: {isSupported ? '✅ Sí' : '❌ No'}</p>
      <p className="text-sm mb-2">Hablando: {isSpeaking ? '🔊 Sí' : '🔇 No'}</p>
      <button
        onClick={testVoice}
        disabled={!isSupported || isSpeaking}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
      >
        {isSpeaking ? 'Hablando...' : '🔊 Probar Voz'}
      </button>
    </div>
  );
};

export default VoiceTestSimple;
