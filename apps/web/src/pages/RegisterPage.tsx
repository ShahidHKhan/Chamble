import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Eye, EyeOff } from '../components/icons'

export function RegisterPage() {
  const [username,      setUsername]      = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [displayName,   setDisplayName]   = useState('')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [confirm,       setConfirm]       = useState('')
  const [showPassword,  setShowPassword]  = useState(false)
  const [error,         setError]         = useState('')
  const [loading,       setLoading]       = useState(false)

  const { register } = useAuth()
  const navigate     = useNavigate()

  const RESERVED = new Set(['admin','support','moderator','mod','root','chamble','system','help','staff','official'])

  function validateUsername(value: string): string {
    if (value.length < 3 || value.length > 20) return 'Must be 3–20 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Letters, numbers, and underscores only'
    if (RESERVED.has(value.toLowerCase())) return 'That username is reserved'
    return ''
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const uErr = validateUsername(username)
    if (uErr) { setUsernameError(uErr); return }

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

    if (result.success && result.requiresVerification) navigate('/verify-email', { state: { email: email.trim() } })
    else if (result.success) navigate('/home')
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
              className={`form-input${usernameError ? ' form-input--error' : ''}`}
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setUsernameError('') }}
              onBlur={e => setUsernameError(validateUsername(e.target.value.trim()))}
              placeholder="Choose a username"
              autoComplete="username"
              autoFocus
              required
            />
            {usernameError && <span className="field-error">{usernameError}</span>}
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
            <div className="password-wrapper">
              <input
                id="password"
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="At least 8 characters"
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="confirm">Confirm password</label>
            <div className="password-wrapper">
              <input
                id="confirm"
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={e => { setConfirm(e.target.value); setError('') }}
                placeholder="Repeat your password"
                autoComplete="new-password"
                required
              />
            </div>
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
