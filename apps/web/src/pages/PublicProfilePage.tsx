import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar'
import { api } from '../services/api'
import { getMatches } from '../services/matches'
import type { DataEnvelope, MatchRecord, User } from '@chess/shared'

const RESULT_LABEL: Record<string, string> = {
  win: 'Win', loss: 'Loss', draw: 'Draw',
}

export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate     = useNavigate()
  const [profile,  setProfile]  = useState<User | null>(null)
  const [matches,  setMatches]  = useState<MatchRecord[]>([])
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!username) return
    api<DataEnvelope<User>>(`users/by-username/${username}`)
      .then(res => {
        if (!res.isSuccess || !res.data) { setNotFound(true); return }
        setProfile(res.data)
        return getMatches(res.data.id)
      })
      .then(res => { if (res) setMatches(res.data) })
      .catch(() => setNotFound(true))
  }, [username])

  if (notFound) {
    return (
      <div className="page">
        <Navbar />
        <main className="profile-main">
          <p style={{ color: 'var(--text)', marginTop: 40 }}>Player not found.</p>
          <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
        </main>
      </div>
    )
  }

  if (!profile) return null

  const total  = profile.wins + profile.losses + profile.draws
  const winPct = total > 0 ? Math.round((profile.wins / total) * 100) : 0

  return (
    <div className="page">
      <Navbar />
      <main className="profile-main">

        <section className="profile-card">
          <div className="profile-avatar">{profile.displayName.charAt(0)}</div>
          <div className="profile-info">
            <h2 className="profile-name">{profile.displayName}</h2>
            <p className="profile-username">@{profile.username}</p>
            <div className="profile-elo">
              <span className="elo-badge">{profile.elo}</span>
              <span className="elo-label">ELO</span>
            </div>
          </div>
          <div className="profile-stats">
            <div className="stat">
              <span className="stat__value stat__value--win">{profile.wins}</span>
              <span className="stat__label">Wins</span>
            </div>
            <div className="stat">
              <span className="stat__value stat__value--loss">{profile.losses}</span>
              <span className="stat__label">Losses</span>
            </div>
            <div className="stat">
              <span className="stat__value">{winPct}%</span>
              <span className="stat__label">Win rate</span>
            </div>
          </div>
        </section>

        <div className="profile-columns">
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
        </div>

        <button className="back-btn" onClick={() => navigate(-1)}>← Back</button>
      </main>
    </div>
  )
}
