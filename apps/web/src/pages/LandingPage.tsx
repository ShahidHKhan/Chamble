import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const QUICK_ACCOUNTS = ['demo', 'magnus', 'hikaru']

export function LandingPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = await login(username.trim(), password)
    if (result.success) navigate('/home')
    else setError(result.error ?? 'Login failed')
  }

  const quickLogin = async (u: string) => {
    const result = await login(u, u)
    if (result.success) navigate('/home')
  }

  return (
    <div className="landing">
      {/* Dimmed background layer */}
      <div className="landing__bg" aria-hidden="true">
        <span className="landing__bg-logo">Chamble</span>
        <div className="landing__bg-pieces" aria-hidden="true">
          {['♟','♞','♝','♜','♛','♚','♙','♘','♗','♖','♕','♔'].map((p, i) => (
            <span key={i} className="landing__bg-piece" style={{ '--i': i } as React.CSSProperties}>{p}</span>
          ))}
        </div>
      </div>
      <div className="landing__overlay" />

      {/* Login modal */}
      <div className="landing__modal" role="dialog" aria-label="Sign in">
        <div className="login-modal__header">
          <div className="login-modal__logo">Chamble</div>
          <p className="login-modal__tagline">Chess. Reimagined.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="form-input"
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError('') }}
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="form-input"
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Enter password"
              autoComplete="current-password"
            />
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn-login" type="submit">Sign In</button>
        </form>

        <div className="quick-login">
          <span className="quick-login__label">Quick access</span>
          <div className="quick-login__btns">
            {QUICK_ACCOUNTS.map(u => (
              <button key={u} className="quick-btn" onClick={() => quickLogin(u)}>
                {u.charAt(0).toUpperCase() + u.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
