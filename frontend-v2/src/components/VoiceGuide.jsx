import React, { useState, useEffect } from 'react';
import { useVoice } from '../VoiceContext';
import Button from './ui/Button';
import { Card, CardBody, CardHeader } from './ui/Card';
import Alert from './ui/Alert';

const VoiceGuide = ({ onComplete }) => {
  const { speak, isVoiceModeEnabled, enableVoiceMode } = useVoice();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userConfirmed, setUserConfirmed] = useState(false);

  const steps = [
    {
      title: "¡Bienvenido a BrainBlitz!",
      message: "Te voy a guiar por la aplicación usando voz. Escucha atentamente y sigue las instrucciones.",
      action: "Escucha"
    },
    {
      title: "Navegación Principal",
      message: "En la parte superior verás el menú de navegación. Puedes ir a Inicio, Jugar, Perfil y más opciones.",
      action: "Continuar"
    },
    {
      title: "Crear una Partida",
      message: "Para crear una partida, haz clic en el botón 'Crear Partida' o 'Jugar'. Te llevará a la configuración del juego.",
      action: "Continuar"
    },
    {
      title: "Unirse a una Partida",
      message: "Para unirte a una partida existente, haz clic en 'Unirse a Partida' e ingresa el código de 6 dígitos.",
      action: "Continuar"
    },
    {
      title: "Durante el Juego",
      message: "Las preguntas se leerán automáticamente. Puedes responder haciendo clic en las opciones o usando tu voz.",
      action: "Continuar"
    },
    {
      title: "Configuración de Voz",
      message: "En tu perfil puedes ajustar la velocidad, volumen y tipo de voz según tus preferencias.",
      action: "Continuar"
    },
    {
      title: "¡Listo para Jugar!",
      message: "Ya conoces lo básico. ¡Disfruta jugando BrainBlitz! Si necesitas ayuda, siempre puedes volver a este tutorial.",
      action: "Finalizar"
    }
  ];

  const currentStepData = steps[currentStep];

  useEffect(() => {
    if (isVoiceModeEnabled && currentStepData) {
      speakStep();
    }
  }, [currentStep, isVoiceModeEnabled]);

  const speakStep = async () => {
    if (!isVoiceModeEnabled) return;
    
    setIsSpeaking(true);
    try {
      await speak(`${currentStepData.title}. ${currentStepData.message}`);
    } catch (error) {
      console.error('Error speaking step:', error);
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const handleRepeat = () => {
    speakStep();
  };

  const handleConfirm = () => {
    setUserConfirmed(true);
    if (!isVoiceModeEnabled) {
      enableVoiceMode();
    }
  };

  if (!userConfirmed) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <h2 className="text-2xl font-bold text-center">🎤 Guía de Voz</h2>
        </CardHeader>
        <CardBody className="text-center space-y-4">
          <p className="text-lg">
            Detectamos que tienes dificultades visuales. ¿Te gustaría que te guíe por la aplicación usando voz?
          </p>
          <div className="flex gap-4 justify-center">
            <Button onClick={handleConfirm} variant="primary" size="lg">
              🔊 Sí, guíame con voz
            </Button>
            <Button onClick={handleSkip} variant="secondary" size="lg">
              ⏭️ Saltar guía
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <h2 className="text-2xl font-bold text-center">🎤 Guía de Voz</h2>
        <div className="text-center text-sm text-white/70">
          Paso {currentStep + 1} de {steps.length}
        </div>
      </CardHeader>
      <CardBody className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">{currentStepData.title}</h3>
          <p className="text-white/80 mb-4">{currentStepData.message}</p>
          
          {isSpeaking && (
            <div className="flex items-center justify-center gap-2 text-blue-400">
              <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"></div>
              <span>Hablando...</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-center">
          <Button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            variant="secondary"
          >
            ⬅️ Anterior
          </Button>
          
          <Button
            onClick={handleRepeat}
            disabled={isSpeaking}
            variant="outline"
          >
            🔄 Repetir
          </Button>
          
          <Button
            onClick={handleNext}
            variant="primary"
          >
            {currentStep === steps.length - 1 ? '✅ Finalizar' : '➡️ Siguiente'}
          </Button>
        </div>

        <div className="text-center">
          <Button onClick={handleSkip} variant="secondary" size="sm">
            ⏭️ Saltar guía
          </Button>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-white/20 rounded-full h-2">
          <div 
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </CardBody>
    </Card>
  );
};

export default VoiceGuide;
