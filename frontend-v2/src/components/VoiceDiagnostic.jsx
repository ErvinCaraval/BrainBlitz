import React, { useState, useEffect } from 'react';
import { useVoice } from '../VoiceContext';

const VoiceDiagnostic = () => {
  const { speak, isVoiceModeEnabled, getVoiceStatus } = useVoice();
  const [diagnostic, setDiagnostic] = useState({});
  const [testText, setTestText] = useState('Hola, este es un test de voz');

  useEffect(() => {
    const runDiagnostic = () => {
      const status = getVoiceStatus();
      setDiagnostic(status);
    };

    runDiagnostic();
  }, [getVoiceStatus]);

  const testVoice = async () => {
    try {
      console.log('Testing voice with text:', testText);
      await speak(testText);
      console.log('Voice test completed');
    } catch (error) {
      console.error('Voice test failed:', error);
      alert('Error en la prueba de voz: ' + error.message);
    }
  };

  const checkBrowserSupport = () => {
    const support = {
      speechSynthesis: 'speechSynthesis' in window,
      speechSynthesisUtterance: 'SpeechSynthesisUtterance' in window,
      voices: speechSynthesis.getVoices().length,
      voicesList: speechSynthesis.getVoices()
    };
    
    console.log('Browser support:', support);
    return support;
  };

  const browserSupport = checkBrowserSupport();

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">🔍 Diagnóstico de Voz</h2>
      
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-gray-100 rounded">
            <strong>Modo de Voz:</strong> {isVoiceModeEnabled ? '✅ Activado' : '❌ Desactivado'}
          </div>
          <div className="p-3 bg-gray-100 rounded">
            <strong>API Disponible:</strong> {diagnostic.isAvailable ? '✅ Sí' : '❌ No'}
          </div>
          <div className="p-3 bg-gray-100 rounded">
            <strong>Hablando:</strong> {diagnostic.isSpeaking ? '🔊 Sí' : '🔇 No'}
          </div>
          <div className="p-3 bg-gray-100 rounded">
            <strong>Voces:</strong> {diagnostic.availableVoices || 0}
          </div>
        </div>

        <div className="p-4 bg-blue-50 rounded">
          <h3 className="font-bold mb-2">Soporte del Navegador:</h3>
          <ul className="space-y-1">
            <li>speechSynthesis: {browserSupport.speechSynthesis ? '✅' : '❌'}</li>
            <li>SpeechSynthesisUtterance: {browserSupport.speechSynthesisUtterance ? '✅' : '❌'}</li>
            <li>Voces disponibles: {browserSupport.voices}</li>
          </ul>
        </div>

        <div className="p-4 bg-green-50 rounded">
          <h3 className="font-bold mb-2">Configuración Actual:</h3>
          <pre className="text-sm bg-white p-2 rounded overflow-auto">
            {JSON.stringify(diagnostic.settings, null, 2)}
          </pre>
        </div>

        <div className="p-4 bg-yellow-50 rounded">
          <h3 className="font-bold mb-2">Voces Disponibles:</h3>
          <div className="max-h-32 overflow-y-auto">
            {browserSupport.voicesList.map((voice, index) => (
              <div key={index} className="text-sm p-1 border-b">
                <strong>{voice.name}</strong> - {voice.lang} ({voice.gender || 'N/A'})
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 bg-purple-50 rounded">
          <h3 className="font-bold mb-2">Prueba de Voz:</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="Texto para probar..."
            />
            <button
              onClick={testVoice}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              🔊 Probar
            </button>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded">
          <h3 className="font-bold mb-2">Solución de Problemas:</h3>
          <ul className="text-sm space-y-1">
            <li>• Asegúrate de que el navegador soporte Web Speech API</li>
            <li>• Verifica que no haya bloqueos de sonido en el navegador</li>
            <li>• Comprueba que el volumen del sistema esté activado</li>
            <li>• Intenta con un navegador diferente (Chrome funciona mejor)</li>
            <li>• Verifica que no haya extensiones bloqueando el audio</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VoiceDiagnostic;
