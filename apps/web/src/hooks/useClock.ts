import { useState, useEffect, useCallback } from 'react'
import type { Color } from 'chess.js'

interface ClockTimes {
  white: number
  black: number
}

export function useClock(initialMs: number) {
  const [times, setTimes] = useState<ClockTimes>({ white: initialMs, black: initialMs })
  const [active, setActiveState] = useState<Color | null>(null)

  useEffect(() => {
    if (active === null) return
    const id = setInterval(() => {
      setTimes(prev => {
        const key = active === 'w' ? 'white' : 'black'
        const next = Math.max(0, prev[key] - 100)
        return { ...prev, [key]: next }
      })
    }, 100)
    return () => clearInterval(id)
  }, [active])

  const setActive = useCallback((color: Color | null) => {
    setActiveState(color)
  }, [])

  const reset = useCallback((newMs: number) => {
    setTimes({ white: newMs, black: newMs })
    setActiveState(null)
  }, [])

  const isExpired = times.white === 0 || times.black === 0
  const expiredColor: Color | null = times.white === 0 ? 'w' : times.black === 0 ? 'b' : null

  return { times, active, setActive, reset, isExpired, expiredColor }
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
