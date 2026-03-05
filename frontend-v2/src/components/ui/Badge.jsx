import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

const variants = {
  primary: 'bg-bb-primary/20 text-bb-primary-light ring-bb-primary/30',
  amber: 'bg-amber-400/15 text-amber-300 ring-amber-400/30',
  emerald: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30',
  violet: 'bg-violet-400/15 text-violet-300 ring-violet-400/30',
  slate: 'bg-white/10 text-white/80 ring-white/20',
  red: 'bg-red-500/15 text-red-300 ring-red-400/30',
  blue: 'bg-blue-500/15 text-blue-300 ring-blue-400/30',
}

export default function Badge({ children, variant = 'slate', className = '', animated = false, ...props }) {
  const baseClass = clsx(
    'inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset',
    variants[variant] ?? variants.slate,
    className
  )

  if (animated) {
    return (
      <motion.span
        className={baseClass}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        {...props}
      >
        {children}
      </motion.span>
    )
  }

  return (
    <span className={baseClass} {...props}>
      {children}
    </span>
  )
}

