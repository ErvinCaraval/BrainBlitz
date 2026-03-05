import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import backendAuthService from '../services/backendAuthService'
import { useNavigate, Link } from 'react-router-dom'
import { useVoice } from '../VoiceContext'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Alert from '../components/ui/Alert'
import { Card, CardBody, CardHeader } from '../components/ui/Card'

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [visualDifficulty, setVisualDifficulty] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { isVoiceModeEnabled, speak } = useVoice()

  const announce = useCallback((text) => {
    if (isVoiceModeEnabled) {
      speak(text, { action: 'text_read', questionId: 'register', metadata: { origin: 'register' } })
    }
  }, [isVoiceModeEnabled, speak])

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const displayName = email.split('@')[0]
      await backendAuthService.register(email, password, displayName, visualDifficulty)
      announce('Cuenta creada exitosamente. Redirigiendo a registro facial.')
      navigate('/face-register')
    } catch (err) {
      const errorMsg = err.message || 'Error desconocido'
      setError(errorMsg)
      announce(`Error: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container min-h-screen px-4 py-10 grid place-items-center">
      <motion.div
        className="w-full max-w-md"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <Card animated={false} className="overflow-visible">
          <CardHeader className="text-center space-y-4">
            <motion.div
              className="inline-flex justify-center items-center bg-gradient-to-br from-bb-primary to-bb-accent rounded-xl w-16 h-16 font-bold text-2xl mx-auto shadow-glow"
              whileHover={{ scale: 1.05 }}
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              ⚡
            </motion.div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold">¡Únete a BrainBlitz!</h1>
              <p className="text-white/70">Crea tu cuenta y comienza a jugar ahora</p>
            </div>
          </CardHeader>

          <CardBody className="space-y-5">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert intent="error" onClose={() => setError('')}>
                  {error}
                </Alert>
              </motion.div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                <label htmlFor="email" className="block mb-2 text-sm font-medium text-white/80">
                  📧 Correo Electrónico
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tú@correo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  onFocus={() => announce('Campo de correo electrónico')}
                />
              </motion.div>

              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                <label htmlFor="password" className="block mb-2 text-sm font-medium text-white/80">
                  🔑 Contraseña
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  onFocus={() => announce('Campo de contraseña')}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-3 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-400/20 hover:border-blue-400/40 transition-colors"
              >
                <input
                  id="visualDifficulty"
                  type="checkbox"
                  checked={visualDifficulty}
                  onChange={(e) => setVisualDifficulty(e.target.checked)}
                  disabled={loading}
                  className="h-5 w-5 cursor-pointer accent-blue-500"
                />
                <label htmlFor="visualDifficulty" className="text-sm text-white/90 cursor-pointer font-medium">
                  👁️ Tengo dificultades visuales (activaré modo voz)
                </label>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full"
                  onFocus={() => announce('Crear cuenta')}
                >
                  {loading ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        ⏳
                      </motion.span>
                      Creando cuenta...
                    </>
                  ) : (
                    '✨ Crear Cuenta'
                  )}
                </Button>
              </motion.div>
            </form>

            <motion.div
              className="space-y-3 pt-4 border-t border-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <div className="text-center text-sm">
                <p>
                  ¿Ya tienes cuenta?{' '}
                  <Link
                    to="/login"
                    className="text-bb-primary hover:text-bb-primary-light font-semibold transition-colors"
                    onFocus={() => announce('Ir a iniciar sesión')}
                  >
                    Inicia sesión aquí
                  </Link>
                </p>
              </div>

              <p className="text-white/60 text-xs text-center bg-blue-500/10 p-3 rounded-lg border border-blue-400/20">
                💡 Después de crear tu cuenta, registraremos tu reconocimiento facial para login más rápido
              </p>
            </motion.div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}