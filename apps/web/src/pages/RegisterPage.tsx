import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function RegisterPage() {
  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)

  const { register } = useAuth()
  const navigate     = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    const result = await register(username.trim(), displayName.trim(), email.trim(), password)
    setLoading(false)

    if (result.success) navigate('/home')
    else setError(result.error ?? 'Registration failed')
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

      <div className="landing__modal" role="dialog" aria-label="Create account">
        <div className="login-modal__header">
          <div className="login-modal__logo">Chamble</div>
          <p className="login-modal__tagline">Create your account</p>
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
              placeholder="Choose a username"
              autoComplete="username"
              autoFocus
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              className="form-input"
              type="text"
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setError('') }}
              placeholder="Your display name"
              autoComplete="name"
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="form-input"
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              placeholder="you@example.com"
              autoComplete="email"
              required
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
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="confirm">Confirm password</label>
            <input
              id="confirm"
              className="form-input"
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError('') }}
              placeholder="Repeat your password"
              autoComplete="new-password"
              required
            />
          </div>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="btn-login" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="form-divider">
          <span>Already have an account?</span>
          <Link to="/" className="form-link form-link--prominent">Sign in</Link>
        </div>
      </div>
    </div>
  )
}
