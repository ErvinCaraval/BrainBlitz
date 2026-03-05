import React from 'react'
import clsx from 'clsx'

const baseStyles = 'block w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-white placeholder-white/50 backdrop-blur-md transition-all duration-250 focus:border-bb-primary focus:ring-2 focus:ring-bb-primary/30 focus:outline-none hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-white/10'

export default function Input({ className = '', ...props }) {
  return <input className={clsx(baseStyles, className)} {...props} />
}

