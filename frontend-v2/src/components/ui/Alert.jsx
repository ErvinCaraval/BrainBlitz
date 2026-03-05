import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'

const intentToStyles = {
  success: 'bg-emerald-500/15 text-emerald-200 border-emerald-400/30',
  error: 'bg-red-500/15 text-red-200 border-red-400/30',
  info: 'bg-indigo-500/15 text-indigo-200 border-indigo-400/30',
  warning: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
}

export default function Alert({ intent = 'info', children, className = '', onClose = null, ...props }) {
  const styles = intentToStyles[intent] ?? intentToStyles.info
  
  return (
    <AnimatePresence>
      <motion.div
        role="status"
        className={clsx(
          'rounded-xl border px-4 py-3 text-sm backdrop-blur-sm',
          styles,
          className
        )}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        {...props}
      >
        <div className="flex items-center justify-between gap-4">
          <span>{children}</span>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-2 text-current opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Cerrar alerta"
            >
              ✕
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

