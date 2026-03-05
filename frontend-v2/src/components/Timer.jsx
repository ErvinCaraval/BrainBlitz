import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'

export default function Timer({ seconds = 20, onEnd, onTick }) {
  const [time, setTime] = useState(seconds)
  const intervalRef = useRef()
  const onEndRef = useRef(onEnd)
  const onTickRef = useRef(onTick)

  // Mantener referencias actualizadas
  useEffect(() => {
    onEndRef.current = onEnd
  }, [onEnd])

  useEffect(() => {
    onTickRef.current = onTick
  }, [onTick])

  // Resetear el timer cuando cambian los segundos
  useEffect(() => {
    setTime(seconds)
    
    // Limpiar interval anterior si existe
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    // Solo iniciar el timer si los segundos son mayores a 0
    if (seconds > 0) {
      intervalRef.current = setInterval(() => {
        setTime(prevTime => {
          const newTime = prevTime - 1
          
          if (newTime <= 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current)
            }
            if (onEndRef.current) {
              onEndRef.current()
            }
          }
          return newTime
        })
      }, 1000)
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [seconds])

  // Notificar cambios de tiempo
  useEffect(() => {
    if (onTickRef.current) {
      onTickRef.current(time)
    }
  }, [time])

  // Cleanup al desmontar el componente
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const timerColor = useMemo(() => {
    if (time <= 3) return { border: 'border-red-400/50', text: 'text-red-300', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.4)]' }
    if (time <= 6) return { border: 'border-amber-400/50', text: 'text-amber-300', glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]' }
    return { border: 'border-emerald-400/50', text: 'text-emerald-300', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.2)]' }
  }, [time])

  const percentage = (time / seconds) * 100

  return (
    <motion.div 
      className="text-center"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      <div className="relative w-20 h-20 mx-auto">
        {/* Background circle */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth="3"
          />
          {/* Progress circle */}
          <motion.circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={useMemo(() => 2 * Math.PI * 45 * (1 - percentage / 100), [percentage])}
            className={timerColor.text}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.3s ease-out' }}
          />
        </svg>

        {/* Timer value */}
        <motion.div
          className={`absolute inset-0 flex items-center justify-center font-bold text-3xl ${timerColor.text} ${timerColor.glow}`}
          key={time}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {time}
        </motion.div>
      </div>

      <motion.span 
        className="mt-3 block text-xs text-white/60 font-medium"
        animate={{ opacity: time <= 3 ? [1, 0.7, 1] : 1 }}
        transition={{ repeat: time <= 3 ? Infinity : 0, duration: 0.6 }}
      >
        {time === 0 ? '¡Tiempo!' : 'segundos'}
      </motion.span>
    </motion.div>
  )
}