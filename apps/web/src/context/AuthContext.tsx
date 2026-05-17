import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

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
}

const MOCK_ACCOUNTS: Array<User & { password: string }> = [
  {
    id: '1', username: 'demo', password: 'demo',
    displayName: 'Demo User', elo: 1200,
    wins: 14, losses: 18, draws: 3,
  },
  {
    id: '2', username: 'magnus', password: 'magnus',
    displayName: 'Magnus C.', elo: 2847,
    wins: 312, losses: 44, draws: 89,
  },
  {
    id: '3', username: 'hikaru', password: 'hikaru',
    displayName: 'Hikaru N.', elo: 2789,
    wins: 289, losses: 61, draws: 72,
  },
]

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

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
