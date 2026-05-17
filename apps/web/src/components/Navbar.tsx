import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BREADCRUMBS: Record<string, string> = {
  '/home':          'Home',
  '/games':         'Games',
  '/games/chess21': 'Chess 21',
  '/profile':       'Profile',
  '/play':          'Match',
}

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="navbar">
      <button className="navbar__logo" onClick={() => navigate('/home')}>Chamble</button>
      {BREADCRUMBS[location.pathname] && (
        <span className="navbar__page">{BREADCRUMBS[location.pathname]}</span>
      )}
      <div className="navbar__right">
        {user && (
          <>
            <span className="navbar__elo">{user.elo} ELO</span>
            <button className="navbar__user" onClick={() => navigate('/profile')}>
              {user.displayName}
            </button>
            <button className="navbar__logout" onClick={handleLogout}>Sign out</button>
          </>
        )}
      </div>
    </header>
  )
}
