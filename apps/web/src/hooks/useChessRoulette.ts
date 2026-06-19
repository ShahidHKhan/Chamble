import { useState, useCallback, useRef, useEffect } from 'react'
import type { PieceSymbol, Color, Square } from 'chess.js'
import { Chess } from 'chess.js'

export type RoulettePhase = 'idle' | 'spinning' | 'choosing' | 'moving' | 'bust'
export type RouletteBranch = 'roll' | 'king'
export type WheelType = 'weighted' | 'balanced'

export interface RouletteState {
  phase: RoulettePhase
  rolledPiece: PieceSymbol | null
  chosenBranch: RouletteBranch | null
  // squares the active player may move FROM (filtered by rolled piece / branch)
  validFromSquares: Square[]
  // opponent's rolled piece shown on their side during their spin
  opponentRolled: PieceSymbol | null
}

export const WHEEL_WEIGHTS: Record<WheelType, [PieceSymbol, number][]> = {
  weighted: [['p', 30], ['n', 20], ['b', 20], ['r', 20], ['q', 10]],
  balanced: [['p', 20], ['n', 20], ['b', 20], ['r', 20], ['q', 20]],
}

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King',
}

export function pieceName(p: PieceSymbol): string { return PIECE_NAMES[p] }

export function spinWheel(type: WheelType = 'weighted'): PieceSymbol {
  const weights = WHEEL_WEIGHTS[type]
  const rand = Math.random() * 100
  let acc = 0
  for (const [piece, weight] of weights) {
    acc += weight
    if (rand < acc) return piece
  }
  return 'p'
}

// Returns the squares of all pieces of `type` belonging to `color` on this board.
function squaresOfType(chess: Chess, type: PieceSymbol, color: Color): Square[] {
  const result: Square[] = []
  const board = chess.board()
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === type && p.color === color) {
        result.push((`${'abcdefgh'[c]}${8 - r}`) as Square)
      }
    }
  }
  return result
}

// Returns the square of `color`'s king.
export function kingSquareOf(chess: Chess, color: Color): Square | null {
  const squares = squaresOfType(chess, 'k', color)
  return squares[0] ?? null
}

// Returns all squares that `actingColor`'s pieces of `type` can legally move to.
// For king: includes castling. `includeKingCapture`: also includes the opponent king square
// if it is reachable (detected via attack check).
function legalTargetsForType(
  chess: Chess,
  type: PieceSymbol,
  actingColor: Color,
): Square[] {
  const fromSquares = squaresOfType(chess, type, actingColor)
  const targets = new Set<Square>()
  const allMoves = chess.moves({ verbose: true })
  for (const m of allMoves) {
    const piece = chess.get(m.from as Square)
    if (piece && piece.type === type && piece.color === actingColor) {
      targets.add(m.to as Square)
    }
  }
  return Array.from(targets)
}

// Returns squares the player may move FROM, given chosen branch.
// For 'king' branch: squares where our king sits (always one square).
// For 'roll' branch: squares of pieces matching the rolled type.
export function validFromSquaresFor(
  chess: Chess,
  rolledPiece: PieceSymbol,
  branch: RouletteBranch,
  actingColor: Color,
): Square[] {
  const type: PieceSymbol = branch === 'king' ? 'k' : rolledPiece
  const candidates = squaresOfType(chess, type, actingColor)
  // Filter to only those that have at least one legal move
  return candidates.filter(sq =>
    chess.moves({ square: sq, verbose: true }).length > 0,
  )
}

export interface BustInfo {
  rollHasMoves: boolean
  kingHasMoves: boolean
}

// Checks what's available for the active player given a rolled piece.
// Returns whether each branch has any legal moves.
export function computeBustInfo(
  chess: Chess,
  rolledPiece: PieceSymbol,
  actingColor: Color,
  inCheck: boolean,
): BustInfo {
  if (inCheck) {
    // In check: only moves that escape check are valid.
    // chess.moves() already filters to only legal (check-escaping) moves.
    const allLegal = chess.moves({ verbose: true })
    const rollMoves = allLegal.filter(m => {
      const p = chess.get(m.from as Square)
      return p && p.type === rolledPiece && p.color === actingColor
    })
    const kingMoves = allLegal.filter(m => {
      const p = chess.get(m.from as Square)
      return p && p.type === 'k' && p.color === actingColor
    })
    return { rollHasMoves: rollMoves.length > 0, kingHasMoves: kingMoves.length > 0 }
  }

  const rollTargets = legalTargetsForType(chess, rolledPiece, actingColor)
  const kingTargets = legalTargetsForType(chess, 'k', actingColor)
  return { rollHasMoves: rollTargets.length > 0, kingHasMoves: kingTargets.length > 0 }
}

