import { useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'

const GAME_MODES = [
  {
    id: 'chess21',
    name: 'Chess 21',
    description: 'Classic chess with a twist. Race to 21 points.',
    icon: '♟',
    available: true,
  },
  {
    id: 'blitz',
    name: 'Blitz Rush',
    description: '3-minute bullet chess. No time to think.',
    icon: '⚡',
    available: false,
  },
  {
    id: 'wager',
    name: 'Wager Match',
    description: 'Put something on the line. High stakes chess.',
    icon: '🎰',
    available: false,
  },
  {
    id: 'team',
    name: 'Team Battle',
    description: '2v2 collaborative chess. Decide moves together.',
    icon: '⚔',
    available: false,
  },
]

export function GamesPage() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <Navbar />
      <main className="games-main">
        <h2 className="games-title">Game Modes</h2>
        <div className="games-grid">
          {GAME_MODES.map(mode => (
            <button
              key={mode.id}
              className={`game-card${mode.available ? ' game-card--available' : ' game-card--soon'}`}
              onClick={() => mode.available && navigate('/games/chess21')}
              disabled={!mode.available}
            >
              <span className="game-card__icon">{mode.icon}</span>
              <span className="game-card__name">{mode.name}</span>
              <span className="game-card__desc">{mode.description}</span>
              {!mode.available && <span className="game-card__badge">Coming Soon</span>}
            </button>
          ))}
        </div>
        <button className="back-btn" onClick={() => navigate('/home')}>← Back</button>
      </main>
    </div>
  )
}
