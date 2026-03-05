import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useVoice } from '../VoiceContext';
import Button from './ui/Button';
import Alert from './ui/Alert';
import { Card, CardBody, CardHeader } from './ui/Card';
import LoadingOverlay from './ui/LoadingOverlay';

const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: 'Bienvenido al Tutorial de Voz',
    content: 'Te damos la bienvenida al tutorial de accesibilidad de BrainBlitz. Este tutorial te enseñará cómo usar todas las funcionalidades de voz disponibles.',
    duration: 8000
  },
  {
    id: 'voice_mode',
    title: 'Modo de Voz',
    content: 'El modo de voz se activa automáticamente si indicaste tener dificultades visuales durante el registro. También puedes activarlo manualmente desde la barra de navegación.',
    duration: 10000
  },
  {
    id: 'question_reading',
    title: 'Lectura de Preguntas',
    content: 'Cuando aparezca una pregunta, se leerá automáticamente junto con todas las opciones de respuesta. También puedes usar el botón "Leer" para repetir la pregunta.',
    duration: 12000
  },
  {
    id: 'voice_settings',
    title: 'Configuración de Voz',
    content: 'Puedes personalizar la voz, velocidad, volumen y tono en la configuración. Usa el botón "Probar Voz" para escuchar cómo suenan los cambios.',
    duration: 10000
  },
  {
    id: 'voice_answers',
    title: 'Respuestas por Voz',
    content: 'Puedes responder a las preguntas diciendo "A", "B", "C", "D" o "primera opción", "segunda opción", etc. El sistema reconocerá tu respuesta.',
    duration: 12000
  },
  {
    id: 'voice_history',
    title: 'Historial de Voz',
    content: 'Todas tus interacciones de voz se registran en tu historial personal. Puedes ver estadísticas de uso y exportar tus datos.',
    duration: 8000
  },
  {
    id: 'navigation',
    title: 'Navegación por Voz',
    content: 'Usa los botones de navegación para moverte por la aplicación. El modo de voz te ayudará a entender qué hace cada botón.',
    duration: 8000
  },
  {
    id: 'completion',
    title: 'Tutorial Completado',
    content: '¡Felicitaciones! Has completado el tutorial de accesibilidad. Ahora puedes disfrutar de BrainBlitz con todas las funcionalidades de voz activadas.',
    duration: 6000
  }
];

