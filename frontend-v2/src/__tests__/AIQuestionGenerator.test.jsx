import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from './testUtils'
import React from 'react'
import AIQuestionGenerator from '../components/AIQuestionGenerator'

// Mock del hook useAuth
vi.mock('../AuthContext', () => {
  const React = require('react')
  return {
    useAuth: () => ({
      user: {
        uid: 'test-user-id',
        email: 'test@example.com',
        displayName: 'Test User',
        getIdToken: () => Promise.resolve('mocked-token')
      },
      loading: false
    }),
    AuthProvider: ({ children }) => React.createElement(React.Fragment, null, children)
  }
})

// Mock de las funciones de API
vi.mock('../services/api', () => ({
  fetchTopics: vi.fn(() => Promise.resolve(['Matemáticas', 'Historia', 'Ciencia'])),
  fetchDifficultyLevels: vi.fn(() => Promise.resolve(['Fácil', 'Medio', 'Difícil']))
}))

describe('AIQuestionGenerator (mobile-friendly cantidad)', () => {
  it('starts with empty cantidad and accepts only numbers', async () => {
    const onGenerated = vi.fn()
    const onClose = vi.fn()

    render(<AIQuestionGenerator onQuestionsGenerated={onGenerated} onClose={onClose} />)

    // Esperar a que el botón aparezca y usar matcher que ignore emojis
    const button = await waitFor(() =>
      screen.getByText((content) => content.includes('Crear con IA'))
    )

    fireEvent.click(button)

    const input =
      screen.getByLabelText('Cantidad', { selector: 'input' }) ||
      screen.getByPlaceholderText('Cantidad')

    expect(input.value).toBe('')

    fireEvent.change(input, { target: { value: 'a1b2' } })
    expect(input.value).toBe('12')

    fireEvent.change(input, { target: { value: '' } })
    expect(input.value).toBe('')
  })
})
