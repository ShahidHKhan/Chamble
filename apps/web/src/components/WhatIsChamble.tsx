import { useEffect } from 'react'

interface Props {
  open: boolean
  onClose: () => void
}

export function WhatIsChamble({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <>
      <div className={`wic-backdrop${open ? ' wic-backdrop--open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`wic-panel${open ? ' wic-panel--open' : ''}`} aria-label="What is Chamble">
        <button className="wic-close" onClick={onClose} aria-label="Close">✕</button>

        <h2 className="wic-heading">What is Chamble?</h2>
        <p className="wic-tagline">Chess, with a twist of Gambling.</p>

        <p className="wic-body">
          Chamble is a real-time multiplayer chess platform where every capture can trigger
          a gambling mechanic. Standard chess rules apply — but depending on the game mode,
          taking a piece might cost you more than just a move.
        </p>

        <div className="wic-section">
          <h3 className="wic-section-title">Game Modes</h3>

          <div className="wic-mode">
            <span className="wic-mode__name">Chess-21</span>
            <span className="wic-mode__desc">When you capture a piece, a blackjack round triggers — win the hand to keep the capture, bust and the piece comes back.</span>
          </div>

          <div className="wic-mode">
            <span className="wic-mode__name">Chess-Matics</span>
            <span className="wic-mode__desc">Captures are gated behind a timed math challenge — solve it correctly to complete the move, fail and you lose the capture.</span>
          </div>

          <div className="wic-mode">
            <span className="wic-mode__name">Chess-Roulette</span>
            <span className="wic-mode__desc">Before each turn a wheel is spun, locking you to moving only the piece type it lands on — strategy meets chance.</span>
          </div>
        </div>

        <div className="wic-section">
          <h3 className="wic-section-title">Creating a Match</h3>
          <p className="wic-body">
            From any game lobby, create a room and share the 4-character room code with
            your opponent. You can set an optional move timer and choose whether to enable
            ELO wagering before the game starts. Your opponent joins using the code and
            the game begins immediately.
          </p>
        </div>

        <div className="wic-section">
          <h3 className="wic-section-title">ELO Wagering</h3>
          <p className="wic-body">
            When creating a room you can set an ELO wager — a fixed amount both players
            put at stake. The winner gains the full wager from the loser's ELO. If no
            wager is set the match still affects ELO, just by a smaller standard amount.
            Your ELO is your rank on Chamble, so bet wisely.
          </p>
        </div>
      </aside>
    </>
  )
}
