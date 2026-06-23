import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { api } from '../services/api'
import type { DataEnvelope, User } from '@chess/shared'

interface AuthContextType {
  user: User | null
  ready: boolean
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (username: string, displayName: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => void
  updateElo: (delta: number) => void
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
      return { success: false, error: err instanceof Error ? err.message : 'Login failed' }
    }
  }, [])

  const register = useCallback(async (username: string, displayName: string, email: string, password: string) => {
    try {
      const res = await api<DataEnvelope<{ user: User; token: string }>>(
        'auth/register',
        { username, displayName, email, password },
      )
      if (!res.isSuccess) return { success: false, error: res.message }
      setUser(res.data.user)
      localStorage.setItem('chamble_user', JSON.stringify(res.data.user))
      localStorage.setItem('chamble_token', res.data.token)
      return { success: true }
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

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout, updateElo }}>
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
