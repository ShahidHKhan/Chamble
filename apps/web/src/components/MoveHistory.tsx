import { useEffect, useRef } from 'react'
import type { Move } from 'chess.js'

interface Props {
  moves: Move[]
}

export function MoveHistory({ moves }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [moves.length])

  const pairs: [Move, Move | undefined][] = []
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i], moves[i + 1]])
  }

  return (
    <div className="move-history">
      <div className="move-history__title">Moves</div>
      <div className="move-history__list">
        {pairs.length === 0 && (
          <div className="move-history__empty">No moves yet</div>
        )}
        {pairs.map(([white, black], i) => (
          <div key={i} className="move-history__row">
            <span className="move-history__num">{i + 1}.</span>
            <span className="move-history__move">{white.san}</span>
            <span className="move-history__move move-history__move--black">{black?.san ?? ''}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  )
}
