import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import type { Square, PieceSymbol } from 'chess.js'
import { useChessGame, type GameMode, type GameSnapshot } from '../hooks/useChessGame'
import { useClock } from '../hooks/useClock'
import { useBlackjack } from '../hooks/useBlackjack'
import { PlayerBar } from '../components/PlayerBar'
import { MoveHistory } from '../components/MoveHistory'
import { GameControls, type PauseState } from '../components/GameControls'
import { BlackjackTable } from '../components/BlackjackTable'
import '../game.css'

type PieceDropArgs = { sourceSquare: string; targetSquare: string | null }

const PROMOTION_PIECES: { symbol: string; piece: PieceSymbol; label: string }[] = [
  { symbol: '♕', piece: 'q', label: 'Queen'  },
  { symbol: '♖', piece: 'r', label: 'Rook'   },
  { symbol: '♗', piece: 'b', label: 'Bishop' },
  { symbol: '♘', piece: 'n', label: 'Knight' },
]
const PROMOTION_PIECES_BLACK: typeof PROMOTION_PIECES = [
  { symbol: '♛', piece: 'q', label: 'Queen'  },
  { symbol: '♜', piece: 'r', label: 'Rook'   },
  { symbol: '♝', piece: 'b', label: 'Bishop' },
  { symbol: '♞', piece: 'n', label: 'Knight' },
]

function statusMessage(snapshot: GameSnapshot, mode: GameMode, pauseState: PauseState, bjActive: boolean): string {
  if (bjActive) return 'Blackjack in progress...'
  if (pauseState === 'paused') return 'Game paused'
  const { status, winner, turn, isCheck } = snapshot
  const winnerName = winner === 'w' ? 'White' : winner === 'b' ? 'Black' : null
  switch (status) {
    case 'checkmate': return `${winnerName} wins by checkmate!`
    case 'stalemate': return 'Draw — stalemate'
    case 'draw':      return 'Draw'
    case 'resigned':  return `${winnerName} wins — opponent resigned`
    case 'timeout':   return `${winnerName} wins on time`
    case 'playing':
      if (isCheck) return `${turn === 'w' ? 'White' : 'Black'} is in check!`
      if (mode === 'computer' && turn === 'b') return 'Computer is thinking...'
      return `${turn === 'w' ? 'White' : 'Black'} to move`
    default: return ''
  }
}

