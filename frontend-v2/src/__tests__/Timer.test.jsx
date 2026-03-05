import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import Timer from '../components/Timer'

describe('Timer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should start with the correct initial time', () => {
    render(<Timer seconds={10} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('should countdown correctly', () => {
    const onTick = vi.fn()
    render(<Timer seconds={5} onTick={onTick} />)
    
    expect(screen.getByText('5')).toBeInTheDocument()
    
    // Avanzar 1 segundo
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(onTick).toHaveBeenCalledWith(4)
    
    // Avanzar 2 segundos más
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(onTick).toHaveBeenCalledWith(2)
  })

  it('should countdown step by step', () => {
    render(<Timer seconds={3} />)
    
    expect(screen.getByText('3')).toBeInTheDocument()
    
    // Segundo 1
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('2')).toBeInTheDocument()
    
    // Segundo 2
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('1')).toBeInTheDocument()
    
    // Segundo 3
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('should call onEnd when timer reaches 0', () => {
    const onEnd = vi.fn()
    render(<Timer seconds={3} onEnd={onEnd} />)
    
    // Avanzar 3 segundos
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    
    expect(onEnd).toHaveBeenCalled()
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('should reset when seconds prop changes', () => {
    const { rerender } = render(<Timer seconds={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
    
    // Cambiar a 10 segundos
    rerender(<Timer seconds={10} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('should have correct color classes based on time remaining', () => {
    const { rerender } = render(<Timer seconds={10} />)
    let timerElement = screen.getByText('10')
    // El contenedor parent tiene las clases de color
    expect(timerElement.closest('div')).toHaveClass('text-emerald-300')
    
    // 6 segundos - amber
    rerender(<Timer seconds={6} />)
    timerElement = screen.getByText('6')
    expect(timerElement.closest('div')).toHaveClass('text-amber-300')
    
    // 3 segundos - red
    rerender(<Timer seconds={3} />)
    timerElement = screen.getByText('3')
    expect(timerElement.closest('div')).toHaveClass('text-red-300')
  })
})