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

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { isVoiceModeEnabled, speak } = useVoice()

  const announce = useCallback((text) => {
    if (isVoiceModeEnabled) {
      speak(text, { action: 'text_read', questionId: 'login', metadata: { origin: 'login' } })
    }
  }, [isVoiceModeEnabled, speak])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await backendAuthService.login(email, password)
      announce('Sesión iniciada exitosamente. Redirigiendo al panel.')
      navigate('/dashboard')
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
              <h1 className="text-3xl font-extrabold">Bienvenido</h1>
              <p className="text-white/70">Inicia sesión para continuar tu aventura de trivia</p>
            </div>

            {isVoiceModeEnabled && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => announce('Estás en la página de inicio de sesión. Ingresa tu correo electrónico y contraseña. Si no tienes cuenta, puedes registrarte.')}
                  className="w-full"
                >
                  🛈 Explicar página
                </Button>
              </motion.div>
            )}
          </CardHeader>

          <CardBody className="space-y-5">
            {error && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <Alert intent="error" onClose={() => setError('')}>
                  {error}
                </Alert>
              </motion.div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
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
                  className="transition-all duration-250"
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
                  className="transition-all duration-250"
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Button
                  type="submit"
                  size="lg"
                  disabled={loading}
                  className="w-full"
                  onFocus={() => announce('Botón de iniciar sesión')}
                >
                  {loading ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        ⏳
                      </motion.span>
                      Iniciando...
                    </>
                  ) : (
                    '🚀 Iniciar Sesión'
                  )}
                </Button>
              </motion.div>
            </form>

            <motion.div
              className="space-y-3 pt-4 border-t border-white/10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Link
                to="/reset"
                className="block text-center text-sm text-bb-primary hover:text-bb-primary-light transition-colors"
                onFocus={() => announce('Recuperar contraseña')}
              >
                ¿Olvidaste tu contraseña?
              </Link>

              <div className="text-center text-sm space-y-2">
                <p>
                  ¿No tienes cuenta?{' '}
                  <Link
                    to="/register"
                    className="text-bb-primary hover:text-bb-primary-light font-semibold transition-colors"
                    onFocus={() => announce('Crear nueva cuenta')}
                  >
                    Regístrate aquí
                  </Link>
                </p>
                <p>
                  <Link
                    to="/face-login"
                    className="text-bb-accent hover:text-bb-accent-light font-semibold transition-colors"
                    onFocus={() => announce('Login con reconocimiento facial')}
                  >
                    🔐 O usa reconocimiento facial
                  </Link>
                </p>
              </div>
            </motion.div>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  )
}