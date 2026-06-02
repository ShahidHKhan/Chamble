import { useState, useRef, useEffect } from 'react'
import type { MaticsPhase, MaticsResult, MathProblem } from '../hooks/useChessMatics'

interface Props {
  phase: MaticsPhase
  problem: MathProblem | null
  result: MaticsResult | null
  attackerLabel: string
  defenderLabel: string
  /** Show two side-by-side inputs (local 2-player — both race on the same screen) */
  isLocal: boolean
  /** For non-local modes: which role this client plays */
  clientRole: 'attacker' | 'defender'
  /** Multiplayer: answer was submitted, waiting for server to pick a winner */
  answered?: boolean
  onSubmitAs: (value: number, role: 'attacker' | 'defender') => void
}

const RESULT_TEXT: Record<MaticsResult, string> = {
  'attacker-wins': 'Attacker wins — capture proceeds!',
  'defender-wins': "Defender wins — attacker's piece removed!",
}

const RESULT_CLASS: Record<MaticsResult, string> = {
  'attacker-wins': 'matics-result--win',
  'defender-wins': 'matics-result--lose',
}

function TrafficLight({ phase }: { phase: MaticsPhase }) {
  return (
    <div className="traffic-light">
      <div className={`traffic-light__bulb traffic-light__red${phase === 'red' ? ' traffic-light__bulb--on' : ''}`} />
      <div className={`traffic-light__bulb traffic-light__yellow${phase === 'yellow' ? ' traffic-light__bulb--on' : ''}`} />
      <div className={`traffic-light__bulb traffic-light__green${phase === 'green' ? ' traffic-light__bulb--on' : ''}`} />
    </div>
  )
}

function AnswerInput({ label, onSubmit, autoFocus }: { label: string; onSubmit: (v: number) => void; autoFocus?: boolean }) {
  const [val, setVal] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus) ref.current?.focus()
  }, [autoFocus])

  const submit = () => {
    const n = parseInt(val, 10)
    if (!isNaN(n)) { onSubmit(n); setVal('') }
  }

  return (
    <div className="matics-answer-row">
      <span className="matics-answer-label">{label}</span>
      <input
        ref={ref}
        className="matics-answer-input"
        type="number"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submit()}
        placeholder="?"
      />
      <button className="btn btn--primary matics-submit-btn" onClick={submit}>✓</button>
    </div>
  )
}

export function MaticsPanel({ phase, problem, result, attackerLabel, defenderLabel, isLocal, clientRole, answered, onSubmitAs }: Props) {
  const isLight = phase === 'red' || phase === 'yellow' || phase === 'green'

  if (phase === 'idle') {
    return (
      <div className="matics-table">
        <div className="matics-header">
          <span className="matics-header__title">Math Challenge</span>
          <span className="matics-header__sub">Capture or promote to activate</span>
        </div>
        <TrafficLight phase="idle" />
        <div className="matics-idle-hint">First correct answer wins</div>
      </div>
    )
  }

  return (
    <div className="matics-table">
      <div className="matics-header">
        <span className="matics-header__title">Math Challenge</span>
        <span className="matics-header__sub">{attackerLabel} vs {defenderLabel}</span>
      </div>

      {isLight && <TrafficLight phase={phase} />}

      {phase === 'question' && problem && (
        <>
          <div className="matics-problem">{problem.question} = ?</div>
          {answered ? (
            <div className="matics-waiting">Answer submitted — waiting for result…</div>
          ) : isLocal ? (
            <div className="matics-two-inputs">
              <AnswerInput
                label={attackerLabel}
                onSubmit={v => onSubmitAs(v, 'attacker')}
                autoFocus
              />
              <AnswerInput
                label={defenderLabel}
                onSubmit={v => onSubmitAs(v, 'defender')}
              />
            </div>
          ) : (
            <AnswerInput
              label={clientRole === 'attacker' ? `${attackerLabel} (you)` : `${defenderLabel} (you)`}
              onSubmit={v => onSubmitAs(v, clientRole)}
              autoFocus
            />
          )}
        </>
      )}

      {phase === 'resolved' && result && (
        <div className={`matics-result ${RESULT_CLASS[result]}`}>
          {RESULT_TEXT[result]}
        </div>
      )}
    </div>
  )
}
