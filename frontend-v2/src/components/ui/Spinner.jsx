import React from 'react'

export default function Spinner({ size = 20, className = '' }) {
  const px = typeof size === 'number' ? `${size}px` : size
  return (
    <span
      aria-hidden="true"
      className={`inline-block align-middle ${className}`}
      style={{ width: px, height: px }}
    >
      <span className="block w-full h-full rounded-full border-2 border-white/30 border-t-white/90 animate-spin" />
    </span>
  )
}

