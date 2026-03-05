import { describe, it, expect } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import Navbar from '../components/Navbar'
import { renderWithProviders } from './testUtils'

describe('Navbar mobile menu', () => {
  it('toggles mobile drawer', async () => {
    renderWithProviders(<Navbar />)
    const btn = screen.getByLabelText('Abrir menú')
    
    // Click para abrir el menú
    fireEvent.click(btn)
    
    // Esperar a que el elemento aparezca en el DOM
    await waitFor(() => {
      const mobileMenu = document.querySelector('[class*="bg-bb-bg-secondary"]')
      expect(mobileMenu).toBeTruthy()
    }, { timeout: 1000 })
  })
})

