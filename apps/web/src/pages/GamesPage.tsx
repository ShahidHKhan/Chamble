import { useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import gameModesData from '../data/gameModes.json'

interface GameMode { id: string; name: string; description: string; icon: string; available: boolean; path: string }

const ALL_MODES = gameModesData as GameMode[]

const SECTIONS: { label: string; tier: 'low' | 'mid' | 'high'; id: string }[] = [
  { label: 'Low-Gamble',  tier: 'low',  id: 'chessmatics'  },
  { label: 'Mid-Gamble',  tier: 'mid',  id: 'chess21'      },
  { label: 'High-Gamble', tier: 'high', id: 'chessroulette' },
]

export function GamesPage() {
  const navigate = useNavigate()

  return (
    <div className="page">
      <Navbar />
      <main className="games-main">
        <h2 className="games-title">Game Modes</h2>

        <div className="games-sections">
          {SECTIONS.map(({ label, tier, id }) => {
            const mode = ALL_MODES.find(m => m.id === id)
            if (!mode) return null
            return (
              <div key={id} className="games-section">
                <div className={`games-section__divider games-section__divider--${tier}`}>
                  <span className="games-section__label">{label}</span>
                </div>
                <button
                  className={`game-card game-card--section${mode.available ? ' game-card--available' : ' game-card--soon'}`}
                  onClick={() => mode.available && navigate(mode.path)}
                  disabled={!mode.available}
                >
                  <span className="game-card__icon">{mode.icon}</span>
                  <span className="game-card__name">{mode.name}</span>
                  <span className="game-card__desc">{mode.description}</span>
                  {!mode.available && <span className="game-card__badge">Coming Soon</span>}
                </button>
              </div>
            )
          })}
        </div>

        <button className="back-btn" onClick={() => navigate('/home')}>← Back</button>
      </main>
    </div>
  )
}
