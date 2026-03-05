import React, { useState, useEffect } from 'react';

const VoiceDiagnosticComplete = () => {
  const [diagnostics, setDiagnostics] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState([]);

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results = {};

    // 1. Verificar soporte del navegador
    results.browserSupport = {
      speechSynthesis: 'speechSynthesis' in window,
      speechSynthesisUtterance: 'SpeechSynthesisUtterance' in window,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    };

    // 2. Verificar voces disponibles
    const voices = speechSynthesis.getVoices();
    results.voices = {
      count: voices.length,
      list: voices.map(v => ({
        name: v.name,
        lang: v.lang,
        gender: v.gender,
        default: v.default
      })),
      spanishVoices: voices.filter(v => v.lang.includes('es'))
    };

    // 3. Verificar permisos y configuración
    results.permissions = {
      hasAudioContext: 'AudioContext' in window || 'webkitAudioContext' in window,
      hasMediaDevices: 'mediaDevices' in navigator,
      hasGetUserMedia: 'getUserMedia' in navigator.mediaDevices
    };

    // 4. Verificar estado actual
    results.currentState = {
      isSpeaking: speechSynthesis.speaking,
      isPaused: speechSynthesis.paused,
      pending: speechSynthesis.pending
    };

    // 5. Verificar configuración del sistema
    results.systemConfig = {
      volume: speechSynthesis.volume || 'N/A',
      rate: speechSynthesis.rate || 'N/A',
      pitch: speechSynthesis.pitch || 'N/A'
    };

    setDiagnostics(results);
    setIsRunning(false);
  };

  const testBasicVoice = async () => {
    const testText = "Prueba básica de voz";
    addTestResult(`Iniciando prueba: "${testText}"`);
    
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(testText);
      
      utterance.onstart = () => {
        addTestResult("✅ Voz iniciada correctamente");
      };
      
      utterance.onend = () => {
        addTestResult("✅ Voz terminada correctamente");
        resolve(true);
      };
      
      utterance.onerror = (event) => {
        addTestResult(`❌ Error: ${event.error}`);
        resolve(false);
      };
      
      speechSynthesis.speak(utterance);
    });
  };

  const testVoiceWithSettings = async () => {
    const testText = "Prueba con configuración personalizada";
    addTestResult(`Iniciando prueba con configuración: "${testText}"`);
    
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.rate = 0.8;
      utterance.volume = 0.8;
      utterance.pitch = 1.2;
      utterance.lang = 'es-ES';
      
      utterance.onstart = () => {
        addTestResult("✅ Voz con configuración iniciada");
      };
      
      utterance.onend = () => {
        addTestResult("✅ Voz con configuración terminada");
        resolve(true);
      };
      
      utterance.onerror = (event) => {
        addTestResult(`❌ Error con configuración: ${event.error}`);
        resolve(false);
      };
      
      speechSynthesis.speak(utterance);
    });
  };

  const testSpanishVoice = async () => {
    const spanishVoices = speechSynthesis.getVoices().filter(v => v.lang.includes('es'));
    
    if (spanishVoices.length === 0) {
      addTestResult("❌ No hay voces en español disponibles");
      return false;
    }
    
    const testText = "Prueba con voz en español";
    addTestResult(`Iniciando prueba con voz española: "${testText}"`);
    
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(testText);
      utterance.voice = spanishVoices[0];
      utterance.lang = 'es-ES';
      
      utterance.onstart = () => {
        addTestResult(`✅ Voz española iniciada: ${spanishVoices[0].name}`);
      };
      
      utterance.onend = () => {
        addTestResult("✅ Voz española terminada");
        resolve(true);
      };
      
      utterance.onerror = (event) => {
        addTestResult(`❌ Error con voz española: ${event.error}`);
        resolve(false);
      };
      
      speechSynthesis.speak(utterance);
    });
  };

  const addTestResult = (message) => {
    setTestResults(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message
    }]);
  };

  const runAllTests = async () => {
    setTestResults([]);
    addTestResult("🧪 Iniciando pruebas de voz...");
    
    // Test 1: Voz básica
    addTestResult("📝 Prueba 1: Voz básica");
    await testBasicVoice();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Voz con configuración
    addTestResult("📝 Prueba 2: Voz con configuración");
    await testVoiceWithSettings();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Voz española
    addTestResult("📝 Prueba 3: Voz española");
    await testSpanishVoice();
    
    addTestResult("✅ Todas las pruebas completadas");
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8">🔍 Diagnóstico Completo de Voz</h1>
      
      {/* Información del Sistema */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">📊 Información del Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Soporte del Navegador:</h3>
            <ul className="text-sm space-y-1">
              <li>speechSynthesis: {diagnostics.browserSupport?.speechSynthesis ? '✅' : '❌'}</li>
              <li>SpeechSynthesisUtterance: {diagnostics.browserSupport?.speechSynthesisUtterance ? '✅' : '❌'}</li>
              <li>Navegador: {diagnostics.browserSupport?.userAgent?.split(' ')[0]}</li>
              <li>Plataforma: {diagnostics.browserSupport?.platform}</li>
              <li>Idioma: {diagnostics.browserSupport?.language}</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Estado Actual:</h3>
            <ul className="text-sm space-y-1">
              <li>Hablando: {diagnostics.currentState?.isSpeaking ? '🔊 Sí' : '🔇 No'}</li>
              <li>Pausado: {diagnostics.currentState?.isPaused ? '⏸️ Sí' : '▶️ No'}</li>
              <li>Pendiente: {diagnostics.currentState?.pending ? '⏳ Sí' : '✅ No'}</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Voces Disponibles */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">🎤 Voces Disponibles</h2>
        <div className="mb-4">
          <p><strong>Total de voces:</strong> {diagnostics.voices?.count || 0}</p>
          <p><strong>Voces en español:</strong> {diagnostics.voices?.spanishVoices?.length || 0}</p>
        </div>
        {diagnostics.voices?.list && diagnostics.voices.list.length > 0 && (
          <div className="max-h-64 overflow-y-auto">
            {diagnostics.voices.list.map((voice, index) => (
              <div key={index} className="p-2 border-b border-gray-200 text-sm">
                <strong>{voice.name}</strong> - {voice.lang} {voice.gender && `(${voice.gender})`}
                {voice.default && <span className="text-blue-600 ml-2">[Por defecto]</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pruebas de Voz */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">🧪 Pruebas de Voz</h2>
        <div className="flex gap-4 mb-4">
          <button
            onClick={runAllTests}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400"
          >
            {isRunning ? 'Ejecutando...' : '🔊 Ejecutar Todas las Pruebas'}
          </button>
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            🗑️ Limpiar Resultados
          </button>
        </div>
        
        {testResults.length > 0 && (
          <div className="bg-gray-100 p-4 rounded max-h-64 overflow-y-auto">
            {testResults.map((result, index) => (
              <div key={index} className="text-sm mb-1">
                <span className="text-gray-500">[{result.timestamp}]</span> {result.message}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solución de Problemas */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">🔧 Solución de Problemas</h2>
        <div className="space-y-2 text-sm">
          <p><strong>Si no escuchas nada:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Verifica que el volumen del sistema esté activado</li>
            <li>Asegúrate de que no hay bloqueos de audio en el navegador</li>
            <li>Prueba con un navegador diferente (Chrome funciona mejor)</li>
            <li>Verifica que no hay extensiones bloqueando el audio</li>
            <li>Revisa la consola del navegador (F12) para errores</li>
          </ul>
          
          <p className="mt-4"><strong>Si hay errores:</strong></p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Actualiza tu navegador a la última versión</li>
            <li>Reinicia el navegador</li>
            <li>Verifica que JavaScript esté habilitado</li>
            <li>Prueba en modo incógnito</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VoiceDiagnosticComplete;
