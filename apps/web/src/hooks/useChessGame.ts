import { useState, useCallback, useEffect, useRef } from 'react'
import { Chess } from 'chess.js'
import type { Color, PieceSymbol, Square, Move } from 'chess.js'

export type GameMode = 'local' | 'computer'
export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | 'timeout'

export interface GameSnapshot {
  fen: string
  turn: Color
  status: GameStatus
  winner: Color | null
  moves: Move[]
  capturedByWhite: PieceSymbol[]
  capturedByBlack: PieceSymbol[]
  lastMove: { from: Square; to: Square } | null
  isCheck: boolean
}

function buildSnapshot(
  chess: Chess,
  status: GameStatus,
  winner: Color | null,
  lastMove: { from: Square; to: Square } | null,
): GameSnapshot {
  const moves = chess.history({ verbose: true }) as Move[]
  const capturedByWhite: PieceSymbol[] = []
  const capturedByBlack: PieceSymbol[] = []
  for (const m of moves) {
    if (m.captured) {
      if (m.color === 'w') capturedByWhite.push(m.captured)
      else capturedByBlack.push(m.captured)
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
      const { status, winner } = resolveStatus(chess)
      setSnapshot(buildSnapshot(chess, status, winner, { from, to }))
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
      chess.move({ from: picked.from, to: picked.to, promotion: picked.promotion })
      const { status, winner } = resolveStatus(chess)
      setSnapshot(buildSnapshot(chess, status, winner, { from: picked.from, to: picked.to }))
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

  // Attacker loses blackjack: remove attacker's piece, keep defender in place, switch turns
  const captureReversed = useCallback((from: Square) => {
    const chess = chessRef.current
    chess.remove(from)
    const parts = chess.fen().split(' ')
    const wasTurn = parts[1] as Color
    parts[1] = wasTurn === 'w' ? 'b' : 'w'
    parts[3] = '-'
    parts[4] = '0'
    if (wasTurn === 'b') parts[5] = String(parseInt(parts[5]) + 1)
    chess.load(parts.join(' '))
    const { status, winner } = resolveStatus(chess)
    setSnapshot(buildSnapshot(chess, status, winner, null))
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
    setSnapshot(buildSnapshot(chess, status, winner, null))
  }, [])

  return { snapshot, makeMove, resign, timeout, reset, isPlayerTurn, isPawnPromotion, isCapture, legalMovesFrom, captureReversed, cancelCapture }
}
