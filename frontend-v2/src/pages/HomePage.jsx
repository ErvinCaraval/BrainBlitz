import React, { useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../AuthContext'
import { useVoice } from '../VoiceContext'
import Layout from '../components/Layout'
import { Card, CardBody } from '../components/ui/Card'
import Button from '../components/ui/Button'

const features = [
  { icon: '⚡', title: 'Juego en Tiempo Real', description: 'Juega con amigos con puntuación instantánea y partidas dinámicas' },
  { icon: '🎮', title: 'Fácil de Unirse', description: 'Únete con códigos de 6 dígitos o explora partidas públicas' },
  { icon: '🤝', title: 'Compite con Amigos', description: 'Sigue tus estadísticas y demuestra tus conocimientos' },
  { icon: '🔐', title: 'Autenticación Facial', description: 'Inicia sesión de forma rápida y segura con reconocimiento facial' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
}

function FeatureCard({ feature, index, user }) {
  const isFacialFeature = index === 3

  return (
    <motion.div
      variants={itemVariants}
      className="h-full"
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <Card animated={false} className="h-full flex flex-col justify-between">
        <CardBody className="text-center space-y-4 p-6 flex-1 flex flex-col justify-between">
          <motion.div
            className="text-5xl inline-block"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: index * 0.2 }}
          >
            {feature.icon}
          </motion.div>
          <div>
            <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
            <p className="text-white/70 text-sm leading-relaxed">
              {feature.description}
            </p>
          </div>

          {isFacialFeature && (
            <motion.div
              className="flex flex-col gap-3 mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {!user ? (
                <>
                  <Button as={Link} to="/face-login" variant="outline" size="sm">
                    🔐 Probar Login Facial
                  </Button>
                  <p className="text-white/50 text-xs">
                    💡 Registrate primero para registrar tu cara
                  </p>
                </>
              ) : (
                <Button as={Link} to="/face-register" variant="secondary" size="sm">
                  📸 Registrar Mi Cara
                </Button>
              )}
            </motion.div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  )
}

export default function HomePage() {
  const { user } = useAuth()
  const { isVoiceModeEnabled, speak } = useVoice()

  const announce = useCallback((text) => {
    if (isVoiceModeEnabled) {
      speak(text, { action: 'page_guide', questionId: 'home', metadata: { origin: 'home' } })
    }
  }, [isVoiceModeEnabled, speak])

  const buttonVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 100, damping: 15 },
    },
  }), [])

  return (
    <Layout>
      <div className="min-h-screen flex flex-col items-center justify-start py-12 px-4 gap-16 md:gap-20">
        {/* Hero Section */}
        <motion.section
          className="w-full max-w-4xl mx-auto text-center space-y-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100, damping: 15 }}
          >
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-extrabold bg-gradient-to-r from-bb-primary via-bb-secondary to-bb-accent bg-clip-text text-transparent animate-pulse">
              ⚡ BrainBlitz
            </h1>
          </motion.div>

          <motion.p
            className="text-white/80 text-lg md:text-xl lg:text-2xl max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            La experiencia definitiva de trivia multijugador. Desafía tus límites intelectuales en tiempo real con amigos de todo el mundo.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex justify-center gap-4 flex-wrap"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {user ? (
              <>
                <motion.div variants={buttonVariants}>
                  <Button
                    as={Link}
                    to="/dashboard"
                    size="lg"
                    onFocus={() => announce('Ir al panel de control')}
                  >
                    🚀 Ir al Panel
                  </Button>
                </motion.div>
                <motion.div variants={buttonVariants}>
                  <Button
                    as={Link}
                    to="/face-register"
                    variant="secondary"
                    size="lg"
                    onFocus={() => announce('Registrar reconocimiento facial')}
                  >
                    📸 Registrar Cara
                  </Button>
                </motion.div>
              </>
            ) : (
              <>
                <motion.div variants={buttonVariants}>
                  <Button
                    as={Link}
                    to="/login"
                    size="lg"
                    onFocus={() => announce('Iniciar sesión')}
                  >
                    🔓 Iniciar Sesión
                  </Button>
                </motion.div>
                <motion.div variants={buttonVariants}>
                  <Button
                    as={Link}
                    to="/register"
                    variant="secondary"
                    size="lg"
                    onFocus={() => announce('Crear nueva cuenta')}
                  >
                    ✨ Registrarse
                  </Button>
                </motion.div>
                <motion.div variants={buttonVariants}>
                  <Button
                    as={Link}
                    to="/face-login"
                    variant="outline"
                    size="lg"
                    onFocus={() => announce('Login con reconocimiento facial')}
                  >
                    🔐 Login Facial
                  </Button>
                </motion.div>
              </>
            )}
          </motion.div>

          {isVoiceModeEnabled && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => announce('BrainBlitz es la experiencia definitiva de trivia multijugador. Tienes cuatro opciones principales: juego en tiempo real, unirse fácilmente, competir con amigos, y autenticación facial segura.')}
              >
                🎙️ Leer descripción
              </Button>
            </motion.div>
          )}
        </motion.section>

        {/* Features Section */}
        <motion.section
          className="w-full max-w-6xl mx-auto space-y-12 px-0"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: '0px 0px -100px 0px' }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="text-center space-y-4"
            initial={{ opacity: 0, y: -10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold">Características Principales</h2>
            <p className="text-white/60 max-w-2xl mx-auto">
              Descubre qué hace a BrainBlitz la plataforma de trivia perfecta
            </p>
          </motion.div>

          <motion.div
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 auto-rows-max"
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '0px 0px -100px 0px' }}
          >
            {features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                feature={feature}
                index={index}
                user={user}
              />
            ))}
          </motion.div>
        </motion.section>
      </div>
    </Layout>
  )
}
