import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const QUICK_ACCOUNTS = [
  { username: 'demo',   password: 'demo123'   },
  { username: 'magnus', password: 'magnus123' },
  { username: 'hikaru', password: 'hikaru123' },
]

export function LandingPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword]     = useState('')
  const [error, setError]           = useState('')
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const result = await login(identifier.trim(), password)
    if (result.success) navigate('/home')
    else setError(result.error ?? 'Login failed')
  }

  const quickLogin = async (username: string, password: string) => {
    const result = await login(username, password)
    if (result.success) navigate('/home')
  }

  return (
    <div className="landing">
      <div className="landing__bg" aria-hidden="true">
        <span className="landing__bg-logo">Chamble</span>
        <div className="landing__bg-pieces" aria-hidden="true">
          {['♟','♞','♝','♜','♛','♚','♙','♘','♗','♖','♕','♔'].map((p, i) => (
            <span key={i} className="landing__bg-piece" style={{ '--i': i } as React.CSSProperties}>{p}</span>
          ))}
        </div>
      </div>
      <div className="landing__overlay" />

      <div className="landing__modal" role="dialog" aria-label="Sign in">
        <div className="login-modal__header">
          <div className="login-modal__logo">Chamble</div>
          <p className="login-modal__tagline">Chess + Gamble</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label className="form-label" htmlFor="identifier">Username or email</label>
            <input
              id="identifier"
              className="form-input"
              type="text"
              value={identifier}
              onChange={e => { setIdentifier(e.target.value); setError('') }}
              placeholder="Enter username or email"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="form-field">
            <div className="form-label-row">
              <label className="form-label" htmlFor="password">Password</label>
              <Link to="/forgot-password" className="form-link">Forgot password?</Link>
            </div>
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

        <div className="form-divider">
          <span>Don't have an account?</span>
          <Link to="/register" className="form-link form-link--prominent">Create account</Link>
        </div>

        <div className="quick-login">
          <span className="quick-login__label">Quick access</span>
          <div className="quick-login__btns">
            {QUICK_ACCOUNTS.map(({ username, password }) => (
              <button key={username} className="quick-btn" onClick={() => quickLogin(username, password)}>
                {username.charAt(0).toUpperCase() + username.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
