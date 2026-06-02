import { useState, useCallback, useEffect, useRef } from 'react'

export type MaticsPhase = 'idle' | 'red' | 'yellow' | 'green' | 'question' | 'resolved'
export type MaticsResult = 'attacker-wins' | 'defender-wins'

export interface MathProblem {
  question: string
  answer: number
}

function seededRand(seed: string, salt: number): number {
  let h = (0x811c9dc5 ^ salt) >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

export function generateProblem(seed: string): MathProblem {
  const r0 = seededRand(seed, 0)
  const r1 = seededRand(seed, 1)
  const r2 = seededRand(seed, 2)
  const op = ['+', '-', '×'][r0 % 3] as '+' | '-' | '×'

  // Both operands always drawn from 1–99
  const a = (r1 % 99) + 1
  const b = (r2 % 99) + 1

  if (op === '+') return { question: `${a} + ${b}`, answer: a + b }
  if (op === '-') return { question: `${a} − ${b}`, answer: a - b }

  // Multiplication: cap b so the product never exceeds 999
  const maxB = Math.min(99, Math.floor(999 / a))
  const bMul = (r2 % maxB) + 1
  return { question: `${a} × ${bMul}`, answer: a * bMul }
}

interface MaticsState {
  phase: MaticsPhase
  problem: MathProblem | null
  result: MaticsResult | null
}

const IDLE_STATE: MaticsState = { phase: 'idle', problem: null, result: null }
const LIGHT_SEQ: MaticsPhase[] = ['red', 'yellow', 'green', 'question']

export function useChessMatics() {
  const [state, setState] = useState<MaticsState>(IDLE_STATE)
  const stateRef = useRef(state)
  stateRef.current = state
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }, [])

  const start = useCallback((seed: string) => {
    clearTimer()
    setState({ phase: 'red', problem: generateProblem(seed), result: null })
  }, [clearTimer])

  // Advance traffic light: red → yellow → green → question (500 ms each)
  useEffect(() => {
    const idx = LIGHT_SEQ.indexOf(state.phase)
    if (idx < 0 || idx >= LIGHT_SEQ.length - 1) return
    const next = LIGHT_SEQ[idx + 1]
    timerRef.current = setTimeout(() => {
      setState(prev => prev.phase === state.phase ? { ...prev, phase: next } : prev)
    }, 500)
    return clearTimer
  }, [state.phase, clearTimer])

  // Submit with explicit role — returns true if the answer was correct
  const submitAnswerAs = useCallback((value: number, role: 'attacker' | 'defender'): boolean => {
    const curr = stateRef.current
    if (curr.phase !== 'question' || curr.problem === null || curr.result !== null) return false
    if (value !== curr.problem.answer) return false
    setState(prev => {
      if (prev.phase !== 'question' || prev.result !== null) return prev
      return { ...prev, phase: 'resolved', result: role === 'attacker' ? 'attacker-wins' : 'defender-wins' }
    })
    return true
  }, [])

  // Force-resolve from outside (computer or opponent answered first)
  const resolveAs = useCallback((result: MaticsResult) => {
    clearTimer()
    setState(prev => prev.phase === 'resolved' ? prev : { ...prev, phase: 'resolved', result })
  }, [clearTimer])

  const reset = useCallback(() => {
    clearTimer()
    setState(IDLE_STATE)
  }, [clearTimer])

  return { phase: state.phase, problem: state.problem, result: state.result, start, submitAnswerAs, resolveAs, reset }
}
