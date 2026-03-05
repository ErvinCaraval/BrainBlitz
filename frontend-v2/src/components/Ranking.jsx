import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

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
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 100, damping: 15 },
  },
}

export default function Ranking({ players = [] }) {
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => b.score - a.score), [players])

  const getRankIcon = (index) => {
    switch (index) {
      case 0: return '🥇'
      case 1: return '🥈'
      case 2: return '🥉'
      default: return `#${index + 1}`
    }
  }

  const getAccent = (index) => {
    switch (index) {
      case 0: return 'from-amber-500/25 to-amber-500/10 ring-amber-400/50 border-amber-400/40'
      case 1: return 'from-slate-400/25 to-slate-400/10 ring-slate-400/50 border-slate-400/40'
      case 2: return 'from-orange-500/25 to-orange-500/10 ring-orange-400/50 border-orange-400/40'
      default: return 'from-white/10 to-white/5 ring-white/10 border-white/10'
    }
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h3 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <span>Tabla de Posiciones</span>
        </h3>
        <p className="text-white/60 text-sm mt-1">
          {sortedPlayers.length} jugador{sortedPlayers.length !== 1 ? 'es' : ''}
        </p>
      </motion.div>

      <motion.div
        className="flex flex-col gap-3"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {sortedPlayers.map((player, index) => (
          <motion.div
            key={player.uid}
            variants={itemVariants}
            className={clsx(
              'flex items-center gap-4 rounded-xl border px-4 py-4 ring-1 ring-inset',
              'bg-gradient-to-br backdrop-blur-md transition-all duration-300',
              'hover:scale-102 hover:shadow-lg',
              getAccent(index)
            )}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* Rank Badge */}
            <motion.div
              className={clsx(
                'flex justify-center items-center rounded-lg w-12 h-12 text-xl font-bold',
                index === 0 && 'bg-gradient-to-br from-amber-400/40 to-yellow-400/20',
                index === 1 && 'bg-gradient-to-br from-slate-400/40 to-slate-300/20',
                index === 2 && 'bg-gradient-to-br from-orange-400/40 to-orange-300/20',
                !([0, 1, 2].includes(index)) && 'bg-white/10'
              )}
              whileHover={{ scale: 1.1, rotate: 5 }}
            >
              {getRankIcon(index)}
            </motion.div>

            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base md:text-lg truncate">
                {player.displayName || player.email || 'Jugador'}
              </div>
              <div className="text-white/70 text-sm">
                {player.score || 0} puntos
              </div>
            </div>

            {/* Score Display */}
            <motion.div
              className="flex flex-col items-end"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 150 }}
            >
              <div className="text-xl md:text-2xl font-bold text-bb-primary-light">
                {player.score || 0}
              </div>
              <div className="text-xs text-white/50 font-medium">pts</div>
            </motion.div>
          </motion.div>
        ))}

        {sortedPlayers.length === 0 && (
          <motion.div
            className="text-center py-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-white/60 text-lg">Sin jugadores todavía</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}