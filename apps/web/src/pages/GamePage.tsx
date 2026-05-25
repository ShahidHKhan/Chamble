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

type PieceDropArgs  = { sourceSquare: string; targetSquare: string | null }
type SquareClickArgs = { square: string }

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
  if (bjActive) return 'Blackjack in progress…'
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

  const [pendingPromo,   setPendingPromo]   = useState<{ from: Square; to: Square } | null>(null)
  const [pendingCapture, setPendingCapture] = useState<{ from: Square; to: Square } | null>(null)
  const [captureLabels,  setCaptureLabels]  = useState({ attacker: '', defender: '' })

  // Click-to-move state
  const [selectedSquare,  setSelectedSquare]  = useState<Square | null>(null)
  const [moveHighlights,  setMoveHighlights]  = useState<Record<string, React.CSSProperties>>({})

  const {
    snapshot, makeMove, resign, timeout, isPlayerTurn,
    isPawnPromotion, isCapture, legalMovesFrom, captureReversed, cancelCapture,
  } = useChessGame(mode, isPaused)
  const { times, active, setActive, isExpired, expiredColor } = useClock(600_000)
  const bj = useBlackjack()

  const bjActive   = bj.phase !== 'idle'
  const isGameOver = snapshot.status !== 'playing'

  // Resize observer
  useEffect(() => {
    const el = boardContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBoardWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Clock
  useEffect(() => {
    if (snapshot.status !== 'playing' || isPaused || bjActive) { setActive(null); return }
    setActive(snapshot.turn)
  }, [snapshot.turn, snapshot.status, isPaused, bjActive, setActive])

  // Timeout
  useEffect(() => {
    if (isExpired && expiredColor && snapshot.status === 'playing') { setActive(null); timeout(expiredColor) }
  }, [isExpired, expiredColor, snapshot.status, timeout, setActive])

  // Reset pause on game end
  useEffect(() => {
    if (snapshot.status !== 'playing') { setPauseState('none'); setPauseOfferedBy(null) }
  }, [snapshot.status])

  // Clear selection whenever the turn changes or game ends
  useEffect(() => {
    setSelectedSquare(null)
    setMoveHighlights({})
  }, [snapshot.turn, snapshot.status])

  // Auto-apply blackjack result 1.5 s after resolved
  useEffect(() => {
    if (bj.phase !== 'resolved' || !pendingCapture || bj.result === null) return
    const { from, to } = pendingCapture
    const result = bj.result
    const timer = setTimeout(() => {
      setPendingCapture(null)
      bj.reset()
      if (result === 'win')       makeMove(from, to, 'q')
      else if (result === 'lose') captureReversed(from)
      else                        cancelCapture()
    }, 1500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bj.phase, bj.result, pendingCapture])

  // ── Helpers ────────────────────────────────────────────────────────────────

  const triggerCapture = useCallback((from: Square, to: Square) => {
    const colorName = (c: 'w' | 'b') => c === 'w' ? 'White' : 'Black'
    setCaptureLabels({
      attacker: `${colorName(snapshot.turn)}'s piece`,
      defender: `${colorName(snapshot.turn === 'w' ? 'b' : 'w')}'s piece`,
    })
    setPendingCapture({ from, to })
    bj.deal()
  }, [snapshot.turn, bj])

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handlePause        = useCallback(() => {
    if (mode === 'computer') { setActive(null); setPauseState('paused') }
    else { setPauseOfferedBy(snapshot.turn); setPauseState('offered') }
  }, [mode, snapshot.turn, setActive])
  const handleAcceptPause  = useCallback(() => { setActive(null); setPauseState('paused') }, [setActive])
  const handleDeclinePause = useCallback(() => { setPauseState('none'); setPauseOfferedBy(null) }, [])
  const handleResume       = useCallback(() => {
    setPauseState('none'); setPauseOfferedBy(null)
    if (snapshot.status === 'playing') setActive(snapshot.turn)
  }, [snapshot.status, snapshot.turn, setActive])

  // Drag-to-move
  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }: PieceDropArgs): boolean => {
    if (!isPlayerTurn || isPaused || bjActive || !targetSquare) return false
    const from = sourceSquare as Square
    const to   = targetSquare as Square
    if (isCapture(from, to))      { triggerCapture(from, to); return false }
    if (isPawnPromotion(from, to)) { setPendingPromo({ from, to }); return false }
    return makeMove(from, to)
  }, [makeMove, isPlayerTurn, isPaused, bjActive, isPawnPromotion, isCapture, triggerCapture])

  // Click-to-move
  const handleSquareClick = useCallback(({ square }: SquareClickArgs) => {
    if (!isPlayerTurn || isPaused || bjActive || isGameOver) return
    const sq = square as Square

    // Clicking the already-selected piece deselects it
    if (selectedSquare === sq) {
      setSelectedSquare(null); setMoveHighlights({}); return
    }

    // Clicking a highlighted target executes the move
    if (selectedSquare && moveHighlights[sq]) {
      const from = selectedSquare
      const to   = sq
      setSelectedSquare(null); setMoveHighlights({})
      if (isCapture(from, to))       { triggerCapture(from, to); return }
      if (isPawnPromotion(from, to)) { setPendingPromo({ from, to }); return }
      makeMove(from, to)
      return
    }

    // Select a piece and show its legal moves
    const targets = legalMovesFrom(sq)
    if (targets.length === 0) { setSelectedSquare(null); setMoveHighlights({}); return }

    setSelectedSquare(sq)
    const highlights: Record<string, React.CSSProperties> = {
      [sq]: { backgroundColor: 'rgba(20, 85, 255, 0.25)' },
    }
    for (const t of targets) {
      highlights[t] = isCapture(sq, t)
        ? { backgroundColor: 'rgba(0, 200, 120, 0.3)' }
        : { background: 'radial-gradient(circle, rgba(0,0,0,0.18) 28%, transparent 28%)' }
    }
    setMoveHighlights(highlights)
  }, [
    selectedSquare, moveHighlights, isPlayerTurn, isPaused, bjActive, isGameOver,
    legalMovesFrom, isCapture, isPawnPromotion, makeMove, triggerCapture,
  ])

  const handlePromotion = useCallback((piece: PieceSymbol) => {
    if (!pendingPromo) return
    makeMove(pendingPromo.from, pendingPromo.to, piece)
    setPendingPromo(null)
  }, [pendingPromo, makeMove])

  // ── Derived styles ─────────────────────────────────────────────────────────

  const squareStyles = { ...lastMoveHighlights(snapshot), ...moveHighlights }

  const boardLocked = !isPlayerTurn || isGameOver || isPaused || !!pendingPromo || bjActive

  const msgClass = [
    'game-status',
    isGameOver                                                 ? 'game-status--over'   : '',
    isPaused                                                   ? 'game-status--paused' : '',
    bjActive                                                   ? 'game-status--bj'     : '',
    snapshot.isCheck && !isGameOver && !isPaused && !bjActive  ? 'game-status--check'  : '',
  ].filter(Boolean).join(' ')

  const promoOptions = snapshot.turn === 'w' ? PROMOTION_PIECES : PROMOTION_PIECES_BLACK

  return (
    <div className="game-page">
      <header className="game-header">
        <span className="game-header__logo">Chamble</span>
      </header>

      <main className="game-main">

        {/* Blackjack panel — always visible on the left, dimmed when idle */}
        <div className={`bj-panel${bjActive ? '' : ' bj-panel--idle'}`}>
          <BlackjackTable
            phase={bj.phase}
            playerHand={bj.playerHand}
            dealerHand={bj.dealerHand}
            result={bj.result}
            attackerLabel={captureLabels.attacker}
            defenderLabel={captureLabels.defender}
            onHit={bj.hit}
            onStand={bj.stand}
          />
        </div>

        {/* Chessboard */}
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
                onSquareClick: handleSquareClick,
                boardStyle: { width: boardWidth, height: boardWidth },
                allowDragging: !boardLocked,
                squareStyles,
                animationDurationInMs: 200,
              }}
            />
            {isPaused && <div className="board-pause-overlay"><span>Paused</span></div>}
            {bjActive && bj.phase !== 'resolved' && !isPaused && (
              <div className="board-pause-overlay board-pause-overlay--bj"><span>Blackjack</span></div>
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

        {/* Right sidebar */}
        <div className="game-sidebar">
          <div className={msgClass}>{statusMessage(snapshot, mode, pauseState, bjActive)}</div>
          <MoveHistory events={snapshot.gameEvents} />
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
        </div>

      </main>
    </div>
  )
}

function lastMoveHighlights(snapshot: GameSnapshot): Record<string, React.CSSProperties> {
  if (!snapshot.lastMove) return {}
  return {
    [snapshot.lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.35)' },
    [snapshot.lastMove.to]:   { backgroundColor: 'rgba(255, 255, 0, 0.5)'  },
  }
}
