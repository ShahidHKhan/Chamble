import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import { getMatches } from '../services/matches'
import { api } from '../services/api'
import { useToast } from '../context/ToastContext'
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
  const { user, changeUsername } = useAuth()
  const navigate = useNavigate()
  const toast    = useToast()
  const [matches,   setMatches]   = useState<MatchRecord[]>([])
  const [localUser, setLocalUser] = useState<User | null>(null)
  const [claiming,  setClaiming]  = useState(false)
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameDraft,   setUsernameDraft]   = useState('')
  const [savingUsername,  setSavingUsername]  = useState(false)

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
    try {
      const res = await api<DataEnvelope<User>>(`users/${localUser.id}/daily-reward`, {})
      if (res.isSuccess) {
        setLocalUser(res.data)
        toast('+200 ELO claimed!', 'success')
      } else {
        toast(res.message ?? 'Already claimed today', 'error')
      }
    } catch {
      toast('Failed to claim reward', 'error')
    } finally {
      setClaiming(false)
    }
  }

  const total = localUser.wins + localUser.losses + localUser.draws
  const winPct = total > 0 ? Math.round((localUser.wins / total) * 100) : 0

  function startEditingUsername() {
    setUsernameDraft(localUser!.username)
    setEditingUsername(true)
  }

  async function handleSaveUsername() {
    const next = usernameDraft.trim()
    if (!next || next === localUser!.username) {
      setEditingUsername(false)
      return
    }
    setSavingUsername(true)
    try {
      const result = await changeUsername(next)
      if (result.success) {
        toast('Username updated', 'success')
        setEditingUsername(false)
      } else {
        toast(result.error ?? 'Failed to update username', 'error')
      }
    } finally {
      setSavingUsername(false)
    }
  }

  return (
    <div className="page">
      <Navbar />
      <main className="profile-main">

        {/* User card */}
        <section className="profile-card">
          <div className="profile-avatar">{localUser.displayName.charAt(0)}</div>
          <div className="profile-info">
            <h2 className="profile-name">{localUser.displayName}</h2>
            {editingUsername ? (
              <div className="profile-username-edit">
                <input
                  className="form-input"
                  value={usernameDraft}
                  onChange={e => setUsernameDraft(e.target.value)}
                  disabled={savingUsername}
                  maxLength={20}
                  autoFocus
                />
                <button className="btn-link" onClick={handleSaveUsername} disabled={savingUsername}>
                  {savingUsername ? 'Saving…' : 'Save'}
                </button>
                <button className="btn-link" onClick={() => setEditingUsername(false)} disabled={savingUsername}>
                  Cancel
                </button>
              </div>
            ) : (
              <p className="profile-username">
                @{localUser.username}
                <button className="btn-link" onClick={startEditingUsername}>Edit</button>
              </p>
            )}
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
                  <Link className="match-opponent" to={`/player/${m.opponentName}`}>vs {m.opponentName}</Link>
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
