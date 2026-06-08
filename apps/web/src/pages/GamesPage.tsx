import { useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import gameModesData from '../data/gameModes.json'

interface GameMode { id: string; name: string; description: string; icon: string; available: boolean; path: string }

const GAME_MODES = gameModesData as GameMode[]

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
              onClick={() => mode.available && navigate(mode.path)}
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
