import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import type { Square } from 'chess.js'
import { useChessGame, type GameMode, type GameSnapshot } from '../hooks/useChessGame'
import { useClock } from '../hooks/useClock'
import { PlayerBar } from '../components/PlayerBar'
import { MoveHistory } from '../components/MoveHistory'
import { GameControls, type PauseState } from '../components/GameControls'
import '../game.css'

function statusMessage(snapshot: GameSnapshot, mode: GameMode, pauseState: PauseState): string {
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

  const { snapshot, makeMove, resign, timeout, reset, isPlayerTurn } = useChessGame(mode, isPaused)
  const { times, active, setActive, reset: resetClock, isExpired, expiredColor } = useClock(600_000)

  // Read container width via ResizeObserver — CSS handles all responsive constraints
  useEffect(() => {
    const el = boardContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setBoardWidth(Math.floor(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Clock: switch active player on each move; stop on game over or pause
  useEffect(() => {
    if (snapshot.status !== 'playing' || isPaused) {
      setActive(null)
      return
    }
    if (snapshot.moves.length > 0) setActive(snapshot.turn)
  }, [snapshot.turn, snapshot.status, snapshot.moves.length, isPaused, setActive])

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

  const handleAcceptPause = useCallback(() => {
    setActive(null)
    setPauseState('paused')
  }, [setActive])

  const handleDeclinePause = useCallback(() => {
    setPauseState('none')
    setPauseOfferedBy(null)
  }, [])

  const handleResume = useCallback(() => {
    setPauseState('none')
    setPauseOfferedBy(null)
    if (snapshot.status === 'playing' && snapshot.moves.length > 0) {
      setActive(snapshot.turn)
    }
  }, [snapshot.status, snapshot.moves.length, snapshot.turn, setActive])

  const handlePieceDrop = useCallback((source: string, target: string): boolean => {
    if (!isPlayerTurn || isPaused) return false
    return makeMove(source as Square, target as Square)
  }, [makeMove, isPlayerTurn, isPaused])

  const lastMoveSquares = snapshot.lastMove
    ? {
        [snapshot.lastMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.35)' },
        [snapshot.lastMove.to]:   { backgroundColor: 'rgba(255, 255, 0, 0.5)'  },
      }
    : {}

  const isGameOver = snapshot.status !== 'playing'

  const msgClass = [
    'game-status',
    isGameOver            ? 'game-status--over'  : '',
    isPaused              ? 'game-status--paused' : '',
    snapshot.isCheck && !isGameOver && !isPaused ? 'game-status--check'  : '',
  ].filter(Boolean).join(' ')

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
              id="main-board"
              position={snapshot.fen}
              onPieceDrop={handlePieceDrop}
              boardWidth={boardWidth}
              arePiecesDraggable={isPlayerTurn && !isGameOver && !isPaused}
              customSquareStyles={lastMoveSquares}
              animationDuration={200}
            />
            {isPaused && (
              <div className="board-pause-overlay">
                <span>⏸ Paused</span>
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
          <div className={msgClass}>{statusMessage(snapshot, mode, pauseState)}</div>
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
        </div>
      </main>
    </div>
  )
}