export default function AudioTutorial({ onComplete, onSkip }) {
  const { 
    isVoiceModeEnabled, 
    speak, 
    stopSpeaking, 
    isVoiceAvailable,
    voiceInteractionsService 
  } = useVoice();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentTutorialStep = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const isFirstStep = currentStep === 0;

  useEffect(() => {
    // Auto-start tutorial if voice mode is enabled
    if (isVoiceModeEnabled && isVoiceAvailable && !isPlaying && !isPaused) {
      startTutorial();
    }
  }, [isVoiceModeEnabled, isVoiceAvailable]);

  const startTutorial = async () => {
    if (!isVoiceModeEnabled) {
      setError('Activa el modo de voz para usar el tutorial');
      return;
    }

    setLoading(true);
    setError('');
    setIsPlaying(true);
    setIsPaused(false);
    setProgress(0);

    try {
      // Log tutorial start
      if (voiceInteractionsService && user?.uid) {
        await voiceInteractionsService.logTutorialInteraction(
          user.uid,
          0,
          'start',
          0
        );
      }
      await playCurrentStep(0);
    } catch (error) {
      setError('Error reproduciendo el tutorial: ' + error.message);
      setIsPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  const playCurrentStep = async (stepIndex = currentStep) => {
    const step = TUTORIAL_STEPS[stepIndex];
    const fullText = `${step.title}. ${step.content}`;
    
    // Log tutorial interaction
    if (voiceInteractionsService && user?.uid) {
      await voiceInteractionsService.logTutorialInteraction(
        user.uid,
        stepIndex,
        'step',
        step.duration
      );
    }

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (step.duration / 100));
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 100);

    try {
      await speak(fullText, {
        action: 'tutorial_step',
        questionId: 'tutorial',
        metadata: {
          stepId: step.id,
          stepTitle: step.title,
          stepIndex
        }
      });
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
    }
  };

  const pauseTutorial = () => {
    stopSpeaking();
    setIsPaused(true);
    setIsPlaying(false);
  };

  const resumeTutorial = async () => {
    setIsPaused(false);
    setIsPlaying(true);
    await playCurrentStep();
  };

  const stopTutorial = () => {
    stopSpeaking();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
  };

  const nextStep = async () => {
    if (isLastStep) {
      await completeTutorial();
      return;
    }

    setCurrentStep(prev => {
      const next = prev + 1;
      setProgress(0);
      if (isPlaying) {
        // Play using the next index to avoid stale state
        playCurrentStep(next);
      }
      return next;
    });
  };

  const previousStep = async () => {
    if (isFirstStep) return;

    setCurrentStep(prev => {
      const prevIdx = prev - 1;
      setProgress(0);
      if (isPlaying) {
        playCurrentStep(prevIdx);
      }
      return prevIdx;
    });
  };

  const completeTutorial = async () => {
    setLoading(true);
    
    try {
      // Log tutorial completion
      if (voiceInteractionsService && user?.uid) {
        await voiceInteractionsService.logTutorialInteraction(
          user.uid,
          currentStep,
          'completed',
          0
        );
      }

      await speak('Tutorial completado. ¡Disfruta de BrainBlitz!', {
        action: 'tutorial_completed',
        questionId: 'tutorial'
      });

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      setError('Error completando el tutorial: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const skipTutorial = () => {
    stopTutorial();
    if (onSkip) {
      onSkip();
    }
  };

  if (!isVoiceAvailable) {
    return (
      <Card>
        <CardBody>
          <Alert intent="warning">
            El tutorial de voz no está disponible en tu navegador. 
            Asegúrate de usar un navegador compatible como Chrome, Firefox o Safari.
          </Alert>
        </CardBody>
      </Card>
    );
  }

  if (!isVoiceModeEnabled) {
    return (
      <Card>
        <CardBody className="p-6">
          <Alert intent="info">
            <div className="space-y-4 p-4">
              <p className="text-base leading-relaxed">Activa el modo de voz para acceder al tutorial de accesibilidad.</p>
              <Button onClick={() => window.location.reload()} className="mt-2">
                Activar Modo de Voz
              </Button>
            </div>
          </Alert>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-xl font-semibold">Tutorial de Accesibilidad</h3>
        <p className="text-white/70">
          Paso {currentStep + 1} de {TUTORIAL_STEPS.length}: {currentTutorialStep.title}
        </p>
      </CardHeader>
      <CardBody className="space-y-6">
        {loading && <LoadingOverlay />}

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-white/70">
            <span>Progreso del paso</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-white/20 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="p-4 bg-white/5 rounded-lg">
          <h4 className="font-medium text-white/90 mb-2">
            {currentTutorialStep.title}
          </h4>
          <p className="text-white/80 text-sm leading-relaxed">
            {currentTutorialStep.content}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3">
          {!isPlaying && !isPaused && (
            <Button onClick={startTutorial} variant="primary">
              ▶️ Iniciar Tutorial
            </Button>
          )}

          {isPlaying && (
            <Button onClick={pauseTutorial} variant="secondary">
              ⏸️ Pausar
            </Button>
          )}

          {isPaused && (
            <Button onClick={resumeTutorial} variant="primary">
              ▶️ Continuar
            </Button>
          )}

          {(isPlaying || isPaused) && (
            <Button onClick={stopTutorial} variant="outline">
              ⏹️ Detener
            </Button>
          )}

          {!isFirstStep && (
            <Button onClick={previousStep} variant="secondary">
              ⏮️ Anterior
            </Button>
          )}

          {!isLastStep && (
            <Button onClick={nextStep} variant="primary">
              ⏭️ Siguiente
            </Button>
          )}

          {isLastStep && (
            <Button onClick={completeTutorial} variant="primary">
              ✅ Completar
            </Button>
          )}

          <Button onClick={skipTutorial} variant="outline">
            ⏭️ Omitir Tutorial
          </Button>
        </div>

        {/* Step Navigation */}
        <div className="flex justify-center">
          <div className="flex gap-2">
            {TUTORIAL_STEPS.map((_, index) => (
              <button
                key={index}
                onClick={() => {
                  setCurrentStep(() => {
                    setProgress(0);
                    if (isPlaying) {
                      playCurrentStep(index);
                    }
                    return index;
                  });
                }}
                className={`w-3 h-3 rounded-full transition-colors ${
                  index === currentStep 
                    ? 'bg-blue-500' 
                    : index < currentStep 
                      ? 'bg-green-500' 
                      : 'bg-white/30'
                }`}
                title={`Paso ${index + 1}: ${TUTORIAL_STEPS[index].title}`}
              />
            ))}
          </div>
        </div>

        {error && (
          <Alert intent="error">{error}</Alert>
        )}
      </CardBody>
    </Card>
  );
}