// Detects if any piece of `rolledType` owned by `actingColor` can capture the
// opponent's king. chess.js won't list king captures as legal moves, so we do
// this by checking if the king's square is among the attack targets of any
// matching piece. We use a cloned position with a dummy capturable piece placed
// on the king square, then check chess.js legal moves from that piece.
export function findKingCaptureMove(
  chess: Chess,
  rolledType: PieceSymbol,
  actingColor: Color,
): { from: Square; to: Square } | null {
  const opponentColor: Color = actingColor === 'w' ? 'b' : 'w'
  const kingSq = kingSquareOf(chess, opponentColor)
  if (!kingSq) return null

  const ourPieces = squaresOfType(chess, rolledType, actingColor)
  if (ourPieces.length === 0) return null

  // Replace the opponent's king with a capturable pawn so chess.js will allow
  // our piece to "capture" it and reveal the attack reach.
  const cloned = new Chess(chess.fen())
  cloned.remove(kingSq)
  // Place a pawn of opponent color — making it legally capturable
  cloned.put({ type: 'p', color: opponentColor }, kingSq)

  // Now ask chess.js for legal moves; it won't be in check-enforcement mode
  // because the king is gone — we get raw attack reachability.
  // We need to flip the turn to actingColor if it's not already.
  const clonedFen = cloned.fen().split(' ')
  clonedFen[1] = actingColor
  clonedFen[3] = '-' // clear en passant
  const testChess = new Chess(clonedFen.join(' '))

  for (const sq of ourPieces) {
    const movesFromSq = testChess.moves({ square: sq, verbose: true })
    const captures = movesFromSq.filter(m => m.to === kingSq && m.captured)
    if (captures.length > 0) {
      return { from: sq, to: kingSq }
    }
  }
  return null
}

// Checks if the piece at `from` can capture the opponent king.
// Returns the king's square if reachable, null otherwise.
export function kingCaptureTargetFrom(chess: Chess, from: Square, actingColor: Color): Square | null {
  const oppColor: Color = actingColor === 'w' ? 'b' : 'w'
  const kingSq = kingSquareOf(chess, oppColor)
  if (!kingSq) return null
  const piece = chess.get(from)
  if (!piece || piece.color !== actingColor) return null

  const cloned = new Chess(chess.fen())
  cloned.remove(kingSq)
  cloned.put({ type: 'p', color: oppColor }, kingSq)
  const parts = cloned.fen().split(' ')
  parts[1] = actingColor
  parts[3] = '-'
  const testChess = new Chess(parts.join(' '))
  const moves = testChess.moves({ square: from, verbose: true }) as import('chess.js').Move[]
  return moves.some(m => m.to === kingSq && m.captured) ? kingSq : null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

const IDLE: RouletteState = {
  phase: 'idle',
  rolledPiece: null,
  chosenBranch: null,
  validFromSquares: [],
  opponentRolled: null,
}

const SPIN_DURATION_MS = 1400

export function useChessRoulette() {
  const [state, setState] = useState<RouletteState>(IDLE)
  const spinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSpin = useCallback(() => {
    if (spinTimerRef.current) { clearTimeout(spinTimerRef.current); spinTimerRef.current = null }
  }, [])

  // Begin a turn: spin the wheel, then resolve into choosing/forced-king/bust.
  const startTurn = useCallback((chess: Chess, actingColor: Color, wheelType: WheelType = 'weighted') => {
    clearSpin()
    const rolled = spinWheel(wheelType)
    setState(prev => ({ ...prev, phase: 'spinning', rolledPiece: rolled, chosenBranch: null, validFromSquares: [] }))

    spinTimerRef.current = setTimeout(() => {
      const inCheck = chess.isCheck()
      const bust = computeBustInfo(chess, rolled, actingColor, inCheck)

      if (!bust.rollHasMoves && !bust.kingHasMoves) {
        // Neither branch has moves → Bust
        setState(prev => ({ ...prev, phase: 'bust', validFromSquares: [] }))
        return
      }

      if (!bust.rollHasMoves || rolled === 'k') {
        // Roll has no moves or rolled the king itself → forced King branch
        const fromSquares = validFromSquaresFor(chess, rolled, 'king', actingColor)
        setState(prev => ({ ...prev, phase: 'moving', chosenBranch: 'king', validFromSquares: fromSquares }))
        return
      }

      // Normal: player chooses
      setState(prev => ({ ...prev, phase: 'choosing' }))
    }, SPIN_DURATION_MS)
  }, [clearSpin])

  // Player picks Branch A (roll) or Branch B (king).
  const chooseBranch = useCallback((branch: RouletteBranch, chess: Chess, actingColor: Color) => {
    setState(prev => {
      if (prev.phase !== 'choosing' || !prev.rolledPiece) return prev
      const fromSquares = validFromSquaresFor(chess, prev.rolledPiece, branch, actingColor)
      return { ...prev, phase: 'moving', chosenBranch: branch, validFromSquares: fromSquares }
    })
  }, [])

  // Called after a move is made or a bust is handled — resets for next turn.
  const endTurn = useCallback(() => {
    clearSpin()
    setState(IDLE)
  }, [clearSpin])

  // Opponent rolled (received via socket).
  const setOpponentRolled = useCallback((piece: PieceSymbol) => {
    setState(prev => ({ ...prev, opponentRolled: piece }))
  }, [])

  const clearOpponentRolled = useCallback(() => {
    setState(prev => ({ ...prev, opponentRolled: null }))
  }, [])

  useEffect(() => () => clearSpin(), [clearSpin])

  return {
    phase: state.phase,
    rolledPiece: state.rolledPiece,
    chosenBranch: state.chosenBranch,
    validFromSquares: state.validFromSquares,
    opponentRolled: state.opponentRolled,
    startTurn,
    chooseBranch,
    endTurn,
    setOpponentRolled,
    clearOpponentRolled,
  }
}
