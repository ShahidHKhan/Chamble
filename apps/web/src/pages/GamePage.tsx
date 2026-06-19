import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Chessboard } from 'react-chessboard'
import type { Square, PieceSymbol, Color } from 'chess.js'
import { socket } from '../lib/socket'
import { EVENTS } from '@chess/shared'
import { recordMatch } from '../services/matches'
import { useChessGame, type GameMode, type GameSnapshot, type SyncState } from '../hooks/useChessGame'
import { useClock } from '../hooks/useClock'
import { useBlackjack } from '../hooks/useBlackjack'
import { useChessMatics, type MaticsResult } from '../hooks/useChessMatics'
import { useChessRoulette, findKingCaptureMove, kingCaptureTargetFrom, kingSquareOf, spinWheel, computeBustInfo } from '../hooks/useChessRoulette'
import type { RouletteBranch } from '../hooks/useChessRoulette'
import { Chess } from 'chess.js'
import { PlayerBar } from '../components/PlayerBar'
import { MoveHistory } from '../components/MoveHistory'
import { GameControls, type PauseState } from '../components/GameControls'
import { BlackjackTable } from '../components/BlackjackTable'
import { MaticsPanel } from '../components/MaticsPanel'
import { RoulettePanel } from '../components/RoulettePanel'
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

type GameVariant = 'chess21' | 'chessmatics' | 'chessroulette'

