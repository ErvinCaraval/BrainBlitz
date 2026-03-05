import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { useVoice } from "../VoiceContext";
import { getSocket, disconnectSocket } from "../services/socket";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import LoadingOverlay from "../components/ui/LoadingOverlay";
import Skeleton from "../components/ui/Skeleton";

export default function GameLobbyPage() {
  const { gameId } = useParams();
  const { user } = useAuth();
  const { isVoiceModeEnabled, speak } = useVoice();
  const [players, setPlayers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [status] = useState("waiting");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Voice announce helper
  const announce = (text) => {
    if (isVoiceModeEnabled) {
      speak(text, {
        action: "text_read",
        questionId: "lobby",
        metadata: { origin: "lobby" },
      });
    }
  };

  useEffect(() => {
    if (!user) return;

    (async () => {
      if (!user) return;
      const socket = await getSocket();

      // Timeout adaptativo para evitar que se quede colgado en "Conectando a la sala..."
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      const timeoutDuration = isMobile ? 10000 : 15000; // 10s para móviles, 15s para desktop

      let connectionTimeoutId;
      let countdownInterval;

      // Forzar reconexión si no está conectado
      if (!socket.connected) {
        console.log("[GameLobbyPage] Socket no conectado, reconectando...");
        socket.disconnect();
        socket.connect();

        // Solo iniciar timeout si no está conectado
        setTimeRemaining(timeoutDuration / 1000); // Convertir a segundos

        connectionTimeoutId = setTimeout(() => {
          if (!socket.connected) {
            setConnectionTimeout(true);
            setTimeRemaining(0);
            console.warn(
              "[GameLobbyPage] Timeout de conexión alcanzado después de",
              timeoutDuration,
              "ms"
            );
          }
        }, timeoutDuration);

        // Contador visual
        countdownInterval = setInterval(() => {
          setTimeRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        console.log("[GameLobbyPage] Socket ya conectado:", socket.id);
        setConnected(true);
        setConnectionTimeout(false);
      }

      // UI optimista
      setPlayers((prev) =>
        prev.length === 0
          ? [
              {
                uid: user.uid,
                displayName: user.displayName || user.email,
                email: user.email,
              },
            ]
          : prev
      );
      setHostId((prev) => prev ?? user.uid);

      function onConnect() {
        setConnected(true);
        setConnectionTimeout(false);
        setTimeRemaining(0);
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId);
        }
        if (countdownInterval) {
          clearInterval(countdownInterval);
        }
      }
      function onDisconnect() {
        setConnected(false);
      }
      function onConnectError(error) {
        console.error("[GameLobbyPage] Error de conexión:", error);
        setConnectionTimeout(true);
        setTimeRemaining(0);
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId);
        }
        if (countdownInterval) {
          clearInterval(countdownInterval);
        }
      }

      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("connect_error", onConnectError);

      socket.emit("joinGame", {
        gameId,
        uid: user.uid,
        displayName: user.displayName || user.email,
      });

      socket.on("playerJoined", ({ players }) => {
        setPlayers(players);
        if (players.length > 0) setHostId(players[0].uid);
      });

      socket.on("gameStarted", () => {
        console.log(
          "[GameLobbyPage] Evento gameStarted recibido, navegando a /game/" +
            gameId
        );
        navigate(`/game/${gameId}`);
      });

      socket.on("error", ({ error }) => {
        setError(error);
      });

      // cleanup
      return () => {
        if (connectionTimeoutId) {
          clearTimeout(connectionTimeoutId);
        }
        if (countdownInterval) {
          clearInterval(countdownInterval);
        }
        socket.off("playerJoined");
        socket.off("gameStarted");
        socket.off("error");
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onConnectError);
        disconnectSocket();
      };
    })();
  }, [gameId, user, navigate]);

  const handleStart = () => {
    console.log("[GameLobbyPage] Emitiendo startGame:", { gameId });
    (async () => {
      const socket = await getSocket();
      socket.emit("startGame", { gameId });
    })();
  };

  const copyGameCode = () => {
    navigator.clipboard.writeText(gameId);
    alert("Game code copied to clipboard!");
  };

  const retryConnection = async () => {
    setConnectionTimeout(false);
    setConnected(false);

    try {
      const socket = await getSocket();
      console.log("[GameLobbyPage] Reintentando conexión...");

      // Desconectar completamente y reconectar
      socket.disconnect();
      socket.removeAllListeners();

      // Esperar un momento antes de reconectar
      setTimeout(() => {
        socket.connect();
      }, 1000);
    } catch (error) {
      console.error("[GameLobbyPage] Error al reintentar conexión:", error);
      setConnectionTimeout(true);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen container px-4 py-10">
        <Alert intent="error" className="mb-4">
          {error === "Game already started"
            ? "La partida ya ha comenzado. No puedes unirte en este momento."
            : error}
        </Alert>
        <Button
          onClick={() => navigate("/dashboard")}
          onFocus={() => announce("Volver al panel principal")}
          onMouseEnter={() => announce("Volver al panel principal")}
        >
          Volver al inicio
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen container px-4 py-8">
      {!connected && !connectionTimeout && (
        <span className="sr-only" aria-live="polite">
          {`Conectando a la sala ${
            timeRemaining > 0 ? `(${timeRemaining}s)` : ""
          }`}
        </span>
      )}
      {!connected && !connectionTimeout && (
        <LoadingOverlay
          text={`Conectando a la sala… ${
            timeRemaining > 0 ? `(${timeRemaining}s)` : ""
          }`}
          mobileOnly
        />
      )}
      {connectionTimeout && (
        <div
          className="fixed inset-0 z-[3500] flex items-center justify-center px-6 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lobby-conn-title"
          aria-describedby="lobby-conn-desc"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-bb-bg-primary/90 px-6 py-4 shadow-xl">
            <div className="text-center">
              <div id="lobby-conn-title" className="text-lg font-semibold mb-2">
                ⚠️ Problema de conexión
              </div>
              <p id="lobby-conn-desc" className="text-sm text-white/80 mb-4">
                No se pudo conectar a la sala. Esto puede deberse a problemas de
                red o el servidor.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={retryConnection}
                  title="Reintentar conexión"
                >
                  🔄 Reintentar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard")}
                  title="Volver al inicio"
                >
                  🏠 Volver
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">🎮 Sala de Juego</h1>
          <p className="text-white/70">
            Comparte el código para que tus amigos se unan
          </p>
          {isVoiceModeEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={async () => {
                const parts = [];
                parts.push("Estás en la sala de juego.");
                parts.push(
                  "Arriba está el código de la partida que puedes copiar para compartir."
                );
                parts.push(
                  "A la izquierda verás la lista de jugadores conectados."
                );
                parts.push(
                  "A la derecha están las acciones: iniciar partida si eres anfitrión, o esperar si eres jugador."
                );
                parts.push(
                  "El anfitrión puede iniciar cuando haya al menos un jugador."
                );
                speak(parts.join(" "), {
                  action: "page_guide",
                  questionId: "lobby",
                  force: true,
                });
              }}
              aria-label="Explicar la página"
              title="Explicar la página"
            >
              🛈 Explicar página
            </Button>
          )}
        </div>
        <Card className="w-full md:w-auto">
          <CardBody className="flex items-center gap-3">
            <div>
              <div className="text-sm text-white/70">Código</div>
              <div className="text-xl font-bold tracking-widest">{gameId}</div>
            </div>
            <Button
              variant="secondary"
              onClick={copyGameCode}
              aria-label="Copiar código"
              onFocus={() => announce("Copiar código de la partida")}
              onMouseEnter={() => announce("Copiar código de la partida")}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-primary"
              title="Copiar código"
            >
              📋 Copiar
            </Button>
          </CardBody>
        </Card>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <h3 className="text-2xl font-semibold">
              👥 Jugadores ({players.length})
            </h3>
          </CardHeader>
          <CardBody>
            <div
              className="grid gap-3 sm:grid-cols-2"
              role="list"
              aria-label="Lista de jugadores"
            >
              <AnimatePresence>
                {(players && players.length > 0
                  ? players
                  : connected
                  ? []
                  : Array.from({ length: 4 }).map((_, i) => ({
                      uid: `sk-${i}`,
                      _sk: true,
                    }))
                ).map((player) => (
                  <motion.div
                    key={player.uid}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ type: "spring", stiffness: 140, damping: 16 }}
                    className={`flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-transform duration-150 hover:-translate-y-0.5 ${
                      player.uid === hostId ? "ring-1 ring-bb-primary/50" : ""
                    }`}
                    role="listitem"
                    aria-label={
                      player._sk
                        ? "Cargando jugador"
                        : `${player.displayName || player.email}${
                            player.uid === hostId ? " (Anfitrión)" : ""
                          }`
                    }
                  >
                    {player._sk ? (
                      <>
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1 min-w-0">
                          <Skeleton className="h-4 w-40" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xl">
                          {player.uid === hostId ? "👑" : "👤"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">
                            {player.displayName || player.email}
                          </div>
                          {player.uid === hostId && (
                            <div className="text-xs text-white/70">
                              Anfitrión
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-2xl font-semibold">Acciones</h3>
          </CardHeader>
          <CardBody className="space-y-3">
            {user && user.uid === hostId && status === "waiting" ? (
              <>
                <p>¿Listo para comenzar la partida?</p>
                <Button
                  onClick={handleStart}
                  disabled={players.length < 1}
                  size="lg"
                  onFocus={() => announce("Iniciar la partida")}
                  onMouseEnter={() => announce("Iniciar la partida")}
                  aria-disabled={players.length < 1}
                  title={
                    players.length < 1
                      ? "Esperando jugadores"
                      : "Iniciar partida"
                  }
                  aria-describedby={
                    players.length < 1 ? "players-waiting-hint" : undefined
                  }
                >
                  🚀 Iniciar partida
                </Button>
                {players.length < 1 && (
                  <p
                    id="players-waiting-hint"
                    className="text-sm text-white/70"
                  >
                    Esperando a que se unan jugadores...
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3" aria-live="polite">
                <span>⏳</span>
                <p className="text-sm text-white/80">
                  Esperando a que el anfitrión inicie la partida…
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
