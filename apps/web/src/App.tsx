import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LandingPage }      from './pages/LandingPage'
import { HomePage }         from './pages/HomePage'
import { ProfilePage }      from './pages/ProfilePage'
import { GamesPage }        from './pages/GamesPage'
import { Chess21LobbyPage }       from './pages/Chess21LobbyPage'
import { ChessMaticsLobbyPage }   from './pages/ChessMaticsLobbyPage'
import { ChessRouletteLobbyPage } from './pages/ChessRouletteLobbyPage'
import { GamePage }         from './pages/GamePage'

function Protected({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/" replace />
}

function Root() {
  const { user } = useAuth()
  return user ? <Navigate to="/home" replace /> : <LandingPage />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/"              element={<Root />} />
      <Route path="/home"          element={<Protected><HomePage /></Protected>} />
      <Route path="/profile"       element={<Protected><ProfilePage /></Protected>} />
      <Route path="/games"         element={<Protected><GamesPage /></Protected>} />
      <Route path="/games/chess21"      element={<Protected><Chess21LobbyPage /></Protected>} />
      <Route path="/games/chessmatics"   element={<Protected><ChessMaticsLobbyPage /></Protected>} />
      <Route path="/games/chessroulette" element={<Protected><ChessRouletteLobbyPage /></Protected>} />
      <Route path="/play"          element={<Protected><GamePage /></Protected>} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
