import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import accountsData from '../data/accounts.json'

export interface User {
  id: string
  username: string
  displayName: string
  elo: number
  wins: number
  losses: number
  draws: number
}

interface AuthContextType {
  user: User | null
  login: (username: string, password: string) => { success: boolean; error?: string }
  logout: () => void
  updateElo: (delta: number) => void
}

const MOCK_ACCOUNTS: Array<User & { password: string }> = accountsData

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

  const login = useCallback((username: string, password: string) => {
    const account = MOCK_ACCOUNTS.find(
      a => a.username.toLowerCase() === username.toLowerCase() && a.password === password,
    )
    if (!account) return { success: false, error: 'Invalid username or password' }
    const { password: _, ...userData } = account
    setUser(userData)
    localStorage.setItem('chamble_user', JSON.stringify(userData))
    return { success: true }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('chamble_user')
  }, [])

  const updateElo = useCallback((delta: number) => {
    setUser(prev => {
      if (!prev) return prev
      const updated = { ...prev, elo: prev.elo + delta }
      localStorage.setItem('chamble_user', JSON.stringify(updated))
      return updated
    })
  }, [])

  return <AuthContext.Provider value={{ user, login, logout, updateElo }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
