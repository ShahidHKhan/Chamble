import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { LandingPage }      from './pages/LandingPage'
import { RegisterPage }     from './pages/RegisterPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { VerifyEmailPage }    from './pages/VerifyEmailPage'
import { HomePage }         from './pages/HomePage'
import { ProfilePage }      from './pages/ProfilePage'
import { PublicProfilePage } from './pages/PublicProfilePage'
import { GamesPage }        from './pages/GamesPage'
import { Chess21LobbyPage }       from './pages/Chess21LobbyPage'
import { ChessMaticsLobbyPage }   from './pages/ChessMaticsLobbyPage'
import { ChessRouletteLobbyPage } from './pages/ChessRouletteLobbyPage'
import { GamePage }         from './pages/GamePage'

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  return user ? <>{children}</> : <Navigate to="/" replace />
}

function Root() {
  const { user, ready } = useAuth()
  if (!ready) return null
  return user ? <Navigate to="/home" replace /> : <LandingPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"                  element={<Root />} />
      <Route path="/register"          element={<RegisterPage />} />
      <Route path="/forgot-password"   element={<ForgotPasswordPage />} />
      <Route path="/verify-email"      element={<VerifyEmailPage />} />
      <Route path="/home"              element={<Protected><HomePage /></Protected>} />
      <Route path="/profile"           element={<Protected><ProfilePage /></Protected>} />
      <Route path="/player/:username"  element={<Protected><PublicProfilePage /></Protected>} />
      <Route path="/games"             element={<Protected><GamesPage /></Protected>} />
      <Route path="/games/chess21"          element={<Protected><Chess21LobbyPage /></Protected>} />
      <Route path="/games/chessmatics"      element={<Protected><ChessMaticsLobbyPage /></Protected>} />
      <Route path="/games/chessroulette"    element={<Protected><ChessRouletteLobbyPage /></Protected>} />
      <Route path="/play"              element={<Protected><GamePage /></Protected>} />
      <Route path="*"                  element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
