import React from 'react'
import Spinner from './Spinner'

export default function LoadingOverlay({ text = 'Cargando…', mobileOnly = false }) {
  return (
    <div className={`fixed inset-0 z-[3500] flex items-center justify-center px-6 ${mobileOnly ? 'md:hidden' : ''}`}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-bb-bg-primary/90 px-4 py-3 shadow-xl">
        <Spinner size={22} />
        <span className="text-sm">{text}</span>
      </div>
    </div>
  )
}

