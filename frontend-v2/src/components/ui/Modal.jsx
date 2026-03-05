import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export default function Modal({ open, title, onClose, children, className = '' }) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    if (open) document.addEventListener('keydown', handleEsc)
    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow
    if (open) document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = originalOverflow
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[3000] flex items-center justify-center px-4 py-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Cerrar" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <motion.div role="dialog" aria-modal="true" className={`relative w-full max-w-2xl max-h-[85vh] overflow-auto rounded-2xl border border-white/10 bg-bb-bg-primary/90 shadow-xl ${className}`} initial={{ scale: 0.98, y: 10, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.98, y: 10, opacity: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10 bg-bb-bg-primary/90">
              {title ? <h2 className="text-xl md:text-2xl font-bold">{title}</h2> : <span className="sr-only">Modal</span>}
              <button onClick={onClose} className="rounded-md p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-primary" aria-label="Cerrar">✕</button>
            </div>
            <div className="px-6 py-5">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

