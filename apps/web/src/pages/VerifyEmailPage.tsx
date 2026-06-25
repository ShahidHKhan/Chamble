import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { api } from '../services/api'
import type { DataEnvelope, User } from '@chess/shared'

interface LocationState {
  email?: string
}

export function VerifyEmailPage() {
  const location = useLocation()

  const initialEmail = (location.state as LocationState)?.email ?? ''

  const [email,   setEmail]   = useState(initialEmail)
  const [code,    setCode]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [resent,  setResent]  = useState(false)

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api<DataEnvelope<{ user: User; token: string }>>(
        'auth/verify-email',
        { email: email.trim(), code: code.trim() },
      )
      if (!res.isSuccess) {
        setError(res.message ?? 'Invalid or expired code')
        return
      }
      localStorage.setItem('chamble_user', JSON.stringify(res.data.user))
      localStorage.setItem('chamble_token', res.data.token)
      window.location.replace('/home')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code')
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email.trim()) return
    setError('')
    setResent(false)
    try {
      await api('auth/resend-verification', { email: email.trim() })
      setResent(true)
    } catch {
      setError('Failed to resend. Try again.')
    }
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

      <div className="landing__modal" role="dialog" aria-label="Verify email">
        <div className="login-modal__header">
          <div className="login-modal__logo">Chamble</div>
          <p className="login-modal__tagline">Verify your email</p>
        </div>

        <p className="form-hint">
          A 6-digit code was sent to{' '}
          {initialEmail ? <strong>{initialEmail}</strong> : 'your email address'}.
          Enter it below to activate your account.
        </p>

        <form className="login-form" onSubmit={handleVerify}>
          {!initialEmail && (
            <div className="form-field">
              <label className="form-label" htmlFor="email">Email address</label>
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
          )}
          <div className="form-field">
            <label className="form-label" htmlFor="code">Verification code</label>
            <input
              id="code"
              className="form-input form-input--code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
              placeholder="000000"
              autoFocus
              required
            />
          </div>

          {error && <div className="form-error" role="alert">{error}</div>}
          {resent && <div className="form-success-inline" role="status">New code sent — check your inbox.</div>}

          <button className="btn-login" type="submit" disabled={loading}>
            {loading ? 'Verifying…' : 'Verify email'}
          </button>

          <button type="button" className="btn-text" onClick={handleResend}>
            Resend code
          </button>
        </form>

        <div className="form-divider">
          <Link to="/" className="form-link">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
