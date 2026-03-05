/** @type {import('tailwindcss').Config} */
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'

export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1rem',
        md: '1.25rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '2rem',
      },
    },
    extend: {
      colors: {
        'bb-primary': '#7C3AED',
        'bb-primary-dark': '#5B21B6',
        'bb-primary-light': '#A78BFA',
        'bb-secondary': '#F59E0B',
        'bb-secondary-dark': '#D97706',
        'bb-secondary-light': '#FCD34D',
        'bb-accent': '#10B981',
        'bb-accent-dark': '#059669',
        'bb-accent-light': '#34D399',
        'bb-bg-primary': '#0F172A',
        'bb-bg-secondary': '#1E293B',
        'bb-bg-tertiary': '#334155',
        'bb-surface': 'rgba(255, 255, 255, 0.08)',
        'bb-surface-hover': 'rgba(255, 255, 255, 0.12)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'ui-sans-serif', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji'],
      },
      boxShadow: {
        glow: '0 0 15px rgba(124, 58, 237, 0.45)',
        'glow-sm': '0 0 8px rgba(124, 58, 237, 0.3)',
        'glow-lg': '0 0 25px rgba(124, 58, 237, 0.6)',
        'glass': '0 8px 32px rgba(0, 0, 0, 0.2)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.3s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124, 58, 237, 0.7)' },
          '50%': { boxShadow: '0 0 0 10px rgba(124, 58, 237, 0)' },
        },
        'slide-in': {
          '0%': { transform: 'translateX(-10px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
      transitionDuration: {
        '250': '250ms',
        '350': '350ms',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [forms, typography],
}
