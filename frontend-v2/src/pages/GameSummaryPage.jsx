import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVoice } from '../VoiceContext';
import Ranking from '../components/Ranking';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function GameSummaryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isVoiceModeEnabled, speak } = useVoice();
  const players = location.state?.players || [];

  // Voice announce helper
  const announce = (text) => {
    if (isVoiceModeEnabled) {
      speak(text, { action: 'text_read', questionId: 'summary', metadata: { origin: 'summary' } });
    }
  };

  return (
    <div className="container min-h-screen px-4 py-8">
      <Card className="mx-auto max-w-3xl">
        <CardHeader className="text-center">
          <h2 className="text-3xl font-bold">¡Juego finalizado!</h2>
          <p className="mt-1 text-white/80">¡Felicidades a todos los participantes!</p>
          {isVoiceModeEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={async () => {
                const parts = []
                parts.push('Estás en la página de resumen del juego.')
                parts.push('Aquí puedes ver el ranking final con las puntuaciones de todos los jugadores.')
                parts.push('Puedes volver al panel principal para crear o unirte a otra partida.')
                speak(parts.join(' '), { action: 'page_guide', questionId: 'summary', force: true })
              }}
              aria-label="Explicar la página"
              title="Explicar la página"
            >
              🛈 Explicar página
            </Button>
          )}
        </CardHeader>
        <CardBody>
          <div role="region" aria-label="Ranking final de jugadores">
            <Ranking players={players} />
          </div>
          <div className="mt-8 flex justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate('/dashboard')}
              onFocus={() => announce('Volver al panel principal')}
              onMouseEnter={() => announce('Volver al panel principal')}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-primary"
              title="Volver al panel principal"
            >
              🏠 Volver al Panel Principal
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}