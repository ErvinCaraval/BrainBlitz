import React from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

export function Card({ className = '', children, animated = true, ...props }) {
  const baseClass = clsx(
    'relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl shadow-glass',
    className
  )

  if (animated) {
    return (
      <motion.section
        className={baseClass}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '0px 0px -50px 0px' }}
        variants={cardVariants}
        {...props}
      >
        {children}
      </motion.section>
    )
  }

  return (
    <section className={baseClass} {...props}>
      {children}
    </section>
  )
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <header className={clsx('px-6 pt-6', className)} {...props}>
      {children}
    </header>
  )
}

export function CardBody({ className = '', children, ...props }) {
  return (
    <div className={clsx('px-6 pb-6', className)} {...props}>
      {children}
    </div>
  )
}

