import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'

const MOCK_FRIENDS = [
  { id: 'f1', displayName: 'Fabiano C.', elo: 2769, status: 'offline'  as const },
  { id: 'f2', displayName: 'Ian N.',     elo: 2798, status: 'online'   as const },
  { id: 'f3', displayName: 'Ding L.',    elo: 2762, status: 'in-game'  as const },
  { id: 'f4', displayName: 'Alireza F.', elo: 2759, status: 'offline'  as const },
]

const MOCK_MATCHES = [
  { id: 'm1', opponent: 'Hikaru N.',   result: 'win'  as const, color: 'White', moves: 42, date: '2026-05-15' },
  { id: 'm2', opponent: 'Ian N.',      result: 'loss' as const, color: 'Black', moves: 67, date: '2026-05-14' },
  { id: 'm3', opponent: 'Fabiano C.',  result: 'draw' as const, color: 'White', moves: 89, date: '2026-05-13' },
]

const STATUS_LABEL: Record<string, string> = {
  online:  'Online',
  offline: 'Offline',
  'in-game': 'In Game',
}

const RESULT_LABEL: Record<string, string> = {
  win: 'Win', loss: 'Loss', draw: 'Draw',
}

export function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const total = user.wins + user.losses + user.draws
  const winPct = total > 0 ? Math.round((user.wins / total) * 100) : 0

  return (
    <div className="page">
      <Navbar />
      <main className="profile-main">

        {/* User card */}
        <section className="profile-card">
          <div className="profile-avatar">{user.displayName.charAt(0)}</div>
          <div className="profile-info">
            <h2 className="profile-name">{user.displayName}</h2>
            <p className="profile-username">@{user.username}</p>
            <div className="profile-elo">
              <span className="elo-badge">{user.elo}</span>
              <span className="elo-label">ELO</span>
            </div>
          </div>
          <div className="profile-stats">
            <div className="stat">
              <span className="stat__value stat__value--win">{user.wins}</span>
              <span className="stat__label">Wins</span>
            </div>
            <div className="stat">
              <span className="stat__value stat__value--loss">{user.losses}</span>
              <span className="stat__label">Losses</span>
            </div>
            <div className="stat">
              <span className="stat__value">{user.draws}</span>
              <span className="stat__label">Draws</span>
            </div>
            <div className="stat">
              <span className="stat__value">{winPct}%</span>
              <span className="stat__label">Win rate</span>
            </div>
          </div>
        </section>

        <div className="profile-columns">

          {/* Match history */}
          <section className="profile-section">
            <h3 className="section-title">Recent Matches</h3>
            <div className="match-list">
              {MOCK_MATCHES.map(m => (
                <div key={m.id} className="match-row">
                  <span className={`match-result match-result--${m.result}`}>
                    {RESULT_LABEL[m.result]}
                  </span>
                  <span className="match-opponent">vs {m.opponent}</span>
                  <span className="match-meta">{m.color} · {m.moves} moves</span>
                  <span className="match-date">{m.date}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Friends list */}
          <section className="profile-section">
            <h3 className="section-title">Friends</h3>
            <div className="friends-list">
              {MOCK_FRIENDS.map(f => (
                <div key={f.id} className="friend-row">
                  <span className={`friend-status friend-status--${f.status}`} />
                  <span className="friend-name">{f.displayName}</span>
                  <span className="friend-elo">{f.elo}</span>
                  <span className="friend-status-label">{STATUS_LABEL[f.status]}</span>
                </div>
              ))}
            </div>
          </section>

        </div>

        <button className="back-btn" onClick={() => navigate('/home')}>← Back</button>
      </main>
    </div>
  )
}
