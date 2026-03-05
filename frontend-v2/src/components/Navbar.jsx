import React, { useState, useCallback, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../AuthContext'
import { useVoice } from '../VoiceContext'
import clsx from 'clsx'

function MenuIcon({ open }) {
  return (
    <div className="relative w-6 h-6 flex items-center justify-center">
      <span className={clsx(
        'block h-0.5 w-6 bg-white transition-all duration-300',
        open ? 'rotate-45 translate-y-[10px]' : ''
      )}></span>
      <span className={clsx(
        'block h-0.5 w-6 bg-white my-1 transition-opacity duration-300',
        open ? 'opacity-0' : 'opacity-100'
      )}></span>
      <span className={clsx(
        'block h-0.5 w-6 bg-white transition-all duration-300',
        open ? '-rotate-45 -translate-y-[10px]' : ''
      )}></span>
    </div>
  )
}

const navLinkClass = 'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-250 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-primary'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const isHome = location.pathname === '/'
  const { user } = useAuth()
  const { isVoiceModeEnabled, toggleVoiceMode, isVoiceAvailable, speak } = useVoice()

  const announce = useCallback((text) => {
    if (isVoiceModeEnabled) {
      speak(text, { action: 'text_read', questionId: 'nav', metadata: { origin: 'navbar' } })
    }
  }, [isVoiceModeEnabled, speak])

  const handleMobileClose = useCallback(() => setOpen(false), [])

  const navItems = useMemo(() => [
    !isHome && { label: 'Inicio', to: '/', ariaLabel: 'Ir a Inicio' },
    { label: 'Panel', to: '/dashboard', ariaLabel: 'Ir al Panel' },
    !isHome && { label: 'Ranking', to: '/ranking', ariaLabel: 'Ir al Ranking' },
  ].filter(Boolean), [isHome])

  return (
    <header className="sticky top-0 z-50 bg-bb-bg-primary/80 backdrop-blur-xl border-b border-white/10 w-full transition-all duration-300">
      <div className="flex justify-between items-center mx-auto px-4 py-3 container">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-primary rounded-lg"
          onClick={handleMobileClose}
          onFocus={() => announce('Inicio, ir a la página principal')}
        >
          <motion.div
            className="flex justify-center items-center bg-gradient-to-br from-bb-primary to-bb-accent rounded-lg w-10 h-10 font-bold text-xl shadow-glow-sm group-hover:shadow-glow transition-shadow"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ⚡
          </motion.div>
          <span className="font-bold text-lg hidden sm:inline">BrainBlitz</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-2">
          {navItems.map((item) => (
            <motion.div key={item.to} whileHover={{ y: -2 }} whileTap={{ y: 0 }}>
              <Link
                to={item.to}
                className={navLinkClass}
                onFocus={() => announce(item.ariaLabel)}
              >
                {item.label}
              </Link>
            </motion.div>
          ))}
          
          {/* Voice Mode Toggle */}
          {isVoiceAvailable && (
            <motion.button
              onClick={() => {
                const nextEnabled = !isVoiceModeEnabled
                toggleVoiceMode()
                announce(nextEnabled ? 'Modo de voz activado' : 'Modo de voz desactivado')
              }}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-250 flex items-center gap-2',
                isVoiceModeEnabled 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 hover:bg-emerald-500/30' 
                  : 'bg-white/5 text-white border border-white/10 hover:bg-white/10'
              )}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onFocus={() => announce('Alternar modo de voz')}
            >
              <span>🎤</span>
              <span className="hidden lg:inline text-xs font-semibold">
                {isVoiceModeEnabled ? 'ON' : 'OFF'}
              </span>
            </motion.button>
          )}
          
          {/* Auth Links */}
          {!user ? (
            <>
              <motion.div whileHover={{ y: -2 }} whileTap={{ y: 0 }}>
                <Link
                  to="/login"
                  className={clsx(navLinkClass, 'bg-bb-primary text-white font-semibold hover:shadow-glow')}
                  onFocus={() => announce('Ir a Iniciar sesión')}
                >
                  Iniciar
                </Link>
              </motion.div>
              <motion.div whileHover={{ y: -2 }} whileTap={{ y: 0 }}>
                <Link
                  to="/face-login"
                  className={clsx(navLinkClass, 'border border-white/20 text-white')}
                  onFocus={() => announce('Ir a Login Facial')}
                >
                  🔐 Facial
                </Link>
              </motion.div>
            </>
          ) : (
            <motion.div whileHover={{ y: -2 }} whileTap={{ y: 0 }}>
              <Link
                to="/face-register"
                className={clsx(navLinkClass, 'border border-blue-400/30 bg-blue-500/10 text-blue-300')}
                onFocus={() => announce('Ir a Registro Facial')}
              >
                📸
              </Link>
            </motion.div>
          )}
        </nav>

        {/* Mobile Menu Button */}
        <motion.button
          aria-label="Abrir menú"
          aria-expanded={open}
          className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
          onClick={() => setOpen((v) => !v)}
          whileTap={{ scale: 0.95 }}
        >
          <MenuIcon open={open} />
        </motion.button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="md:hidden bg-bb-bg-secondary/95 backdrop-blur-xl border-t border-white/10"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex flex-col gap-2 px-4 py-4 max-h-[calc(100vh-70px)] overflow-y-auto">
              {navItems.map((item) => (
                <motion.div key={item.to} initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -10, opacity: 0 }}>
                  <Link
                    to={item.to}
                    className="block px-4 py-3 rounded-lg text-base font-medium hover:bg-white/10 transition-colors"
                    onClick={handleMobileClose}
                    onFocus={() => announce(item.ariaLabel)}
                  >
                    {item.label}
                  </Link>
                </motion.div>
              ))}
              
              {isVoiceAvailable && (
                <motion.button
                  onClick={() => {
                    const nextEnabled = !isVoiceModeEnabled
                    toggleVoiceMode()
                    handleMobileClose()
                    announce(nextEnabled ? 'Modo de voz activado' : 'Modo de voz desactivado')
                  }}
                  className={clsx(
                    'w-full text-left px-4 py-3 rounded-lg text-base font-medium transition-colors',
                    isVoiceModeEnabled 
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
                      : 'bg-white/5 text-white border border-white/10'
                  )}
                  initial={{ x: -10, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -10, opacity: 0 }}
                >
                  🎤 {isVoiceModeEnabled ? 'Voz ON' : 'Voz OFF'}
                </motion.button>
              )}
              
              {!user ? (
                <>
                  <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -10, opacity: 0 }}>
                    <Link
                      to="/login"
                      className="block bg-bb-primary px-4 py-3 rounded-lg text-white text-base font-semibold hover:shadow-glow transition-all"
                      onClick={handleMobileClose}
                      onFocus={() => announce('Ir a Iniciar sesión')}
                    >
                      Iniciar sesión
                    </Link>
                  </motion.div>
                  <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -10, opacity: 0 }}>
                    <Link
                      to="/face-login"
                      className="block bg-white/10 px-4 py-3 rounded-lg text-white text-base border border-white/20 hover:bg-white/20 transition-colors"
                      onClick={handleMobileClose}
                      onFocus={() => announce('Ir a Login Facial')}
                    >
                      🔐 Login Facial
                    </Link>
                  </motion.div>
                </>
              ) : (
                <motion.div initial={{ x: -10, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -10, opacity: 0 }}>
                  <Link
                    to="/face-register"
                    className="block bg-blue-500/20 px-4 py-3 rounded-lg text-white text-base border border-blue-400/30 hover:bg-blue-500/30 transition-colors"
                    onClick={handleMobileClose}
                    onFocus={() => announce('Ir a Registro Facial')}
                  >
                    📸 Registrar Cara
                  </Link>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
