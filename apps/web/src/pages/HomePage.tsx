import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import { WhatIsChamble } from '../components/WhatIsChamble'

export function HomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const firstName = user?.displayName.split(' ')[0] ?? 'Player'
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="page">
      <Navbar />
      <main className="home-main">
        <p className="home-greeting">Welcome back, <strong>{firstName}</strong></p>
        <div className="home-cards">
          <button className="home-card" onClick={() => navigate('/games')}>
            <span className="home-card__icon">♟</span>
            <span className="home-card__title">Games</span>
            <span className="home-card__desc">Browse and play game modes</span>
          </button>
          <button className="home-card" onClick={() => navigate('/profile')}>
            <span className="home-card__icon">◉</span>
            <span className="home-card__title">Profile</span>
            <span className="home-card__desc">Your stats and match history</span>
          </button>
        </div>
        <button className="wic-btn" onClick={() => setSidebarOpen(true)}>
          ♟ What is Chamble?
        </button>
      </main>
      <WhatIsChamble open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  )
}
