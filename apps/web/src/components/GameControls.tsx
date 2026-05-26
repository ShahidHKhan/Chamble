import type { GameMode } from '../hooks/useChessGame'

export type PauseState = 'none' | 'offered' | 'paused'

interface Props {
  mode: GameMode
  isGameOver: boolean
  pauseState: PauseState
  pauseOfferedBy: 'w' | 'b' | null
  /** false when the local player is the one who offered the pause (show "waiting" instead of accept/decline) */
  canRespondToPause?: boolean
  onPause: () => void
  onAcceptPause: () => void
  onDeclinePause: () => void
  onResume: () => void
  onResign: () => void
  onGoHome: () => void
}

export function GameControls({
  mode, isGameOver, pauseState, pauseOfferedBy,
  canRespondToPause = true,
  onPause, onAcceptPause, onDeclinePause, onResume, onResign, onGoHome,
}: Props) {
  return (
    <div className="game-controls">
      <div className="game-controls__row">
        <span className="game-controls__label">Mode</span>
        <span className="game-controls__value">{mode === 'computer' ? 'vs Bot' : '2 Players'}</span>
      </div>

      {isGameOver && (
        <div className="game-controls__actions">
          <button className="btn btn--primary btn--full" onClick={onGoHome}>Back to Home</button>
        </div>
      )}

      {!isGameOver && (
        <div className="game-controls__actions">
          {pauseState === 'none' && (
            <>
              <button className="btn btn--secondary" onClick={onPause}>⏸ Pause</button>
              <button className="btn btn--danger" onClick={onResign}>Resign</button>
            </>
          )}

          {pauseState === 'offered' && (
            <div className="pause-offer">
              <p className="pause-offer__text">
                {pauseOfferedBy === 'w' ? 'White' : 'Black'} requested a pause
              </p>
              {canRespondToPause ? (
                <div className="pause-offer__btns">
                  <button className="btn btn--primary" onClick={onAcceptPause}>Accept</button>
                  <button className="btn btn--ghost" onClick={onDeclinePause}>Decline</button>
                </div>
              ) : (
                <p className="pause-offer__waiting">Waiting for opponent…</p>
              )}
            </div>
          )}

          {pauseState === 'paused' && (
            <button className="btn btn--primary btn--full" onClick={onResume}>▶ Resume</button>
          )}
        </div>
      )}
    </div>
  )
}
