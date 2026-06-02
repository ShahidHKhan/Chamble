import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Chessboard } from 'react-chessboard'
import type { Square, PieceSymbol, Color } from 'chess.js'
import { socket } from '../lib/socket'
import { EVENTS } from '@chess/shared'
import { useChessGame, type GameMode, type GameSnapshot, type SyncState } from '../hooks/useChessGame'
import { useClock } from '../hooks/useClock'
import { useBlackjack } from '../hooks/useBlackjack'
import { useChessMatics, type MaticsResult } from '../hooks/useChessMatics'
import { PlayerBar } from '../components/PlayerBar'
import { MoveHistory } from '../components/MoveHistory'
import { GameControls, type PauseState } from '../components/GameControls'
import { BlackjackTable } from '../components/BlackjackTable'
import { MaticsPanel } from '../components/MaticsPanel'
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

type GameVariant = 'chess21' | 'chessmatics'

function statusMessage(snapshot: GameSnapshot, mode: GameMode, pauseState: PauseState, bjActive: boolean, maticsActive: boolean): string {
  if (maticsActive) return 'Math Challenge in progress…'
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
  const locState    = (location.state ?? {}) as { mode?: GameMode; color?: Color; opponent?: string; gameId?: string; isRejoin?: boolean; gameVariant?: GameVariant }
  const initialMode: GameMode = locState.mode ?? 'local'
  const playerColor: Color    = locState.color ?? 'w'
  const opponentName: string  = locState.opponent ?? (initialMode === 'computer' ? 'Computer' : 'Opponent')
  const gameId      = locState.gameId      ?? ''
  const isRejoin    = locState.isRejoin    ?? false
  const gameVariant = locState.gameVariant ?? 'chess21'

  // The player whose pieces are at the BOTTOM of the board (always the local player's perspective)
  const bottomColor: Color = playerColor
  const topColor:    Color = playerColor === 'w' ? 'b' : 'w'
  const bottomName = playerColor === 'w' ? 'White' : 'Black'
  const topName    = initialMode === 'computer' && topColor === 'b' ? 'Computer' : opponentName

  const [mode]               = useState<GameMode>(initialMode)
  const [opponentDisconnected, setOpponentDisconnected] = useState(false)
  const [isSyncing,            setIsSyncing]            = useState(isRejoin)
  const [boardWidth, setBoardWidth] = useState(480)
  const boardContainerRef = useRef<HTMLDivElement>(null)

  const [pauseState,     setPauseState]     = useState<PauseState>('none')
  const [pauseOfferedBy, setPauseOfferedBy] = useState<'w' | 'b' | null>(null)
  const isPaused = pauseState === 'paused'

  const [pendingPromo,        setPendingPromo]        = useState<{ from: Square; to: Square } | null>(null)
  const [pendingCapture,      setPendingCapture]      = useState<{ from: Square; to: Square } | null>(null)
  const [captureLabels,       setCaptureLabels]       = useState({ attacker: '', defender: '' })

  // Chess-Matics state
  const [pendingMaticsCapture, setPendingMaticsCapture] = useState<{ from: Square; to: Square } | null>(null)
  const [pendingMaticsPromo,   setPendingMaticsPromo]   = useState<{ from: Square; to: Square } | null>(null)
  const [maticsLabels,         setMaticsLabels]         = useState({ attacker: '', defender: '' })
  // true = local client is the attacker for this challenge
  const [maticsIsAttacker,     setMaticsIsAttacker]     = useState(true)
  // multiplayer: answer submitted, waiting for server MATICS_RESULT
  const [maticsAnswered,       setMaticsAnswered]       = useState(false)

  // Click-to-move state
  const [selectedSquare,  setSelectedSquare]  = useState<Square | null>(null)
  const [moveHighlights,  setMoveHighlights]  = useState<Record<string, React.CSSProperties>>({})

  const {
    snapshot, makeMove, resign, forceResign, timeout, isPlayerTurn,
    isPawnPromotion, isCapture, legalMovesFrom, captureReversed, cancelCapture,
    exportState, restoreState,
  } = useChessGame(mode, isPaused, playerColor)
  const { times, active, setActive, isExpired, expiredColor } = useClock(600_000)
  const bj     = useBlackjack()
  const matics = useChessMatics()

  const bjActive     = bj.phase !== 'idle'
  const maticsActive = gameVariant === 'chessmatics' && matics.phase !== 'idle'
  const isGameOver   = snapshot.status !== 'playing'

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
    if (snapshot.status !== 'playing' || isPaused || bjActive || maticsActive) { setActive(null); return }
    setActive(snapshot.turn)
  }, [snapshot.turn, snapshot.status, isPaused, bjActive, maticsActive, setActive])

  // Timeout
  useEffect(() => {
    if (isExpired && expiredColor && snapshot.status === 'playing') { setActive(null); timeout(expiredColor) }
  }, [isExpired, expiredColor, snapshot.status, timeout, setActive])

  // Socket stays connected from the lobby for the duration of the game.
  // We do NOT disconnect in an effect cleanup because React StrictMode runs cleanups
  // on an artificial unmount in dev, which would kill the connection permanently
  // (explicit socket.disconnect() suppresses auto-reconnect in Socket.IO).
  // Disconnect happens explicitly when the user navigates away via the button below.

  // Relay incoming moves from the opponent
  useEffect(() => {
    if (mode !== 'multiplayer') return
    type RemoteMove =
      | { kind: 'move'; from: string; to: string; promotion?: string }
      | { kind: 'capture_reversed'; from: string }
      | { kind: 'push' }
    const onRemoteMove = (data: RemoteMove) => {
      if (data.kind === 'move')                  makeMove(data.from as Square, data.to as Square, (data.promotion ?? 'q') as PieceSymbol)
      else if (data.kind === 'capture_reversed') captureReversed(data.from as Square)
      else                                       cancelCapture()
    }
    socket.on(EVENTS.MOVE, onRemoteMove)
    return () => { socket.off(EVENTS.MOVE, onRemoteMove) }
  }, [mode, makeMove, captureReversed, cancelCapture])

  // Relay incoming pause events from the opponent
  useEffect(() => {
    if (mode !== 'multiplayer') return
    const onPauseOffer   = () => { setPauseOfferedBy(playerColor === 'w' ? 'b' : 'w'); setPauseState('offered') }
    const onPauseAccept  = () => { setActive(null); setPauseState('paused') }
    const onPauseDecline = () => { setPauseState('none'); setPauseOfferedBy(null) }
    const onPauseResume  = () => {
      setPauseState('none')
      setPauseOfferedBy(null)
      if (snapshot.status === 'playing') setActive(snapshot.turn)
    }
    socket.on(EVENTS.PAUSE_OFFER,   onPauseOffer)
    socket.on(EVENTS.PAUSE_ACCEPT,  onPauseAccept)
    socket.on(EVENTS.PAUSE_DECLINE, onPauseDecline)
    socket.on(EVENTS.PAUSE_RESUME,  onPauseResume)
    return () => {
      socket.off(EVENTS.PAUSE_OFFER,   onPauseOffer)
      socket.off(EVENTS.PAUSE_ACCEPT,  onPauseAccept)
      socket.off(EVENTS.PAUSE_DECLINE, onPauseDecline)
      socket.off(EVENTS.PAUSE_RESUME,  onPauseResume)
    }
  }, [mode, playerColor, snapshot.status, snapshot.turn, setActive])

  // Single helper: emit any in-game event with gameId attached
  const emitToGame = useCallback((ev: string, payload: object = {}) => {
    if (mode !== 'multiplayer') return
    socket.emit(ev, { gameId, ...payload })
  }, [mode, gameId])

  // Shorthand aliases used at call sites
  const emitMove  = useCallback((data: object) => emitToGame(EVENTS.MOVE,  data),  [emitToGame])
  const emitPause = useCallback((ev: string)   => emitToGame(ev),                   [emitToGame])

  // Resign sync: opponent resigned → force the correct winner locally
  useEffect(() => {
    if (mode !== 'multiplayer') return
    const onResign = ({ color }: { color: string }) => forceResign(color as Color)
    socket.on(EVENTS.RESIGN, onResign)
    return () => { socket.off(EVENTS.RESIGN, onResign) }
  }, [mode, forceResign])

  // Presence: opponent closed tab → show flag; opponent rejoined → hide flag + send sync
  useEffect(() => {
    if (mode !== 'multiplayer') return
    const onDisconnected = () => {
      if (snapshot.status === 'playing') setOpponentDisconnected(true)
    }
    const onReconnected = () => {
      setOpponentDisconnected(false)
    }
    socket.on(EVENTS.OPPONENT_DISCONNECTED, onDisconnected)
    socket.on(EVENTS.OPPONENT_RECONNECTED,  onReconnected)
    return () => {
      socket.off(EVENTS.OPPONENT_DISCONNECTED, onDisconnected)
      socket.off(EVENTS.OPPONENT_RECONNECTED,  onReconnected)
    }
  }, [mode, snapshot.status])

  // State sync: answer sync requests from a rejoining opponent
  useEffect(() => {
    if (mode !== 'multiplayer') return
    const onSyncRequest = () => {
      emitToGame(EVENTS.SYNC_STATE, exportState())
    }
    socket.on(EVENTS.SYNC_REQUEST, onSyncRequest)
    return () => { socket.off(EVENTS.SYNC_REQUEST, onSyncRequest) }
  }, [mode, emitToGame, exportState])

  // State sync: if we just rejoined, request state from the remaining player
  useEffect(() => {
    if (mode !== 'multiplayer' || !isRejoin) return
    const onSyncState = (state: SyncState) => {
      restoreState(state)
      setIsSyncing(false)
    }
    socket.on(EVENTS.SYNC_STATE, onSyncState)
    emitToGame(EVENTS.SYNC_REQUEST)
    return () => { socket.off(EVENTS.SYNC_STATE, onSyncState) }
  // Only run once on mount — emitToGame is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isRejoin])

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
      if (result === 'win') {
        makeMove(from, to, 'q')
        emitMove({ kind: 'move', from, to, promotion: 'q' })
      } else if (result === 'lose') {
        captureReversed(from)
        emitMove({ kind: 'capture_reversed', from })
      } else {
        cancelCapture()
        emitMove({ kind: 'push' })
      }
    }, 1500)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bj.phase, bj.result, pendingCapture])

  // Auto-apply matics result 1.5 s after resolved
  useEffect(() => {
    if (matics.phase !== 'resolved' || matics.result === null) return
    if (!pendingMaticsCapture && !pendingMaticsPromo) return
    const result: MaticsResult = matics.result
    // In multiplayer the defender's client just clears pending state and waits for
    // the attacker's MOVE event — the attacker is the one who emits the move.
    const defenderSide = mode === 'multiplayer' && !maticsIsAttacker

    if (pendingMaticsCapture) {
      const { from, to } = pendingMaticsCapture
      const timer = setTimeout(() => {
        setPendingMaticsCapture(null)
        setMaticsAnswered(false)
        matics.reset()
        if (defenderSide) return   // attacker's client will emit the MOVE
        if (result === 'attacker-wins') {
          makeMove(from, to, 'q')
          emitMove({ kind: 'move', from, to, promotion: 'q' })
        } else {
          captureReversed(from)
          emitMove({ kind: 'capture_reversed', from })
        }
      }, 1500)
      return () => clearTimeout(timer)
    }

    if (pendingMaticsPromo) {
      const { from, to } = pendingMaticsPromo
      const timer = setTimeout(() => {
        setPendingMaticsPromo(null)
        setMaticsAnswered(false)
        matics.reset()
        if (defenderSide) return   // attacker's client drives this
        if (result === 'attacker-wins') {
          setPendingPromo({ from, to })
        } else {
          captureReversed(from)
          emitMove({ kind: 'capture_reversed', from })
        }
      }, 1500)
      return () => clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matics.phase, matics.result, pendingMaticsCapture, pendingMaticsPromo, mode, maticsIsAttacker])

  // Computer defends math challenge: random delay + 55 % chance of a correct answer
  // If wrong, nothing happens — the player must answer to proceed
  useEffect(() => {
    if (gameVariant !== 'chessmatics' || mode !== 'computer' || matics.phase !== 'question') return
    const delay   = 1500 + Math.random() * 3500
    const correct = Math.random() < 0.55
    const timer = setTimeout(() => { if (correct) matics.resolveAs('defender-wins') }, delay)
    return () => clearTimeout(timer)
  }, [gameVariant, mode, matics.phase, matics.resolveAs])

  // Multiplayer: opponent (defender) receives MATICS_START → show same problem
  useEffect(() => {
    if (mode !== 'multiplayer' || gameVariant !== 'chessmatics') return
    const onMaticsStart = ({ from, to, kind }: { from: string; to: string; kind: string }) => {
      const colorName = (c: 'w' | 'b') => c === 'w' ? 'White' : 'Black'
      // snapshot.turn is the attacker's color at the moment they triggered the challenge
      setMaticsLabels({
        attacker: `${colorName(snapshot.turn)}'s piece`,
        defender: kind === 'capture' ? `${colorName(snapshot.turn === 'w' ? 'b' : 'w')}'s piece` : 'Promotion square',
      })
      setMaticsIsAttacker(false)
      setMaticsAnswered(false)
      if (kind === 'capture') setPendingMaticsCapture({ from: from as Square, to: to as Square })
      else                    setPendingMaticsPromo({ from: from as Square, to: to as Square })
      matics.start(`${from}${to}`)
    }
    socket.on(EVENTS.MATICS_START, onMaticsStart)
    return () => { socket.off(EVENTS.MATICS_START, onMaticsStart) }
  }, [mode, gameVariant, snapshot.turn, matics])

  // Multiplayer: server declares winner → resolve matics on both clients
  useEffect(() => {
    if (mode !== 'multiplayer' || gameVariant !== 'chessmatics') return
    const onMaticsResult = ({ winner }: { winner: 'attacker' | 'defender' }) => {
      matics.resolveAs(winner === 'attacker' ? 'attacker-wins' : 'defender-wins')
    }
    socket.on(EVENTS.MATICS_RESULT, onMaticsResult)
    return () => { socket.off(EVENTS.MATICS_RESULT, onMaticsResult) }
  }, [mode, gameVariant, matics])


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

  const triggerMatics = useCallback((from: Square, to: Square, kind: 'capture' | 'promotion') => {
    const colorName = (c: 'w' | 'b') => c === 'w' ? 'White' : 'Black'
    setMaticsLabels({
      attacker: `${colorName(snapshot.turn)}'s piece`,
      defender: kind === 'capture' ? `${colorName(snapshot.turn === 'w' ? 'b' : 'w')}'s piece` : 'Promotion square',
    })
    setMaticsIsAttacker(true)
    setMaticsAnswered(false)
    if (kind === 'capture') setPendingMaticsCapture({ from, to })
    else                    setPendingMaticsPromo({ from, to })
    matics.start(`${from}${to}`)
    // Notify opponent so they see the challenge at the same time
    emitToGame(EVENTS.MATICS_START, { from, to, kind })
  }, [snapshot.turn, matics, emitToGame])

  // ── Event handlers ─────────────────────────────────────────────────────────

  const handleResign = useCallback(() => {
    emitToGame(EVENTS.RESIGN, { color: playerColor })
    forceResign(playerColor)  // use playerColor directly — resign() uses prev.turn which can be wrong
  }, [emitToGame, playerColor, forceResign])

  const handlePause = useCallback(() => {
    if (mode === 'computer') {
      setActive(null)
      setPauseState('paused')
    } else if (mode === 'local') {
      setPauseOfferedBy(snapshot.turn)
      setPauseState('offered')
    } else {
      // multiplayer: offer to opponent
      setPauseOfferedBy(playerColor)
      setPauseState('offered')
      emitPause(EVENTS.PAUSE_OFFER)
    }
  }, [mode, playerColor, snapshot.turn, setActive, emitPause])

  const handleAcceptPause = useCallback(() => {
    setActive(null)
    setPauseState('paused')
    emitPause(EVENTS.PAUSE_ACCEPT)
  }, [setActive, emitPause])

  const handleDeclinePause = useCallback(() => {
    setPauseState('none')
    setPauseOfferedBy(null)
    emitPause(EVENTS.PAUSE_DECLINE)
  }, [emitPause])

  const handleResume = useCallback(() => {
    setPauseState('none')
    setPauseOfferedBy(null)
    if (snapshot.status === 'playing') setActive(snapshot.turn)
    emitPause(EVENTS.PAUSE_RESUME)
  }, [snapshot.status, snapshot.turn, setActive, emitPause])

  // Drag-to-move
  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }: PieceDropArgs): boolean => {
    if (!isPlayerTurn || isPaused || bjActive || maticsActive || !targetSquare) return false
    const from = sourceSquare as Square
    const to   = targetSquare as Square
    if (gameVariant === 'chessmatics') {
      if (isCapture(from, to))       { triggerMatics(from, to, 'capture');   return false }
      if (isPawnPromotion(from, to)) { triggerMatics(from, to, 'promotion'); return false }
    } else {
      if (isCapture(from, to))       { triggerCapture(from, to); return false }
      if (isPawnPromotion(from, to)) { setPendingPromo({ from, to }); return false }
    }
    const moved = makeMove(from, to)
    if (moved) emitMove({ kind: 'move', from, to })
    return moved
  }, [makeMove, emitMove, isPlayerTurn, isPaused, bjActive, maticsActive, gameVariant, isPawnPromotion, isCapture, triggerCapture, triggerMatics])

  // Click-to-move
  const handleSquareClick = useCallback(({ square }: SquareClickArgs) => {
    if (!isPlayerTurn || isPaused || bjActive || maticsActive || isGameOver) return
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
      if (gameVariant === 'chessmatics') {
        if (isCapture(from, to))       { triggerMatics(from, to, 'capture');   return }
        if (isPawnPromotion(from, to)) { triggerMatics(from, to, 'promotion'); return }
      } else {
        if (isCapture(from, to))       { triggerCapture(from, to); return }
        if (isPawnPromotion(from, to)) { setPendingPromo({ from, to }); return }
      }
      const moved = makeMove(from, to)
      if (moved) emitMove({ kind: 'move', from, to })
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
    selectedSquare, moveHighlights, isPlayerTurn, isPaused, bjActive, maticsActive, isGameOver, gameVariant,
    legalMovesFrom, isCapture, isPawnPromotion, makeMove, triggerCapture, triggerMatics, emitMove,
  ])

  const handlePromotion = useCallback((piece: PieceSymbol) => {
    if (!pendingPromo) return
    const { from, to } = pendingPromo
    makeMove(from, to, piece)
    emitMove({ kind: 'move', from, to, promotion: piece })
    setPendingPromo(null)
  }, [pendingPromo, makeMove, emitMove])

  // ── Derived styles ─────────────────────────────────────────────────────────

  const squareStyles = { ...lastMoveHighlights(snapshot), ...moveHighlights }

  const boardLocked = !isPlayerTurn || isGameOver || isPaused || !!pendingPromo || bjActive || maticsActive

  // In multiplayer the player who offered the pause can't accept their own offer
  const canRespondToPause = mode !== 'multiplayer' || pauseOfferedBy !== playerColor

  const msgClass = [
    'game-status',
    isGameOver                                                                  ? 'game-status--over'    : '',
    isPaused                                                                    ? 'game-status--paused'  : '',
    bjActive                                                                    ? 'game-status--bj'      : '',
    maticsActive                                                                ? 'game-status--matics'  : '',
    snapshot.isCheck && !isGameOver && !isPaused && !bjActive && !maticsActive  ? 'game-status--check'   : '',
  ].filter(Boolean).join(' ')

  const promoOptions = snapshot.turn === 'w' ? PROMOTION_PIECES : PROMOTION_PIECES_BLACK

  return (
    <div className="game-page">
      <header className="game-header">
        <span className="game-header__logo">Chamble</span>
      </header>

      <main className="game-main">

        {/* Left panel: Blackjack (Chess 21) or Math Challenge (Chess-Matics) */}
        {gameVariant === 'chess21' ? (
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
        ) : (
          <div className={`matics-panel-wrapper${maticsActive ? '' : ' matics-panel-wrapper--idle'}`}>
            <MaticsPanel
              phase={matics.phase}
              problem={matics.problem}
              result={matics.result}
              attackerLabel={maticsLabels.attacker}
              defenderLabel={maticsLabels.defender}
              isLocal={mode === 'local'}
              clientRole={maticsIsAttacker ? 'attacker' : 'defender'}
              answered={maticsAnswered}
              onSubmitAs={(value, role) => {
                if (mode === 'multiplayer') {
                  // Check locally without resolving — server is the arbiter
                  if (matics.problem && value === matics.problem.answer && !maticsAnswered) {
                    setMaticsAnswered(true)
                    emitToGame(EVENTS.MATICS_WIN, { role })
                  }
                } else {
                  matics.submitAnswerAs(value, role)
                }
              }}
            />
          </div>
        )}

        {/* Chessboard */}
        <div className="board-section" ref={boardContainerRef}>
          <PlayerBar
            color={topColor}
            name={topName}
            timeMs={topColor === 'w' ? times.white : times.black}
            isActive={active === topColor && !isGameOver && !isPaused}
            captured={topColor === 'w' ? snapshot.capturedByWhite : snapshot.capturedByBlack}
            isGameOver={isGameOver}
            disconnected={mode === 'multiplayer' && opponentDisconnected}
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
                boardOrientation: playerColor === 'b' ? 'black' : 'white',
              }}
            />
            {isSyncing && <div className="board-pause-overlay"><span>Syncing…</span></div>}
            {isPaused && !isSyncing && <div className="board-pause-overlay"><span>Paused</span></div>}
            {bjActive && bj.phase !== 'resolved' && !isPaused && (
              <div className="board-pause-overlay board-pause-overlay--bj"><span>Blackjack</span></div>
            )}
            {maticsActive && matics.phase !== 'resolved' && !isPaused && (
              <div className="board-pause-overlay board-pause-overlay--matics"><span>Math Challenge</span></div>
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
            color={bottomColor}
            name={bottomName}
            timeMs={bottomColor === 'w' ? times.white : times.black}
            isActive={active === bottomColor && !isGameOver && !isPaused}
            captured={bottomColor === 'w' ? snapshot.capturedByWhite : snapshot.capturedByBlack}
            isGameOver={isGameOver}
          />
        </div>

        {/* Right sidebar */}
        <div className="game-sidebar">
          <div className={msgClass}>{statusMessage(snapshot, mode, pauseState, bjActive, maticsActive)}</div>
          <MoveHistory events={snapshot.gameEvents} />
          <GameControls
            mode={mode}
            isGameOver={isGameOver}
            pauseState={pauseState}
            pauseOfferedBy={pauseOfferedBy}
            canRespondToPause={canRespondToPause}
            onPause={handlePause}
            onAcceptPause={handleAcceptPause}
            onDeclinePause={handleDeclinePause}
            onResume={handleResume}
            onResign={handleResign}
            onGoHome={() => { if (mode === 'multiplayer') socket.disconnect(); navigate('/home') }}
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
