import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import type { DataEnvelope } from '@chess/shared'

type Step = 'request' | 'reset' | 'done'

export function ForgotPasswordPage() {
  const [step,        setStep]        = useState<Step>('request')
  const [email,       setEmail]       = useState('')
  const [code,        setCode]        = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [error,       setError]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const navigate = useNavigate()

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api<DataEnvelope<null>>('auth/forgot-password', { email: email.trim() })
      setStep('reset')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      await api<DataEnvelope<null>>('auth/reset-password', {
        email: email.trim(),
        code:  code.trim(),
        newPassword,
      })
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid or expired code')
    } finally {
      setLoading(false)
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

      <div className="landing__modal" role="dialog" aria-label="Reset password">
        <div className="login-modal__header">
          <div className="login-modal__logo">Chamble</div>
          <p className="login-modal__tagline">
            {step === 'request' && 'Reset your password'}
            {step === 'reset'   && 'Enter your reset code'}
            {step === 'done'    && 'Password updated'}
          </p>
        </div>

        {step === 'request' && (
          <form className="login-form" onSubmit={handleRequest}>
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
                autoFocus
                required
              />
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="btn-login" type="submit" disabled={loading}>
              {loading ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <>
            <p className="form-hint">
              A 6-digit code was sent to <strong>{email}</strong>. Enter it below along with your new password.
            </p>
            <form className="login-form" onSubmit={handleReset}>
              <div className="form-field">
                <label className="form-label" htmlFor="code">Reset code</label>
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
              <div className="form-field">
                <label className="form-label" htmlFor="newPassword">New password</label>
                <input
                  id="newPassword"
                  className="form-input"
                  type="password"
                  value={newPassword}
                  onChange={e => { setNewPassword(e.target.value); setError('') }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="confirm">Confirm new password</label>
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
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
              <button
                type="button"
                className="btn-text"
                onClick={() => { setStep('request'); setError(''); setCode('') }}
              >
                Resend code
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div className="form-success">
            <p>Your password has been reset successfully.</p>
            <button className="btn-login" onClick={() => navigate('/')}>
              Sign in
            </button>
          </div>
        )}

        <div className="form-divider">
          <Link to="/" className="form-link">Back to sign in</Link>
        </div>
      </div>
    </div>
  )
}
