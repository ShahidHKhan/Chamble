import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { api } from '../services/api'
import type { DataEnvelope, User } from '@chess/shared'

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
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

  // Always-current reference so updateElo's stable callback can read the latest user id
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('chamble_user')
    localStorage.removeItem('chamble_token')
  }, [])

  const updateElo = useCallback((delta: number) => {
    // Optimistic local update
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, elo: prev.elo + delta }
      localStorage.setItem('chamble_user', JSON.stringify(updated))
      return updated
    })
    // Persist to server; on success replace local state with authoritative value
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

  return <AuthContext.Provider value={{ user, login, logout, updateElo }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Re-export User from shared so consumers don't need a separate import
export type { User }
