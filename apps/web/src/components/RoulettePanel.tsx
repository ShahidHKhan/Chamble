import type { PieceSymbol } from 'chess.js'
import type { RoulettePhase, RouletteBranch, WheelType } from '../hooks/useChessRoulette'
import { pieceName, WHEEL_WEIGHTS } from '../hooks/useChessRoulette'

const PIECE_SYMBOLS: Record<PieceSymbol, { white: string; black: string }> = {
  p: { white: '♙', black: '♟' },
  n: { white: '♘', black: '♞' },
  b: { white: '♗', black: '♝' },
  r: { white: '♖', black: '♜' },
  q: { white: '♕', black: '♛' },
  k: { white: '♔', black: '♚' },
}

const SEGMENT_COLORS: Record<PieceSymbol, string> = {
  p: '#4a90d9',
  n: '#7c5cbf',
  b: '#2ecc71',
  r: '#e74c3c',
  q: '#f39c12',
  k: '#95a5a6',
}

interface WheelProps {
  spinning: boolean
  result: PieceSymbol | null
}

const SEGMENTS: [PieceSymbol, number][] = [
  ['p', 30], ['n', 20], ['b', 20], ['r', 20], ['q', 10],
]

// Builds SVG pie-chart wheel segments from weights.
function WheelSVG({ spinning, result }: WheelProps) {
  const cx = 80
  const cy = 80
  const r  = 72

  // Build slices
  const slices: { piece: PieceSymbol; startAngle: number; endAngle: number }[] = []
  let cumulative = 0
  for (const [piece, weight] of SEGMENTS) {
    const startAngle = (cumulative / 100) * 360 - 90
    cumulative += weight
    const endAngle = (cumulative / 100) * 360 - 90
    slices.push({ piece, startAngle, endAngle })
  }

  function polarToXY(angleDeg: number) {
    const rad = (angleDeg * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  function describeArc(start: number, end: number) {
    const s = polarToXY(start)
    const e = polarToXY(end)
    const largeArc = end - start > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y} Z`
  }

  // Find which slice matches the result (for highlight ring)
  const resultSlice = result ? slices.find(s => s.piece === result) : null
  const midAngle = resultSlice
    ? (resultSlice.startAngle + resultSlice.endAngle) / 2
    : null

  const spinClass = spinning ? 'roulette-wheel-svg--spinning' : result ? 'roulette-wheel-svg--landed' : ''

  // Landing rotation: put result slice at top (pointing to indicator arrow)
  // We compute a CSS variable for the final rotation angle when landed.
  const landedStyle = result && midAngle !== null && !spinning
    ? { '--land-angle': `${-midAngle - 90}deg` } as React.CSSProperties
    : {}

  return (
    <div className={`roulette-wheel-container ${spinClass}`} style={landedStyle}>
      <svg width="160" height="160" viewBox="0 0 160 160">
        {slices.map(({ piece, startAngle, endAngle }) => (
          <path
            key={piece}
            d={describeArc(startAngle, endAngle)}
            fill={SEGMENT_COLORS[piece]}
            stroke="#0d0d0d"
            strokeWidth="1.5"
            opacity={result && result !== piece ? 0.45 : 1}
          />
        ))}
        {/* Piece labels */}
        {slices.map(({ piece, startAngle, endAngle }) => {
          const midAng = (startAngle + endAngle) / 2
          const labelR = r * 0.62
          const rad    = (midAng * Math.PI) / 180
          const lx     = cx + labelR * Math.cos(rad)
          const ly     = cy + labelR * Math.sin(rad)
          return (
            <text
              key={`lbl-${piece}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="14"
              fill="#fff"
              style={{ userSelect: 'none', pointerEvents: 'none' }}
            >
              {PIECE_SYMBOLS[piece].white}
            </text>
          )
        })}
        {/* Centre circle */}
        <circle cx={cx} cy={cy} r={12} fill="#0d0d0d" stroke="#333" strokeWidth="1" />
      </svg>
      {/* Indicator arrow at top */}
      <div className="roulette-wheel-arrow" />
    </div>
  )
}

interface Props {
  phase: RoulettePhase
  rolledPiece: PieceSymbol | null
  chosenBranch: RouletteBranch | null
  opponentRolled: PieceSymbol | null
  isPlayerTurn: boolean
  wheelType: WheelType
  onChooseBranch: (branch: RouletteBranch) => void
}

