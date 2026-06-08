import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import { getMatches } from '../services/matches'
import type { MatchRecord } from '@chess/shared'

const STATUS_LABEL: Record<string, string> = {
  online:    'Online',
  offline:   'Offline',
  'in-game': 'In Game',
}

const RESULT_LABEL: Record<string, string> = {
  win: 'Win', loss: 'Loss', draw: 'Draw',
}

export function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [matches, setMatches] = useState<MatchRecord[]>([])

  useEffect(() => {
    if (!user) return
    getMatches(user.id).then(res => setMatches(res.data))
  }, [user])

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
              {matches.length === 0 ? (
                <p className="empty-state">No matches yet.</p>
              ) : matches.map(m => (
                <div key={m.id} className="match-row">
                  <span className={`match-result match-result--${m.result}`}>
                    {RESULT_LABEL[m.result]}
                  </span>
                  <span className="match-opponent">vs {m.opponentName}</span>
                  <span className="match-meta">{m.color} · {m.moves} moves</span>
                  <span className="match-date">{m.playedAt.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Friends list */}
          <section className="profile-section">
            <h3 className="section-title">Friends</h3>
            <div className="friends-list">
              <p className="empty-state">Friends coming soon.</p>
            </div>
          </section>

        </div>

        <button className="back-btn" onClick={() => navigate('/home')}>← Back</button>
      </main>
    </div>
  )
}
