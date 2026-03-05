import React from 'react'

export default function Section({ title, subtitle, actions, children, className = '', ...props }) {
  return (
    <section className={`relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-md ${className}`} {...props}>
      <div className="flex items-start justify-between gap-4 px-6 py-5">
        <div>
          {title && <h3 className="text-2xl font-bold tracking-tight">{title}</h3>}
          {subtitle && <p className="mt-1 text-white/70">{subtitle}</p>}
        </div>
        {actions}
      </div>
      <div className="px-6 pb-6">
        {children}
      </div>
    </section>
  )
}