export function GamePage() {
  const location    = useLocation()
  const navigate    = useNavigate()
  const initialMode: GameMode = (location.state as { mode?: GameMode })?.mode ?? 'local'
  const [mode]      = useState<GameMode>(initialMode)
  const [boardWidth, setBoardWidth] = useState(480)
  const boardContainerRef = useRef<HTMLDivElement>(null)

  const [pauseState,     setPauseState]     = useState<PauseState>('none')
  const [pauseOfferedBy, setPauseOfferedBy] = useState<'w' | 'b' | null>(null)
  const isPaused = pauseState === 'paused'

  const [pendingPromo, setPendingPromo]   = useState<{ from: Square; to: Square } | null>(null)
  const [pendingCapture, setPendingCapture] = useState<{ from: Square; to: Square } | null>(null)
  const [captureLabels, setCaptureLabels]   = useState({ attacker: '', defender: '' })

  const { snapshot, makeMove, resign, timeout, isPlayerTurn, isPawnPromotion, isCapture, captureReversed, cancelCapture } = useChessGame(mode, isPaused)
  const { times, active, setActive, isExpired, expiredColor } = useClock(600_000)
  const bj = useBlackjack()

  const bjActive = bj.phase !== 'idle'

  // Read container width via ResizeObserver
  useEffect(() => {
    const el = boardContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBoardWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Clock: start for white immediately; switch on each move; stop on game over, pause, or blackjack
  useEffect(() => {
    if (snapshot.status !== 'playing' || isPaused || bjActive) {
      setActive(null)
      return
    }
    setActive(snapshot.turn)
  }, [snapshot.turn, snapshot.status, isPaused, bjActive, setActive])

  // Timeout
  useEffect(() => {
    if (isExpired && expiredColor && snapshot.status === 'playing') {
      setActive(null)
      timeout(expiredColor)
    }
  }, [isExpired, expiredColor, snapshot.status, timeout, setActive])

  // Reset pause when game ends
  useEffect(() => {
    if (snapshot.status !== 'playing') {
      setPauseState('none')
      setPauseOfferedBy(null)
    }
  }, [snapshot.status])

  const handlePause = useCallback(() => {
    if (mode === 'computer') {
      setActive(null)
      setPauseState('paused')
    } else {
      setPauseOfferedBy(snapshot.turn)
      setPauseState('offered')
    }
  }, [mode, snapshot.turn, setActive])

  const handleAcceptPause  = useCallback(() => { setActive(null); setPauseState('paused') }, [setActive])
  const handleDeclinePause = useCallback(() => { setPauseState('none'); setPauseOfferedBy(null) }, [])
  const handleResume       = useCallback(() => {
    setPauseState('none')
    setPauseOfferedBy(null)
    if (snapshot.status === 'playing') setActive(snapshot.turn)
  }, [snapshot.status, snapshot.turn, setActive])

  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }: PieceDropArgs): boolean => {
    if (!isPlayerTurn || isPaused || bjActive || !targetSquare) return false
    const from = sourceSquare as Square
    const to   = targetSquare as Square

    // Capture → trigger blackjack
    if (isCapture(from, to)) {
      // Build human-readable labels for the table
      // We can't call chess.get() directly here, but isCapture already verified both pieces exist
      setPendingCapture({ from, to })
      // Labels will be set from snapshot data in a useEffect or inline
      const turn = snapshot.turn
      const colorName = (c: 'w' | 'b') => c === 'w' ? 'White' : 'Black'
      // Parse piece types from FEN is complex; pass simple labels
      setCaptureLabels({
        attacker: `${colorName(turn)}'s piece`,
        defender: `${colorName(turn === 'w' ? 'b' : 'w')}'s piece`,
      })
      bj.deal()
      return false
    }

    // Non-capture pawn promotion → show piece picker
    if (isPawnPromotion(from, to)) {
      setPendingPromo({ from, to })
      return false
    }

    return makeMove(from, to)
  }, [makeMove, isPlayerTurn, isPaused, bjActive, isPawnPromotion, isCapture, snapshot.turn, bj])

  // Apply blackjack outcome to the chess board
  const handleBJContinue = useCallback(() => {
    if (!pendingCapture || bj.result === null) return
    const { from, to } = pendingCapture
    setPendingCapture(null)
    bj.reset()

    if (bj.result === 'win') {
      makeMove(from, to, 'q') // auto-queen if capture-promotion
    } else if (bj.result === 'lose') {
      captureReversed(from)
    } else {
      cancelCapture()
    }
  }, [pendingCapture, bj, makeMove, captureReversed, cancelCapture])

  const handlePromotion = useCallback((piece: PieceSymbol) => {
    if (!pendingPromo) return
    makeMove(pendingPromo.from, pendingPromo.to, piece)
    setPendingPromo(null)
  }, [pendingPromo, makeMove])

  const lastMoveSquares = snapshot.lastMove
    ? {
        [snapshot.lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.35)' },
        [snapshot.lastMove.to]:   { backgroundColor: 'rgba(255, 255, 0, 0.5)'  },
      }
    : {}

  const isGameOver = snapshot.status !== 'playing'
  const boardLocked = !isPlayerTurn || isGameOver || isPaused || !!pendingPromo || bjActive

  const msgClass = [
    'game-status',
    isGameOver                                             ? 'game-status--over'  : '',
    isPaused                                               ? 'game-status--paused' : '',
    bjActive                                               ? 'game-status--bj'    : '',
    snapshot.isCheck && !isGameOver && !isPaused && !bjActive ? 'game-status--check'  : '',
  ].filter(Boolean).join(' ')

  const promoOptions = snapshot.turn === 'w' ? PROMOTION_PIECES : PROMOTION_PIECES_BLACK

  return (
    <div className="game-page">
      <header className="game-header">
        <span className="game-header__logo">Chamble</span>
      </header>

      <main className="game-main">
        <div className="board-section" ref={boardContainerRef}>
          <PlayerBar
            color="b"
            name={mode === 'computer' ? 'Computer' : 'Black'}
            timeMs={times.black}
            isActive={active === 'b' && !isGameOver && !isPaused}
            captured={snapshot.capturedByBlack}
            isGameOver={isGameOver}
          />
          <div className="board-wrapper">
            <Chessboard
              options={{
                position: snapshot.fen,
                onPieceDrop: handlePieceDrop,
                boardStyle: { width: boardWidth, height: boardWidth },
                allowDragging: !boardLocked,
                squareStyles: lastMoveSquares,
                animationDurationInMs: 200,
              }}
            />
            {isPaused && (
              <div className="board-pause-overlay"><span>Paused</span></div>
            )}
            {bjActive && !isPaused && (
              <div className="board-pause-overlay board-pause-overlay--bj">
                <span>Blackjack</span>
              </div>
            )}
            {pendingPromo && (
              <div className="promotion-overlay">
                <div className="promotion-dialog">
                  <p className="promotion-dialog__title">Promote pawn to:</p>
                  <div className="promotion-dialog__options">
                    {promoOptions.map(opt => (
                      <button key={opt.piece} className="promotion-dialog__btn" onClick={() => handlePromotion(opt.piece)} title={opt.label}>
                        {opt.symbol}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <PlayerBar
            color="w"
            name="White"
            timeMs={times.white}
            isActive={active === 'w' && !isGameOver && !isPaused}
            captured={snapshot.capturedByWhite}
            isGameOver={isGameOver}
          />
        </div>

        <div className="game-sidebar">
          <div className={msgClass}>{statusMessage(snapshot, mode, pauseState, bjActive)}</div>

          {bjActive ? (
            <BlackjackTable
              phase={bj.phase}
              playerHand={bj.playerHand}
              dealerHand={bj.dealerHand}
              result={bj.result}
              attackerLabel={captureLabels.attacker}
              defenderLabel={captureLabels.defender}
              onHit={bj.hit}
              onStand={bj.stand}
              onContinue={handleBJContinue}
            />
          ) : (
            <>
              <MoveHistory moves={snapshot.moves} />
              <GameControls
                mode={mode}
                isGameOver={isGameOver}
                pauseState={pauseState}
                pauseOfferedBy={pauseOfferedBy}
                onPause={handlePause}
                onAcceptPause={handleAcceptPause}
                onDeclinePause={handleDeclinePause}
                onResume={handleResume}
                onResign={resign}
                onGoHome={() => navigate('/home')}
              />
            </>
          )}
        </div>
      </main>
    </div>
  )
}
