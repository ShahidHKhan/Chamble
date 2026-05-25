import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import type { Color, PieceSymbol, Square, Move } from 'chess.js'

export type GameMode = 'local' | 'computer'
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

function resolveStatus(chess: Chess): { status: GameStatus; winner: Color | null } {
  if (chess.isCheckmate()) return { status: 'checkmate', winner: chess.turn() === 'w' ? 'b' : 'w' }
  if (chess.isStalemate()) return { status: 'stalemate', winner: null }
  if (chess.isDraw()) return { status: 'draw', winner: null }
  return { status: 'playing', winner: null }
}

export function useChessGame(mode: GameMode, paused = false) {
  const chessRef = useRef(new Chess())
  const statusRef = useRef<GameStatus>('playing')
  const logRef = useRef<LogEntry[]>([])

  const [snapshot, setSnapshot] = useState<GameSnapshot>(() =>
    buildSnapshot(chessRef.current, 'playing', null, null),
  )

  statusRef.current = snapshot.status

  const makeMove = useCallback((from: Square, to: Square, promotion: PieceSymbol = 'q'): boolean => {
    if (statusRef.current !== 'playing') return false
    const chess = chessRef.current
    try {
      const move = chess.move({ from, to, promotion })
      if (!move) return false
      logRef.current.push({ kind: 'chess', move })
      const { status, winner } = resolveStatus(chess)
      setSnapshot(buildSnapshot(chess, status, winner, { from, to }, logRef.current))
      return true
    } catch {
      return false
    }
  }, [])

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

  // Random computer move when it's black's turn in computer mode
  useEffect(() => {
    if (mode !== 'computer' || snapshot.turn !== 'b' || snapshot.status !== 'playing' || paused) return
    const chess = chessRef.current
    const timer = setTimeout(() => {
      const legal = chess.moves({ verbose: true }) as Move[]
      if (!legal.length) return
      const picked = legal[Math.floor(Math.random() * legal.length)]
      const move = chess.move({ from: picked.from, to: picked.to, promotion: picked.promotion })
      logRef.current.push({ kind: 'chess', move })
      const { status, winner } = resolveStatus(chess)
      setSnapshot(buildSnapshot(chess, status, winner, { from: picked.from, to: picked.to }, logRef.current))
    }, 450)
    return () => clearTimeout(timer)
  }, [snapshot.turn, snapshot.status, mode, paused])

  const isPlayerTurn = mode === 'local' || snapshot.turn === 'w'

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
    return !!(source && target && source.color !== target.color)
  }, [])

  const legalMovesFrom = useCallback((square: Square): Square[] => {
    if (statusRef.current !== 'playing') return []
    return (chessRef.current.moves({ square, verbose: true }) as Move[]).map(m => m.to as Square)
  }, [])

  // Attacker loses blackjack: log the BJ event, remove attacker's piece, switch turns
  const captureReversed = useCallback((from: Square) => {
    const chess = chessRef.current
    const attackerPiece = chess.get(from)
    if (attackerPiece) {
      logRef.current.push({ kind: 'bj', piece: attackerPiece.type, loserColor: attackerPiece.color })
    }
    chess.remove(from)
    const parts = chess.fen().split(' ')
    const wasTurn = parts[1] as Color
    parts[1] = wasTurn === 'w' ? 'b' : 'w'
    parts[3] = '-'
    parts[4] = '0'
    if (wasTurn === 'b') parts[5] = String(parseInt(parts[5]) + 1)
    chess.load(parts.join(' '))
    const { status, winner } = resolveStatus(chess)
    setSnapshot(buildSnapshot(chess, status, winner, null, logRef.current))
  }, [])

  // Push: no pieces move, just switch turns
  const cancelCapture = useCallback(() => {
    const chess = chessRef.current
    const parts = chess.fen().split(' ')
    const wasTurn = parts[1] as Color
    parts[1] = wasTurn === 'w' ? 'b' : 'w'
    parts[3] = '-'
    parts[4] = String(parseInt(parts[4]) + 1)
    if (wasTurn === 'b') parts[5] = String(parseInt(parts[5]) + 1)
    chess.load(parts.join(' '))
    const { status, winner } = resolveStatus(chess)
    setSnapshot(buildSnapshot(chess, status, winner, null, logRef.current))
  }, [])

  return { snapshot, makeMove, resign, timeout, reset, isPlayerTurn, isPawnPromotion, isCapture, legalMovesFrom, captureReversed, cancelCapture }
}
