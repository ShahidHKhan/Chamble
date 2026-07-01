import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { api } from '../services/api'
import type { DataEnvelope, User } from '@chess/shared'

interface AuthContextType {
  user: User | null
  ready: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }>
  register: (username: string, displayName: string, email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; email?: string }>
  logout: () => void
  updateElo: (delta: number) => void
  changeUsername: (username: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('chamble_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('chamble_token')
    if (!token) {
      setReady(true)
      return
    }
    api<DataEnvelope<User>>('auth/me')
      .then(res => {
        if (res.isSuccess) {
          setUser(res.data)
          localStorage.setItem('chamble_user', JSON.stringify(res.data))
        } else {
          setUser(null)
          localStorage.removeItem('chamble_user')
          localStorage.removeItem('chamble_token')
        }
      })
      .catch(() => {
        setUser(null)
        localStorage.removeItem('chamble_user')
        localStorage.removeItem('chamble_token')
      })
      .finally(() => setReady(true))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await api<DataEnvelope<{ user: User; token: string }>>(
        'auth/login',
        { username, password },
      )
      if (!res.isSuccess) return { success: false, error: res.message }
      setUser(res.data.user)
      localStorage.setItem('chamble_user', JSON.stringify(res.data.user))
      localStorage.setItem('chamble_token', res.data.token)
      return { success: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed'
      if (message === 'EMAIL_NOT_VERIFIED') {
        const email = ((err as any).data as { email?: string } | undefined)?.email ?? ''
        return { success: false, requiresVerification: true, email }
      }
      return { success: false, error: message }
    }
  }, [])

  const register = useCallback(async (username: string, displayName: string, email: string, password: string) => {
    try {
      const res = await api<DataEnvelope<{ email: string }>>(
        'auth/register',
        { username, displayName, email, password },
      )
      if (!res.isSuccess) return { success: false, error: res.message }
      return { success: true, requiresVerification: true, email: res.data.email }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Registration failed' }
    }
  }, [])

  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('chamble_user')
    localStorage.removeItem('chamble_token')
  }, [])

  const updateElo = useCallback((delta: number) => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, elo: prev.elo + delta }
      localStorage.setItem('chamble_user', JSON.stringify(updated))
      return updated
    })
    const userId = userRef.current?.id
    if (userId) {
      api<DataEnvelope<User>>(`users/${userId}/elo`, { delta }, { method: 'PATCH' })
        .then(res => {
          if (res.isSuccess) {
            setUser(res.data)
            localStorage.setItem('chamble_user', JSON.stringify(res.data))
          }
        })
        .catch(() => {})
    }
  }, [])

  const changeUsername = useCallback(async (username: string) => {
    const userId = userRef.current?.id
    if (!userId) return { success: false, error: 'Not logged in' }

    try {
      const res = await api<DataEnvelope<User>>(`users/${userId}/username`, { username }, { method: 'PATCH' })
      if (!res.isSuccess) return { success: false, error: res.message }
      setUser(res.data)
      localStorage.setItem('chamble_user', JSON.stringify(res.data))
      return { success: true }
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed to update username' }
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, updateElo, changeUsername }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export type { User }
