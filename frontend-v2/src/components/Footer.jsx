import React from 'react'

export default function Footer() {
  return (
    <footer className="bg-transparent border-white/5 border-t w-full">
      <div className="flex md:flex-row flex-col justify-between items-center gap-4 mx-auto px-4 py-6 container">
        <div className="text-sm">© {new Date().getFullYear()} BrainBlitz</div>
        <div className="flex gap-4 text-sm">
          <a href="/" className="hover:underline">Privacidad</a>
          <a href="/" className="hover:underline">Términos</a>
        </div>
      </div>
    </footer>
  )
}
