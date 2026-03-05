import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-all duration-250 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bb-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bb-bg-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none active:scale-95'

const variants = {
  primary: 'bg-gradient-to-br from-bb-primary to-bb-accent text-white shadow-md hover:shadow-glow hover:-translate-y-0.5 active:translate-y-0 dark:from-bb-primary dark:to-bb-accent',
  secondary: 'bg-white/10 text-white border border-white/20 backdrop-blur-md hover:bg-white/15 hover:border-white/30 hover:shadow-glass',
  outline: 'bg-transparent text-bb-primary border-2 border-bb-primary hover:bg-bb-primary hover:text-white hover:shadow-glow',
  ghost: 'bg-transparent text-white hover:bg-white/10 hover:shadow-glass',
  danger: 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5',
  success: 'bg-gradient-to-br from-bb-accent to-emerald-500 text-white shadow-md hover:shadow-lg hover:-translate-y-0.5',
}

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[0.95rem]',
  lg: 'h-12 px-6 text-base',
  xl: 'h-14 px-8 text-lg',
}

export default function Button({ as: Comp = 'button', variant = 'primary', size = 'md', className = '', children, disabled = false, ...props }) {
  const classes = clsx(base, variants[variant] ?? variants.primary, sizes[size] ?? sizes.md, className)
  
  const button = (
    <Comp className={classes} disabled={disabled} {...props}>
      {children}
    </Comp>
  )

  // Add motion animation if not disabled
  if (Comp === 'button' || !Comp) {
    return (
      <motion.button
        whileHover={!disabled ? { y: -2 } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        className={classes}
        disabled={disabled}
        {...props}
      >
        {children}
      </motion.button>
    )
  }

  return button
}

