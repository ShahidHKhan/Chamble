import type { Color, PieceSymbol } from 'chess.js'
import { formatTime } from '../hooks/useClock'

const PIECE_GLYPHS = {
  white: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  black: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
} as const

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
}

interface Props {
  color: Color
  name: string
  timeMs: number
  isActive: boolean
  captured: PieceSymbol[]
  isGameOver: boolean
  disconnected?: boolean
}

export function PlayerBar({ color, name, timeMs, isActive, captured, isGameOver, disconnected }: Props) {
  const sorted = [...captured].sort((a, b) => PIECE_VALUES[a] - PIECE_VALUES[b])
  // Pieces this player captured are opponent's color
  const glyphs = color === 'w' ? PIECE_GLYPHS.black : PIECE_GLYPHS.white
  const isLow = timeMs > 0 && timeMs < 30_000 && !isGameOver

  return (
    <div className={`player-bar${isActive ? ' player-bar--active' : ''}`}>
      <div className="player-bar__info">
        <span className={`player-bar__dot player-bar__dot--${color === 'w' ? 'white' : 'black'}`} />
        <span className="player-bar__name">{name}</span>
        {disconnected && <span className="player-bar__left-tag">left</span>}
        <span className="player-bar__captures">
          {sorted.map((p, i) => (
            <span key={i} className="player-bar__piece">{glyphs[p]}</span>
          ))}
        </span>
      </div>
      <div className={`player-bar__clock${isActive ? ' player-bar__clock--active' : ''}${isLow ? ' player-bar__clock--low' : ''}`}>
        {formatTime(timeMs)}
      </div>
    </div>
  )
}
