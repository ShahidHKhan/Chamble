import { handValue, type Card, type BlackjackPhase, type BlackjackResult } from '../hooks/useBlackjack'

interface Props {
  phase: BlackjackPhase
  playerHand: Card[]
  dealerHand: Card[]
  result: BlackjackResult | null
  attackerLabel: string
  defenderLabel: string
  onHit: () => void
  onStand: () => void
  readOnly?: boolean
}

function CardDisplay({ card }: { card: Card }) {
  if (card.faceDown) return <div className="bj-card bj-card--facedown">?</div>
  const isRed = card.suit === '♥' || card.suit === '♦'
  return (
    <div className={`bj-card${isRed ? ' bj-card--red' : ''}`}>
      <span className="bj-card__rank">{card.rank}</span>
      <span className="bj-card__suit">{card.suit}</span>
    </div>
  )
}

const RESULT_TEXT: Record<BlackjackResult, string> = {
  win:  'You win — capture succeeds!',
  lose: 'Dealer wins — your piece is taken!',
  push: 'Push — no capture, turn passes.',
}

const SPECTATOR_RESULT_TEXT: Record<BlackjackResult, string> = {
  win:  'Attacker wins — capture succeeds!',
  lose: 'Dealer wins — capture blocked!',
  push: 'Push — no capture, turn passes.',
}

const RESULT_CLASS: Record<BlackjackResult, string> = {
  win:  'bj-result--win',
  lose: 'bj-result--lose',
  push: 'bj-result--push',
}

const IDLE_CARD = <div className="bj-card bj-card--facedown">?</div>

export function BlackjackTable({ phase, playerHand, dealerHand, result, attackerLabel, defenderLabel, onHit, onStand, readOnly }: Props) {
  if (phase === 'idle') {
    return (
      <div className="bj-table">
        <div className="bj-header">
          <span className="bj-header__title">Capture Battle</span>
          <span className="bj-header__sub">Attempt a capture to activate</span>
        </div>
        <div className="bj-section">
          <div className="bj-section__label">Dealer</div>
          <div className="bj-hand">{IDLE_CARD}{IDLE_CARD}</div>
        </div>
        <div className="bj-divider" />
        <div className="bj-section">
          <div className="bj-section__label">You</div>
          <div className="bj-hand">{IDLE_CARD}{IDLE_CARD}</div>
        </div>
      </div>
    )
  }

  const playerTotal = handValue(playerHand)
  const shownDealer = dealerHand.filter(c => !c.faceDown)
  const dealerDisplay = phase === 'player-turn'
    ? `${handValue(shownDealer)}+`
    : `${handValue(dealerHand)}`

  const playerLabel = readOnly ? attackerLabel : 'You'
  const resultText  = readOnly ? SPECTATOR_RESULT_TEXT : RESULT_TEXT

  return (
    <div className="bj-table">
      <div className="bj-header">
        <span className="bj-header__title">Capture Battle</span>
        <span className="bj-header__sub">{attackerLabel} attacks {defenderLabel}</span>
        {readOnly && <span className="bj-header__watching">Watching…</span>}
      </div>

      <div className="bj-section">
        <div className="bj-section__label">
          Dealer &bull; {dealerDisplay}
          {phase === 'dealer-turn' && <span className="bj-thinking"> drawing…</span>}
        </div>
        <div className="bj-hand">
          {dealerHand.map((card, i) => <CardDisplay key={i} card={card} />)}
        </div>
      </div>

      <div className="bj-divider" />

      <div className="bj-section">
        <div className="bj-section__label">{playerLabel} &bull; {playerTotal}</div>
        <div className="bj-hand">
          {playerHand.map((card, i) => <CardDisplay key={i} card={card} />)}
        </div>
      </div>

      {phase === 'player-turn' && !readOnly && (
        <div className="bj-actions">
          <button className="btn btn--primary" onClick={onHit}>Hit</button>
          <button className="btn btn--secondary" onClick={onStand}>Stand</button>
        </div>
      )}

      {phase === 'player-turn' && readOnly && (
        <div className="bj-actions bj-actions--watching">
          <span className="bj-watching-label">Opponent is deciding…</span>
        </div>
      )}

      {phase === 'resolved' && result && (
        <div className={`bj-result-text ${RESULT_CLASS[result]}`}>
          {resultText[result]}
        </div>
      )}
    </div>
  )
}
