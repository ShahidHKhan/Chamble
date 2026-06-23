import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import type { Color, PieceSymbol, Square, Move } from 'chess.js'

export type SyncEntry =
  | { kind: 'chess'; san: string; color: Color; captured?: PieceSymbol }
  | { kind: 'bj'; piece: PieceSymbol; loserColor: Color }

export interface SyncState {
  fen: string
  log: SyncEntry[]
  status: GameStatus
  winner: Color | null
}

export type GameMode = 'local' | 'computer' | 'multiplayer'
export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | 'timeout'

export type GameEvent =
  | { kind: 'chess'; san: string; color: Color; ply: number }
  | { kind: 'bj'; piece: PieceSymbol; loserColor: Color }

export interface GameSnapshot {
  fen: string
  turn: Color
  status: GameStatus
  winner: Color | null
  moves: Move[]
  capturedByWhite: PieceSymbol[]
  capturedByBlack: PieceSymbol[]
  gameEvents: GameEvent[]
  lastMove: { from: Square; to: Square } | null
  isCheck: boolean
}

type LogEntry =
  | { kind: 'chess'; move: Move }
  | { kind: 'bj'; piece: PieceSymbol; loserColor: Color }

function buildSnapshot(
  chess: Chess,
  status: GameStatus,
  winner: Color | null,
  lastMove: { from: Square; to: Square } | null,
  log: LogEntry[] = [],
): GameSnapshot {
  const capturedByWhite: PieceSymbol[] = []
  const capturedByBlack: PieceSymbol[] = []
  const gameEvents: GameEvent[] = []
  const moves: Move[] = []
  let chessPly = 0

  for (const entry of log) {
    if (entry.kind === 'chess') {
      if (entry.move.captured) {
        if (entry.move.color === 'w') capturedByWhite.push(entry.move.captured)
        else capturedByBlack.push(entry.move.captured)
      }
      gameEvents.push({ kind: 'chess', san: entry.move.san, color: entry.move.color, ply: chessPly })
      moves.push(entry.move)
      chessPly++
    } else {
      if (entry.loserColor === 'w') capturedByBlack.push(entry.piece)
      else capturedByWhite.push(entry.piece)
      gameEvents.push({ kind: 'bj', piece: entry.piece, loserColor: entry.loserColor })
    }
  }

  return {
    fen: chess.fen(),
    turn: chess.turn(),
    status,
    winner,
    moves,
    capturedByWhite,
    capturedByBlack,
    gameEvents,
    lastMove,
    isCheck: chess.isCheck(),
  }
}

// In king-hunt mode (chess-21, chessmatics) checkmate doesn't end the game — the king must be
// physically captured. In standard-ending mode (chess-roulette) checkmate ends normally.
function resolveStatus(chess: Chess, kingHuntMode: boolean): { status: GameStatus; winner: Color | null } {
  if (chess.isStalemate()) return { status: 'stalemate', winner: null }
  if (chess.isDraw())      return { status: 'draw',      winner: null }
  if (!kingHuntMode && chess.isCheckmate()) {
    // The side whose turn it is has been checkmated; the other side wins.
    const winner: Color = chess.turn() === 'w' ? 'b' : 'w'
    return { status: 'checkmate', winner }
  }
  return { status: 'playing', winner: null }
}

// Returns true if the piece at `from` can physically reach `to` (the opponent's king square).
// chess.js never lists king captures as legal, so we use a ghost-piece technique:
// replace the king with a capturable pawn and ask chess.js whether the attacker can take it.
function canCaptureKingSquare(chess: Chess, from: Square, to: Square): boolean {
  const attacker = chess.get(from)
  const target   = chess.get(to)
  if (!attacker || !target || target.type !== 'k') return false
  if (attacker.color === target.color) return false

  try {
    const cloned = new Chess(chess.fen())
    cloned.remove(to)
    cloned.put({ type: 'q', color: target.color }, to)
    const parts = cloned.fen().split(' ')
    parts[1] = attacker.color   // ensure it's the attacker's turn
    parts[3] = '-'              // clear en-passant
    // skipValidation: the position has no king for target.color (removed above),
    // which would normally fail chess.js's "must contain two kings" check.
    const testChess = new Chess(parts.join(' '), { skipValidation: true })
    return testChess
      .moves({ square: from, verbose: true })
      .some((m: Move) => m.to === to && m.captured)
  } catch {
    return false
  }
}

// Finds the first piece of `color` that can capture the opponent's king, if any.
function findKingCapture(chess: Chess, color: Color): { from: Square; to: Square } | null {
  const oppColor: Color = color === 'w' ? 'b' : 'w'
  // Locate the opponent's king
  let kingSq: Square | null = null
  const board = chess.board()
  outer: for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p?.type === 'k' && p.color === oppColor) {
        kingSq = `${'abcdefgh'[c]}${8 - r}` as Square
        break outer
      }
    }
  }
  if (!kingSq) return null
  // Check every piece of `color`
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p?.color === color) {
        const sq = `${'abcdefgh'[c]}${8 - r}` as Square
        if (canCaptureKingSquare(chess, sq, kingSq)) return { from: sq, to: kingSq }
      }
    }
  }
  return null
}

