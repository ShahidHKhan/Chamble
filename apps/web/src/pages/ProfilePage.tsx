import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import { getMatches } from '../services/matches'
import { api } from '../services/api'
import type { DataEnvelope, MatchRecord, User } from '@chess/shared'

const RESULT_LABEL: Record<string, string> = {
  win: 'Win', loss: 'Loss', draw: 'Draw',
}

function canClaimToday(lastDailyClaimAt?: string | null): boolean {
  if (!lastDailyClaimAt) return true
  const last = new Date(lastDailyClaimAt)
  const now  = new Date()
  return (
    last.getUTCFullYear() !== now.getUTCFullYear() ||
    last.getUTCMonth()    !== now.getUTCMonth()    ||
    last.getUTCDate()     !== now.getUTCDate()
  )
}

function timeUntilMidnightUTC(): string {
  const now       = new Date()
  const midnight  = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  const ms        = midnight.getTime() - now.getTime()
  const h         = Math.floor(ms / 3_600_000)
  const m         = Math.floor((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

export function ProfilePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [matches,       setMatches]       = useState<MatchRecord[]>([])
  const [localUser,     setLocalUser]     = useState<User | null>(null)
  const [claiming,      setClaiming]      = useState(false)
  const [claimMessage,  setClaimMessage]  = useState('')

  useEffect(() => { setLocalUser(user) }, [user])

  useEffect(() => {
    if (!user) return
    getMatches(user.id).then(res => setMatches(res.data))
  }, [user])

  if (!user || !localUser) return null

  const claimable = canClaimToday(localUser.lastDailyClaimAt)

  async function handleClaim() {
    if (!localUser) return
    setClaiming(true)
    setClaimMessage('')
    try {
      const res = await api<DataEnvelope<User>>(`users/${localUser.id}/daily-reward`, {})
      if (res.isSuccess) {
        setLocalUser(res.data)
        setClaimMessage('+200 ELO claimed!')
      } else {
        setClaimMessage(res.message ?? 'Already claimed today')
      }
    } catch {
      setClaimMessage('Failed to claim reward')
    } finally {
      setClaiming(false)
    }
  }

  const total = localUser.wins + localUser.losses + localUser.draws
  const winPct = total > 0 ? Math.round((localUser.wins / total) * 100) : 0

  return (
    <div className="page">
      <Navbar />
      <main className="profile-main">

        {/* User card */}
        <section className="profile-card">
          <div className="profile-avatar">{localUser.displayName.charAt(0)}</div>
          <div className="profile-info">
            <h2 className="profile-name">{localUser.displayName}</h2>
            <p className="profile-username">@{localUser.username}</p>
            <div className="profile-elo">
              <span className="elo-badge">{localUser.elo}</span>
              <span className="elo-label">ELO</span>
            </div>
          </div>
          <div className="profile-stats">
            <div className="stat">
              <span className="stat__value stat__value--win">{localUser.wins}</span>
              <span className="stat__label">Wins</span>
            </div>
            <div className="stat">
              <span className="stat__value stat__value--loss">{localUser.losses}</span>
              <span className="stat__label">Losses</span>
            </div>
            <div className="stat">
              <span className="stat__value">{localUser.draws}</span>
              <span className="stat__label">Draws</span>
            </div>
            <div className="stat">
              <span className="stat__value">{winPct}%</span>
              <span className="stat__label">Win rate</span>
            </div>
          </div>
        </section>

        {/* Daily reward */}
        <section className="daily-reward">
          {claimable ? (
            <button className="daily-reward__btn" onClick={handleClaim} disabled={claiming}>
              {claiming ? 'Claiming…' : 'Claim Daily Reward (+200 ELO)'}
            </button>
          ) : (
            <p className="daily-reward__cooldown">Next reward in {timeUntilMidnightUTC()}</p>
          )}
          {claimMessage && <p className="daily-reward__message">{claimMessage}</p>}
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

        </div>

        <button className="back-btn" onClick={() => navigate('/home')}>← Back</button>
      </main>
    </div>
  )
}