export function RoulettePanel({
  phase,
  rolledPiece,
  chosenBranch,
  opponentRolled,
  isPlayerTurn,
  wheelType,
  onChooseBranch,
}: Props) {
  const isIdle = phase === 'idle'
  const activeSegments = WHEEL_WEIGHTS[wheelType]

  return (
    <div className={`roulette-panel${isIdle ? ' roulette-panel--idle' : ''}`}>
      <div className="roulette-table">
        <div className="roulette-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="roulette-header__title">Chess-Roulette</span>
            <span className="roulette-wheel-badge" data-type={wheelType}>
              {wheelType === 'weighted' ? 'Weighted' : 'Balanced'}
            </span>
          </div>
          <span className="roulette-header__sub">
            {isPlayerTurn
              ? phase === 'idle'    ? 'Waiting for your turn…'
              : phase === 'spinning'? 'Spinning the wheel…'
              : phase === 'choosing'? 'Choose your branch'
              : phase === 'moving'  ? `Move a ${rolledPiece ? pieceName(rolledPiece) : ''}`
              : 'Turn busted!'
              : opponentRolled
              ? `Opponent rolled: ${pieceName(opponentRolled)}`
              : 'Opponent is spinning…'
            }
          </span>
        </div>

        {/* Wheel */}
        <div className="roulette-wheel-wrapper">
          <WheelSVG
            spinning={phase === 'spinning'}
            result={isPlayerTurn ? rolledPiece : opponentRolled}
          />
        </div>

        {/* Result badge */}
        {rolledPiece && phase !== 'spinning' && isPlayerTurn && (
          <div className="roulette-result-badge" style={{ borderColor: SEGMENT_COLORS[rolledPiece] }}>
            <span style={{ color: SEGMENT_COLORS[rolledPiece], fontSize: '1.5rem' }}>
              {PIECE_SYMBOLS[rolledPiece].white}
            </span>
            <span className="roulette-result-badge__name">{pieceName(rolledPiece)}</span>
            {phase === 'bust' && <span className="roulette-bust-tag">BUST</span>}
          </div>
        )}

        {/* Branch choice buttons */}
        {phase === 'choosing' && rolledPiece && isPlayerTurn && (
          <div className="roulette-branches">
            <button
              className="roulette-branch-btn roulette-branch-btn--roll"
              onClick={() => onChooseBranch('roll')}
            >
              <span className="roulette-branch-btn__icon">{PIECE_SYMBOLS[rolledPiece].white}</span>
              <span className="roulette-branch-btn__label">Play the Roll</span>
              <span className="roulette-branch-btn__sub">Move a {pieceName(rolledPiece)}</span>
            </button>
            <button
              className="roulette-branch-btn roulette-branch-btn--king"
              onClick={() => onChooseBranch('king')}
            >
              <span className="roulette-branch-btn__icon">♔</span>
              <span className="roulette-branch-btn__label">Play the King</span>
              <span className="roulette-branch-btn__sub">Forfeit roll, move King</span>
            </button>
          </div>
        )}

        {/* Moving hint */}
        {phase === 'moving' && isPlayerTurn && rolledPiece && (
          <div className="roulette-moving-hint">
            {chosenBranch === 'king'
              ? 'Move your King on the board'
              : `Move a ${pieceName(rolledPiece)} on the board`
            }
            {chosenBranch === 'king' && (
              <div className="roulette-moving-hint__sub">
                (King Wild Card activated)
              </div>
            )}
          </div>
        )}

        {/* Bust message */}
        {phase === 'bust' && (
          <div className="roulette-bust-notice">
            No valid moves — turn passed to opponent.
          </div>
        )}

        {/* Probability legend */}
        {isIdle && (
          <div className="roulette-legend">
            {activeSegments.map(([piece, pct]) => (
              <div key={piece} className="roulette-legend__row">
                <span className="roulette-legend__swatch" style={{ background: SEGMENT_COLORS[piece] }} />
                <span className="roulette-legend__piece">{PIECE_SYMBOLS[piece].white} {pieceName(piece)}</span>
                <span className="roulette-legend__pct">{pct}%</span>
              </div>
            ))}
            <div className="roulette-legend__row roulette-legend__row--king">
              <span className="roulette-legend__swatch" style={{ background: '#555' }} />
              <span className="roulette-legend__piece">♔ King</span>
              <span className="roulette-legend__pct">Wild</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
