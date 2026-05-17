import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../lib/socket'
import { EVENTS } from '@chess/shared'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import type { GameMode } from '../hooks/useChessGame'

type LobbyView = 'options' | 'creating' | 'waiting-for-joiner'

interface GameStartPayload {
  gameId: string
  color: 'w' | 'b'
  opponent: string
}

export function Chess21LobbyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [view, setView]           = useState<LobbyView>('options')
  const [roomCode, setRoomCode]   = useState('')
  const [joinInput, setJoinInput] = useState('')
  const [joinError, setJoinError] = useState('')

  useEffect(() => {
    socket.connect()
    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    const onGameStart = (payload: GameStartPayload) => {
      navigate('/play', { state: payload })
    }
    socket.on(EVENTS.GAME_START, onGameStart)
    return () => { socket.off(EVENTS.GAME_START, onGameStart) }
  }, [navigate])

  useEffect(() => {
    const onRoomCreated = ({ roomCode: code }: { roomCode: string }) => {
      setRoomCode(code)
      setView('waiting-for-joiner')
    }
    socket.on(EVENTS.ROOM_CREATED, onRoomCreated)
    return () => { socket.off(EVENTS.ROOM_CREATED, onRoomCreated) }
  }, [])

  useEffect(() => {
    const onRoomJoined = ({ error }: { error?: string }) => {
      if (error) setJoinError(error)
    }
    socket.on(EVENTS.ROOM_JOINED, onRoomJoined)
    return () => { socket.off(EVENTS.ROOM_JOINED, onRoomJoined) }
  }, [])

  const handleCreateRoom = useCallback(() => {
    socket.emit(EVENTS.CREATE_ROOM, { username: user?.displayName })
    setView('creating')
  }, [user])

  const handleJoinRoom = useCallback(() => {
    if (!joinInput.trim()) return
    setJoinError('')
    socket.emit(EVENTS.JOIN_ROOM, { username: user?.displayName, roomCode: joinInput.trim() })
  }, [joinInput, user])

  const handleCancelRoom = useCallback(() => {
    setView('options')
    setRoomCode('')
    setJoinInput('')
    setJoinError('')
  }, [])

  return (
    <div className="page">
      <Navbar />
      <main className="lobby-main">
        <div className="lobby-header">
          <h2 className="lobby-title">Chess 21</h2>
          <p className="lobby-desc">Classic chess with a twist. Race to 21 points.</p>
        </div>

        {view === 'options' && (
          <div className="lobby-options">
            <button className="lobby-option" onClick={() => navigate('/play', { state: { mode: 'computer' satisfies GameMode } })}>
              <span className="lobby-option__icon">🤖</span>
              <span className="lobby-option__title">vs Bot</span>
              <span className="lobby-option__desc">Play against a random-move bot</span>
            </button>
            <button className="lobby-option" onClick={handleCreateRoom}>
              <span className="lobby-option__icon">⊕</span>
              <span className="lobby-option__title">Create Room</span>
              <span className="lobby-option__desc">Generate a room code and share it with a friend</span>
            </button>
            <div className="lobby-divider">or join an existing room</div>
            <div className="lobby-join-row">
              <input
                className="form-input lobby-join-input"
                placeholder="Room code"
                value={joinInput}
                onChange={e => { setJoinInput(e.target.value.toUpperCase()); setJoinError('') }}
                maxLength={4}
                onKeyDown={e => e.key === 'Enter' && handleJoinRoom()}
              />
              <button className="btn-lobby-join" onClick={handleJoinRoom}>Join</button>
            </div>
            {joinError && <p className="form-error">{joinError}</p>}
            <button className="back-btn" onClick={() => navigate('/games')}>← Back</button>
          </div>
        )}

        {view === 'creating' && (
          <div className="lobby-state">
            <div className="searching-spinner" aria-label="Creating room" />
            <p className="lobby-state__title">Creating your room...</p>
          </div>
        )}

        {view === 'waiting-for-joiner' && (
          <div className="lobby-state">
            <p className="lobby-state__title">Room ready</p>
            <p className="lobby-state__sub">Share this code with your opponent</p>
            <div className="room-code">{roomCode}</div>
            <p className="lobby-state__sub">Waiting for opponent to join...</p>
            <div className="searching-spinner" aria-label="Waiting" />
            <button className="btn-cancel" onClick={handleCancelRoom}>Cancel</button>
          </div>
        )}
      </main>
    </div>
  )
}
