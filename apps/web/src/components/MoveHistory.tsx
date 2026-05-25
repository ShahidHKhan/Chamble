import { useEffect, useRef } from 'react'
import type { GameEvent } from '../hooks/useChessGame'

const PIECE_GLYPHS: Record<string, Record<string, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
}

interface Props {
  events: GameEvent[]
}

export function MoveHistory({ events }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  return (
    <div className="move-history">
      <div className="move-history__title">Moves</div>
      <div className="move-history__list">
        {events.length === 0 && (
          <div className="move-history__empty">No moves yet</div>
        )}
        {events.map((event, i) => {
          if (event.kind === 'chess') {
            const moveNum = Math.floor(event.ply / 2) + 1
            const isBlack = event.ply % 2 === 1
            return (
              <div key={i} className="move-history__row">
                <span className="move-history__num">{moveNum}.</span>
                <span className={`move-history__move${isBlack ? ' move-history__move--black' : ''}`}>
                  {isBlack ? 'B' : 'W'} {event.san}
                </span>
              </div>
            )
          }
          const glyph = PIECE_GLYPHS[event.loserColor][event.piece]
          return (
            <div key={i} className="move-history__row move-history__row--bj">
              <span className="move-history__num">BJ</span>
              <span className="move-history__move move-history__move--bj">{glyph} lost</span>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
    </div>
  )
}
