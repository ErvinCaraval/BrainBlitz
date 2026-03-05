
import React, { useState, useRef } from 'react';
import { useVoice } from '../VoiceContext';
import Button from './ui/Button';
import voiceRecognitionService from '../services/voiceRecognitionService'; // Using AssemblyAI service

const VoiceAnswerButton = ({ options, onAnswer, disabled = false }) => {
  const { isVoiceModeEnabled } = useVoice();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const isHeldRef = useRef(false); // To prevent firing mouseup after touch end
    const cleanup = () => {
      isHeldRef.current = false;
      setIsRecording(false);
      setIsProcessing(false);
    };

  if (!isVoiceModeEnabled || !voiceRecognitionService.isAvailable()) {
    return null;
  }

  const handleRecordingStart = async () => {
    if (disabled || isRecording || isProcessing) return;
    isHeldRef.current = true;
    setError('');
    setSuccessMessage('');
    try {
        // Check for permission first
        const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!permission) {
          cleanup();
          throw new Error('Se requiere permiso para usar el micrófono.');
        }
      await voiceRecognitionService.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
        cleanup();
      setError(err.message || 'No se pudo iniciar la grabación.');
    }
  };

  const handleRecordingStop = async () => {
    if (!isHeldRef.current) return; // Prevent accidental triggers
    if (!isRecording) return;

      cleanup();
    setError('');
      setIsProcessing(true);

    try {
      console.log('🎤 Deteniendo grabación y enviando audio...');
      const result = await voiceRecognitionService.stop();
      console.log('📝 Resultado recibido:', result);
      const { transcript, audioBase64, audioMimeType, assemblyAIResult } = result;

      if (!transcript) {
        throw new Error('No se detectó ninguna voz.');
      }
      
      setSuccessMessage(`Transcrito: "${transcript}"`);
      console.log('🔍 Intentando matchear respuesta:', transcript);
      
      const match = voiceRecognitionService.matchAnswer(transcript, options);
      console.log('✨ Resultado del match:', match);

      if (match.isValid) {
        console.log('✅ Respuesta válida, llamando onAnswer con índice:', match.index);
        onAnswer(match.index, audioBase64, assemblyAIResult, audioMimeType);
        setSuccessMessage(`✅ Respuesta reconocida: ${options[match.index]}`);
      } else {
        console.log('❌ No se pudo matchear la respuesta');
        setError('No pude entender tu respuesta. Inténtalo de nuevo.');
      }

    } catch (err) {
      console.error('Error stopping recording or processing:', err);
      setError(err.message || 'Error al procesar el audio.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Combine mouse and touch events
  const buttonEventHandlers = {
    onMouseDown: handleRecordingStart,
    onMouseUp: handleRecordingStop,
    onMouseLeave: handleRecordingStop, // Stop if mouse leaves button area while pressed
    onTouchStart: handleRecordingStart,
    onTouchEnd: handleRecordingStop,
  };

  // Use separate texts for desktop and mobile so the label fits on small screens
  let buttonTextDesktop = "🎤 Mantén presionado para hablar";
  let buttonTextMobile = "🎤 Mantén";
  let buttonVariant = "primary";
  let isPulsing = false;

  if (isRecording) {
    buttonTextDesktop = "🎤 Escuchando...";
    buttonTextMobile = "🎤 Escuchando";
    buttonVariant = "secondary";
    isPulsing = true;
  } else if (isProcessing) {
    buttonTextDesktop = "🔄 Procesando...";
    buttonTextMobile = "🔄 Procesando";
    buttonVariant = "secondary";
    isPulsing = true;
  }

  return (
    <div className="space-y-2 w-full">
      <Button
        {...buttonEventHandlers}
        disabled={disabled || !isVoiceModeEnabled}
        variant={buttonVariant}
        className={`w-full touch-none ${isPulsing ? 'animate-pulse' : ''}`}>
        <div className="flex items-center justify-center gap-2">
          {isRecording && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>}
          {/* Desktop: show full text on sm+ screens. Mobile: show shorter text on smaller screens */}
          <span className="hidden sm:inline">{buttonTextDesktop}</span>
          <span className="inline sm:hidden">{buttonTextMobile}</span>
        </div>
      </Button>
      {successMessage && (
        <div className="text-sm text-green-500 bg-green-500/10 border border-green-500/30 rounded p-2 text-center font-semibold animate-fade-in">
          {successMessage}
        </div>
      )}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/20 p-2 rounded text-center font-semibold">
          {error}
        </div>
      )}
    </div>
  );
};

export default VoiceAnswerButton;