function statusMessage(snapshot: GameSnapshot, mode: GameMode, pauseState: PauseState, bjActive: boolean, maticsActive: boolean, roulettePhase?: string): string {
  if (maticsActive) return 'Math Challenge in progress…'
  if (bjActive) return 'Blackjack in progress…'
  if (roulettePhase === 'spinning')  return 'Spinning the wheel…'
  if (roulettePhase === 'choosing')  return 'Choose your branch'
  if (roulettePhase === 'moving')    return 'Make your move'
  if (roulettePhase === 'bust')      return 'Turn busted — opponent to move'
  if (pauseState === 'paused') return 'Game paused'
  const { status, winner, turn, isCheck } = snapshot
  const winnerName = winner === 'w' ? 'White' : winner === 'b' ? 'Black' : null
  switch (status) {
    case 'checkmate': return `${winnerName} wins — King captured!`
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
  const { user, updateElo } = useAuth()
  const locState    = (location.state ?? {}) as { mode?: GameMode; color?: Color; opponent?: string; gameId?: string; isRejoin?: boolean; gameVariant?: GameVariant; wager?: number; wheelType?: string; timerEnabled?: boolean; timerMs?: number }
  const initialMode: GameMode = locState.mode ?? 'local'
  const playerColor: Color    = locState.color ?? 'w'
  const opponentName: string  = locState.opponent ?? (initialMode === 'computer' ? 'Computer' : 'Opponent')
  const gameId      = locState.gameId      ?? ''
  const isRejoin    = locState.isRejoin    ?? false
  const gameVariant = locState.gameVariant ?? 'chess21'
  const wager        = locState.wager        ?? 0
  const wheelType    = (locState.wheelType === 'balanced' ? 'balanced' : 'weighted') as import('../hooks/useChessRoulette').WheelType
  const timerEnabled = locState.timerEnabled ?? true
  const timerMs      = locState.timerMs      ?? 600_000

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
  const { times, active, setActive, isExpired, expiredColor } = useClock(timerMs)
  const bj      = useBlackjack()
  const matics  = useChessMatics()
  const roulette = useChessRoulette()

  const bjActive      = bj.phase !== 'idle'
  const maticsActive  = gameVariant === 'chessmatics' && matics.phase !== 'idle'
  const rouletteActive = gameVariant === 'chessroulette' && roulette.phase !== 'idle'
  const isGameOver    = snapshot.status !== 'playing'

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
    if (!timerEnabled || snapshot.status !== 'playing' || isPaused) { setActive(null); return }
    setActive(snapshot.turn)
  }, [timerEnabled, snapshot.turn, snapshot.status, isPaused, setActive])

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

  // Roulette: when a roll resolves, broadcast the piece to the opponent
  useEffect(() => {
    if (mode !== 'multiplayer' || gameVariant !== 'chessroulette') return
    if (roulette.phase === 'spinning' || roulette.phase === 'idle') return
    if (!roulette.rolledPiece || !isPlayerTurn) return
    emitToGame(EVENTS.ROULETTE_ROLLED, { piece: roulette.rolledPiece })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roulette.phase])


  // Roulette: after bust, pass the turn
  useEffect(() => {
    if (gameVariant !== 'chessroulette' || roulette.phase !== 'bust') return
    const timer = setTimeout(() => {
      roulette.endTurn()
      cancelCapture()
      if (mode === 'multiplayer') emitToGame(EVENTS.ROULETTE_BUST)
    }, 1800)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameVariant, roulette.phase])

  // Roulette: computer opponent — spin and play a random valid move of rolled type
  useEffect(() => {
    if (gameVariant !== 'chessroulette' || mode !== 'computer') return
    if (snapshot.turn !== 'b' || snapshot.status !== 'playing' || isPaused) return
    const timer = setTimeout(() => {
      const chess   = new Chess(snapshot.fen)
      const rolled  = spinWheel(wheelType)
      const bust    = computeBustInfo(chess, rolled, 'b', chess.isCheck())
      if (!bust.rollHasMoves && !bust.kingHasMoves) { cancelCapture(); return }
      const useType = bust.rollHasMoves ? rolled : 'k'
      const allLegal = chess.moves({ verbose: true }) as import('chess.js').Move[]
      const candidates = allLegal.filter(m => {
        const p = chess.get(m.from as Square)
        return p && p.type === useType && p.color === 'b'
      })
      const pick = candidates[Math.floor(Math.random() * candidates.length)]
      if (pick) makeMove(pick.from as Square, pick.to as Square, (pick.promotion ?? 'q') as PieceSymbol)
    }, 900)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameVariant, mode, snapshot.turn, snapshot.status, snapshot.fen, isPaused])

  // Reset pause on game end
  useEffect(() => {
    if (snapshot.status !== 'playing') { setPauseState('none'); setPauseOfferedBy(null) }
  }, [snapshot.status])

  // Apply ELO wager on game over (multiplayer only, once)
  const eloApplied = useRef(false)
  useEffect(() => {
    if (mode !== 'multiplayer' || wager === 0 || snapshot.status === 'playing' || eloApplied.current) return
    eloApplied.current = true
    if (snapshot.winner === playerColor) updateElo(wager)
    else if (snapshot.winner !== null)   updateElo(-wager)
  }, [snapshot.status, snapshot.winner, mode, wager, playerColor, updateElo])

  // Record the completed match to the database (all modes, once)
  const matchRecorded = useRef(false)
  useEffect(() => {
    if (snapshot.status === 'playing' || matchRecorded.current || !user) return
    matchRecorded.current = true
    const result = snapshot.winner === null
      ? 'draw' as const
      : snapshot.winner === playerColor
        ? 'win'  as const
        : 'loss' as const
    recordMatch({
      userId: user.id,
      opponentName,
      result,
      color: playerColor,
      moves: snapshot.moves.length,
      gameVariant,
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Roulette: opponent rolled → show their result in the panel
  useEffect(() => {
    if (mode !== 'multiplayer' || gameVariant !== 'chessroulette') return
    const onRolled = ({ piece }: { piece: string }) => {
      roulette.setOpponentRolled(piece as import('chess.js').PieceSymbol)
    }
    const onBust = () => {
      // Opponent busted — their turn ended, it's now our turn. The MOVE event
      // won't come (no move was made), so we need to manually flip the turn via
      // a FEN-level pass. We use cancelCapture which already does a turn-swap.
      cancelCapture()
    }
    socket.on(EVENTS.ROULETTE_ROLLED, onRolled)
    socket.on(EVENTS.ROULETTE_BUST,   onBust)
    return () => {
      socket.off(EVENTS.ROULETTE_ROLLED, onRolled)
      socket.off(EVENTS.ROULETTE_BUST,   onBust)
    }
  }, [mode, gameVariant, roulette, cancelCapture])


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

  // Roulette: execute king capture — makeMove now handles this natively
  const handleRouletteKingCapture = useCallback((from: Square, to: Square) => {
    const moved = makeMove(from, to, 'q')
    if (moved) { emitMove({ kind: 'move', from, to }); roulette.endTurn() }
  }, [makeMove, emitMove, roulette])

  // Roulette: validate that a from-square is allowed given current phase/branch
  const isRouletteSquareAllowed = useCallback((from: Square): boolean => {
    if (gameVariant !== 'chessroulette') return true
    if (roulette.phase !== 'moving') return false
    return roulette.validFromSquares.includes(from)
  }, [gameVariant, roulette.phase, roulette.validFromSquares])

  // Drag-to-move
  const handlePieceDrop = useCallback(({ sourceSquare, targetSquare }: PieceDropArgs): boolean => {
    if (!isPlayerTurn || isPaused || bjActive || maticsActive || !targetSquare) return false
    if (gameVariant === 'chessroulette' && !isRouletteSquareAllowed(sourceSquare as Square)) return false
    const from = sourceSquare as Square
    const to   = targetSquare as Square

    if (gameVariant === 'chessroulette') {
      // Check for king capture (physical capture win condition)
      const chess = new Chess(snapshot.fen)
      const kingSq = kingSquareOf(chess, snapshot.turn === 'w' ? 'b' : 'w')
      if (to === kingSq && roulette.rolledPiece) {
        const capture = findKingCaptureMove(chess, roulette.rolledPiece, snapshot.turn)
        if (capture && capture.from === from) { handleRouletteKingCapture(from, to); return false }
      }
      if (isCapture(from, to) || isPawnPromotion(from, to)) {
        const moved = makeMove(from, to, 'q')
        if (moved) { emitMove({ kind: 'move', from, to, promotion: 'q' }); roulette.endTurn() }
        return moved
      }
      const moved = makeMove(from, to)
      if (moved) { emitMove({ kind: 'move', from, to }); roulette.endTurn() }
      return moved
    }

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
  }, [makeMove, emitMove, isPlayerTurn, isPaused, bjActive, maticsActive, gameVariant,
      isPawnPromotion, isCapture, triggerCapture, triggerMatics, isRouletteSquareAllowed,
      snapshot.fen, snapshot.turn, roulette, handleRouletteKingCapture])

  // Click-to-move
  const handleSquareClick = useCallback(({ square }: SquareClickArgs) => {
    if (!isPlayerTurn || isPaused || bjActive || maticsActive || isGameOver) return
    if (gameVariant === 'chessroulette' && roulette.phase !== 'moving') return
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
      if (gameVariant === 'chessroulette') {
        // Check for king capture
        const chess = new Chess(snapshot.fen)
        const kingSq = kingSquareOf(chess, snapshot.turn === 'w' ? 'b' : 'w')
        if (to === kingSq && roulette.rolledPiece) {
          const capture = findKingCaptureMove(chess, roulette.rolledPiece, snapshot.turn)
          if (capture && capture.from === from) { handleRouletteKingCapture(from, to); return }
        }
        const moved = makeMove(from, to, 'q')
        if (moved) { emitMove({ kind: 'move', from, to, promotion: 'q' }); roulette.endTurn() }
        return
      }
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

    // Select a piece — for roulette only allow valid from-squares
    if (gameVariant === 'chessroulette' && !isRouletteSquareAllowed(sq)) {
      setSelectedSquare(null); setMoveHighlights({}); return
    }

    const targets = legalMovesFrom(sq)

    // For roulette, also add king-capture square if this specific piece can reach it
    let rouletteTargets = targets
    if (gameVariant === 'chessroulette') {
      const chess = new Chess(snapshot.fen)
      const kingSq = kingCaptureTargetFrom(chess, sq, snapshot.turn)
      if (kingSq) {
        rouletteTargets = [...new Set([...targets, kingSq])]
      }
    }

    if (rouletteTargets.length === 0) { setSelectedSquare(null); setMoveHighlights({}); return }

    setSelectedSquare(sq)
    const highlights: Record<string, React.CSSProperties> = {
      [sq]: { backgroundColor: 'rgba(20, 85, 255, 0.25)' },
    }
    for (const t of rouletteTargets) {
      highlights[t] = isCapture(sq, t)
        ? { backgroundColor: 'rgba(0, 200, 120, 0.3)' }
        : { background: 'radial-gradient(circle, rgba(0,0,0,0.18) 28%, transparent 28%)' }
    }
    setMoveHighlights(highlights)
  }, [
    selectedSquare, moveHighlights, isPlayerTurn, isPaused, bjActive, maticsActive, isGameOver, gameVariant,
    legalMovesFrom, isCapture, isPawnPromotion, makeMove, triggerCapture, triggerMatics, emitMove,
    roulette, isRouletteSquareAllowed, snapshot.fen, snapshot.turn, handleRouletteKingCapture,
  ])

  const handlePromotion = useCallback((piece: PieceSymbol) => {
    if (!pendingPromo) return
    const { from, to } = pendingPromo
    makeMove(from, to, piece)
    emitMove({ kind: 'move', from, to, promotion: piece })
    setPendingPromo(null)
  }, [pendingPromo, makeMove, emitMove])

  // ── Derived styles ─────────────────────────────────────────────────────────

  // In chess roulette 'moving' phase, highlight the pieces the player can click.
  const rouletteFromHighlights: Record<string, React.CSSProperties> =
    gameVariant === 'chessroulette' && roulette.phase === 'moving' && isPlayerTurn
      ? Object.fromEntries(roulette.validFromSquares.map(sq => [sq, { boxShadow: 'inset 0 0 0 3px rgba(255, 200, 0, 0.8)' }]))
      : {}

  const squareStyles = { ...lastMoveHighlights(snapshot), ...rouletteFromHighlights, ...moveHighlights }

  const boardLocked = !isPlayerTurn || isGameOver || isPaused || !!pendingPromo || bjActive || maticsActive
    || (gameVariant === 'chessroulette' && roulette.phase !== 'moving')

  // In multiplayer the player who offered the pause can't accept their own offer
  const canRespondToPause = mode !== 'multiplayer' || pauseOfferedBy !== playerColor

  const msgClass = [
    'game-status',
    isGameOver                                                                                    ? 'game-status--over'      : '',
    isPaused                                                                                      ? 'game-status--paused'    : '',
    bjActive                                                                                      ? 'game-status--bj'        : '',
    maticsActive                                                                                  ? 'game-status--matics'    : '',
    rouletteActive                                                                                ? 'game-status--roulette'  : '',
    snapshot.isCheck && !isGameOver && !isPaused && !bjActive && !maticsActive && !rouletteActive ? 'game-status--check'     : '',
  ].filter(Boolean).join(' ')

  const promoOptions = snapshot.turn === 'w' ? PROMOTION_PIECES : PROMOTION_PIECES_BLACK

  return (
    <div className="game-page">
      <header className="game-header">
        <span className="game-header__logo">Chamble</span>
      </header>

      <main className="game-main">

        {/* Left panel: Blackjack / Math Challenge / Roulette */}
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
        ) : gameVariant === 'chessmatics' ? (
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
        ) : (
          <RoulettePanel
            phase={roulette.phase}
            rolledPiece={roulette.rolledPiece}
            chosenBranch={roulette.chosenBranch}
            opponentRolled={roulette.opponentRolled}
            isPlayerTurn={isPlayerTurn}
            wheelType={wheelType}
            onSpin={() => {
              if (snapshot.status !== 'playing' || isPaused) return
              const chess = new Chess(snapshot.fen)
              roulette.startTurn(chess, snapshot.turn, wheelType)
            }}
            onChooseBranch={(branch: RouletteBranch) => {
              const chess = new Chess(snapshot.fen)
              roulette.chooseBranch(branch, chess, snapshot.turn)
            }}
          />
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
            timerEnabled={timerEnabled}
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
            {gameVariant === 'chessroulette' && (roulette.phase === 'spinning' || roulette.phase === 'choosing') && !isPaused && (
              <div className="board-pause-overlay board-pause-overlay--roulette">
                <span>{roulette.phase === 'spinning' ? 'Spinning…' : 'Choose branch'}</span>
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
            color={bottomColor}
            name={bottomName}
            timeMs={bottomColor === 'w' ? times.white : times.black}
            isActive={active === bottomColor && !isGameOver && !isPaused}
            captured={bottomColor === 'w' ? snapshot.capturedByWhite : snapshot.capturedByBlack}
            isGameOver={isGameOver}
            timerEnabled={timerEnabled}
          />
        </div>

        {/* Right sidebar */}
        <div className="game-sidebar">
          {mode === 'multiplayer' && wager > 0 && (
            <div className={`prize-pool${isGameOver ? ' prize-pool--over' : ''}`}>
              <span className="prize-pool__label">Prize Pool</span>
              <span className="prize-pool__amount">{wager * 2} ELO</span>
            </div>
          )}
          <div className={msgClass}>{statusMessage(snapshot, mode, pauseState, bjActive, maticsActive, rouletteActive ? roulette.phase : undefined)}</div>
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
