import React from 'react'
import { render, screen } from './testUtils'
import { describe, it, expect } from 'vitest'
import LoginPage from '../pages/LoginPage'

describe('LoginPage', () => {
  it('renderiza el formulario de login', () => {
    render(<LoginPage />)
  const email = screen.getByPlaceholderText(/correo|email|correo electrónico/i)
  const password = screen.getByPlaceholderText(/••••••••/)
  const submit = screen.getByRole('button', { name: /iniciar sesión|iniciar sesión|login|submit/i })

    expect(email).toBeInTheDocument()
    expect(password).toBeInTheDocument()
    expect(submit).toBeInTheDocument()
  })
})