export function useChessGame(mode: GameMode, paused = false, playerColor: Color = 'w', kingHuntMode = true) {
  const kingHuntRef = useRef(kingHuntMode)
  kingHuntRef.current = kingHuntMode
  const chessRef    = useRef(new Chess())
  const statusRef   = useRef<GameStatus>('playing')
  const logRef      = useRef<LogEntry[]>([])
  const snapshotRef = useRef<ReturnType<typeof buildSnapshot> | null>(null)

  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    buildSnapshot(chessRef.current, 'playing', null, null),
  )

  statusRef.current   = snapshot.status
  snapshotRef.current = snapshot

  const makeMove = useCallback((from: Square, to: Square, promotion: PieceSymbol = 'q'): boolean => {
    if (statusRef.current !== 'playing') return false
    const chess = chessRef.current

    // King capture: chess.js won't allow this, so we handle it before normal validation.
    const target = chess.get(to)
    if (target?.type === 'k' && target.color !== chess.turn()) {
      if (!canCaptureKingSquare(chess, from, to)) return false
      const winner = chess.turn()
      // Log the king capture as a chess event
      const attacker = chess.get(from)!
      const san = `${attacker.type.toUpperCase()}x${to}`
      logRef.current.push({
        kind: 'chess',
        move: { from, to, san, color: winner, piece: attacker.type, captured: 'k', flags: 'c' } as unknown as Move,
      })
      chess.remove(to)   // physically remove the king so the board reflects it
      setSnapshot(buildSnapshot(chess, 'checkmate', winner, { from, to }, logRef.current))
      return true
    }

    // Normal move
    try {
      const move = chess.move({ from, to, promotion })
      if (!move) return false
      logRef.current.push({ kind: 'chess', move })
      const { status, winner } = resolveStatus(chess, kingHuntRef.current)
      setSnapshot(buildSnapshot(chess, status, winner, { from, to }, logRef.current))
      return true
    } catch {
      return false
    }
  }, [])

  // Auto-pass the turn when the current player has no legal moves (king-hunt mode only).
  // In king-hunt variants (chess-21, chessmatics) checkmate doesn't end the game — the
  // attacker must physically capture the king. In roulette (kingHuntMode=false) checkmate
  // is detected by resolveStatus and ends the game normally, so this effect is skipped.
  useEffect(() => {
    if (!kingHuntRef.current) return
    if (snapshot.status !== 'playing') return
    const chess = chessRef.current
    if (chess.moves().length > 0) return
    // Stalemate should have been caught by resolveStatus already, but guard here too.
    if (!chess.isCheck()) return
    // Flip the turn via FEN surgery (same as cancelCapture).
    const parts = chess.fen().split(' ')
    const wasTurn = parts[1] as Color
    parts[1] = wasTurn === 'w' ? 'b' : 'w'
    parts[3] = '-'
    parts[4] = String(parseInt(parts[4]) + 1)
    if (wasTurn === 'b') parts[5] = String(parseInt(parts[5]) + 1)
    chess.load(parts.join(' '))
    setSnapshot(buildSnapshot(chess, 'playing', null, snapshotRef.current?.lastMove ?? null, logRef.current))
  }, [snapshot.turn, snapshot.status])

  const resign = useCallback(() => {
    setSnapshot(prev => ({
      ...prev,
      status: 'resigned',
      winner: prev.turn === 'w' ? 'b' : 'w',
    }))
  }, [])

  const timeout = useCallback((loser: Color) => {
    setSnapshot(prev => ({
      ...prev,
      status: 'timeout',
      winner: loser === 'w' ? 'b' : 'w',
    }))
  }, [])

  const reset = useCallback(() => {
    const chess = new Chess()
    chessRef.current = chess
    logRef.current = []
    setSnapshot(buildSnapshot(chess, 'playing', null, null))
  }, [])

  // Computer move: random legal move, but first check for a king capture opportunity.
  useEffect(() => {
    if (mode !== 'computer' || snapshot.turn !== 'b' || snapshot.status !== 'playing' || paused) return
    const chess = chessRef.current
    const timer = setTimeout(() => {
      // Prioritise king capture if available
      const kc = findKingCapture(chess, 'b')
      if (kc) {
        // King capture — apply directly (bypasses blackjack/matics for computer)
        const attacker = chess.get(kc.from)!
        const san = `${attacker.type.toUpperCase()}x${kc.to}`
        logRef.current.push({
          kind: 'chess',
          move: { from: kc.from, to: kc.to, san, color: 'b', piece: attacker.type, captured: 'k', flags: 'c' } as unknown as Move,
        })
        chess.remove(kc.to)
        setSnapshot(buildSnapshot(chess, 'checkmate', 'b', kc, logRef.current))
        return
      }
      // Otherwise random legal move
      const legal = chess.moves({ verbose: true }) as Move[]
      if (!legal.length) return
      const picked = legal[Math.floor(Math.random() * legal.length)]
      const move = chess.move({ from: picked.from, to: picked.to, promotion: picked.promotion })
      logRef.current.push({ kind: 'chess', move })
      const { status, winner } = resolveStatus(chess, kingHuntRef.current)
      setSnapshot(buildSnapshot(chess, status, winner, { from: picked.from, to: picked.to }, logRef.current))
    }, 450)
    return () => clearTimeout(timer)
  }, [snapshot.turn, snapshot.status, mode, paused])

  const isPlayerTurn =
    mode === 'local' ||
    (mode === 'computer' && snapshot.turn === 'w') ||
    (mode === 'multiplayer' && snapshot.turn === playerColor)

  const isPawnPromotion = useCallback((from: Square, to: Square): boolean => {
    const piece = chessRef.current.get(from)
    if (!piece || piece.type !== 'p') return false
    const toRank = to[1]
    if (!((piece.color === 'w' && toRank === '8') || (piece.color === 'b' && toRank === '1'))) return false
    const legal = chessRef.current.moves({ verbose: true }) as Move[]
    return legal.some(m => m.from === from && m.to === to && m.promotion)
  }, [])

  const isCapture = useCallback((from: Square, to: Square): boolean => {
    const source = chessRef.current.get(from)
    const target = chessRef.current.get(to)
    if (source && target && source.color !== target.color) return true
    // En passant: target square is empty but it's still a capture
    const moves = chessRef.current.moves({ square: from, verbose: true }) as Move[]
    return moves.some(m => m.to === to && m.flags.includes('e'))
  }, [])

  const legalMovesFrom = useCallback((square: Square): Square[] => {
    if (statusRef.current !== 'playing') return []
    return (chessRef.current.moves({ square, verbose: true }) as Move[]).map(m => m.to as Square)
  }, [])

  // Attacker loses blackjack/matics: remove attacker's piece, switch turns.
  // If the attacker was the King, the game ends immediately — chess.js would
  // reject any FEN that's missing a king, so we must handle this before
  // attempting to reload the position.
  const captureReversed = useCallback((from: Square) => {
    const chess = chessRef.current
    const attackerPiece = chess.get(from)
    if (attackerPiece) {
      logRef.current.push({ kind: 'bj', piece: attackerPiece.type, loserColor: attackerPiece.color })
    }
    chess.remove(from)

    if (attackerPiece?.type === 'k') {
      // King was removed — game over, opponent wins
      const winner: Color = attackerPiece.color === 'w' ? 'b' : 'w'
      setSnapshot(buildSnapshot(chess, 'checkmate', winner, null, logRef.current))
      return
    }

    const parts = chess.fen().split(' ')
    const wasTurn = parts[1] as Color
    parts[1] = wasTurn === 'w' ? 'b' : 'w'
    parts[3] = '-'
    parts[4] = '0'
    if (wasTurn === 'b') parts[5] = String(parseInt(parts[5]) + 1)
    chess.load(parts.join(' '))
    const { status, winner } = resolveStatus(chess, kingHuntRef.current)
    setSnapshot(buildSnapshot(chess, status, winner, null, logRef.current))
  }, [])

  // Push / roulette bust: no pieces move, just switch turns
  const cancelCapture = useCallback(() => {
    const chess = chessRef.current
    const parts = chess.fen().split(' ')
    const wasTurn = parts[1] as Color
    parts[1] = wasTurn === 'w' ? 'b' : 'w'
    parts[3] = '-'
    parts[4] = String(parseInt(parts[4]) + 1)
    if (wasTurn === 'b') parts[5] = String(parseInt(parts[5]) + 1)
    chess.load(parts.join(' '))
    const { status, winner } = resolveStatus(chess, kingHuntRef.current)
    setSnapshot(buildSnapshot(chess, status, winner, null, logRef.current))
  }, [])

  const forceResign = useCallback((loserColor: Color) => {
    setSnapshot(prev => ({
      ...prev,
      status: 'resigned',
      winner: loserColor === 'w' ? 'b' : 'w',
    }))
  }, [])

  const exportState = useCallback((): SyncState => ({
    fen: chessRef.current.fen(),
    log: logRef.current.map(e =>
      e.kind === 'chess'
        ? { kind: 'chess' as const, san: e.move.san, color: e.move.color, captured: e.move.captured }
        : { kind: 'bj' as const, piece: e.piece, loserColor: e.loserColor }
    ),
    status: snapshotRef.current?.status ?? 'playing',
    winner: snapshotRef.current?.winner ?? null,
  }), [])

  const restoreState = useCallback((state: SyncState) => {
    const chess = new Chess()
    chess.load(state.fen)
    chessRef.current = chess
    const newLog: LogEntry[] = state.log.map(e =>
      e.kind === 'chess'
        ? { kind: 'chess' as const, move: { san: e.san, color: e.color, captured: e.captured } as Move }
        : { kind: 'bj' as const, piece: e.piece, loserColor: e.loserColor }
    )
    logRef.current = newLog
    setSnapshot(buildSnapshot(chess, state.status, state.winner, null, newLog))
  }, [])

  return { snapshot, makeMove, resign, forceResign, timeout, reset, exportState, restoreState, isPlayerTurn, isPawnPromotion, isCapture, legalMovesFrom, captureReversed, cancelCapture }
}
