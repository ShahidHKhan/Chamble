import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../lib/socket'
import { EVENTS } from '@chess/shared'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import type { GameMode } from '../hooks/useChessGame'
import type { Color } from 'chess.js'

type LobbyView = 'options' | 'creating' | 'waiting-for-joiner' | 'joining'

interface GameStartPayload {
  gameId: string
  color: Color
  opponent: string
  isRejoin?: boolean
}

export function ChessMaticsLobbyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [view, setView]                 = useState<LobbyView>('options')
  const [roomCode, setRoomCode]         = useState('')
  const [joinInput, setJoinInput]       = useState('')
  const [joinError, setJoinError]       = useState('')
  const [connectError, setConnectError] = useState(false)
  const launchedGame = useRef(false)

  useEffect(() => {
    setConnectError(false)
    socket.disconnect()
    socket.connect()
    const onConnectError = () => setConnectError(true)
    const onConnect      = () => setConnectError(false)
    socket.on('connect_error', onConnectError)
    socket.on('connect',       onConnect)
    return () => {
      socket.off('connect_error', onConnectError)
      socket.off('connect',       onConnect)
      if (!launchedGame.current) socket.disconnect()
    }
  }, [])

  useEffect(() => {
    const onGameStart = (payload: GameStartPayload) => {
      launchedGame.current = true
      navigate('/play', {
        state: { mode: 'multiplayer' satisfies GameMode, gameVariant: 'chessmatics', ...payload },
      })
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
      if (error) { setJoinError(error); setView('options') }
    }
    socket.on(EVENTS.ROOM_JOINED, onRoomJoined)
    return () => { socket.off(EVENTS.ROOM_JOINED, onRoomJoined) }
  }, [])

  const emitWhenReady = useCallback((event: string, payload: object) => {
    if (socket.connected) socket.emit(event, payload)
    else socket.once('connect', () => socket.emit(event, payload))
  }, [])

  const handleCreateRoom = useCallback(() => {
    setView('creating')
    emitWhenReady(EVENTS.CREATE_ROOM, { username: user?.displayName ?? 'Player' })
  }, [user, emitWhenReady])

  const handleJoinRoom = useCallback(() => {
    const code = joinInput.trim().toUpperCase()
    if (!code) return
    setJoinError('')
    setView('joining')
    emitWhenReady(EVENTS.JOIN_ROOM, { username: user?.displayName ?? 'Player', roomCode: code })
  }, [joinInput, user, emitWhenReady])

  const handleCancel = useCallback(() => {
    setView('options'); setRoomCode(''); setJoinInput(''); setJoinError('')
  }, [])

  return (
    <div className="page">
      <Navbar />
      <main className="lobby-main">
        <div className="lobby-header">
          <h2 className="lobby-title">Chess-Matics</h2>
          <p className="lobby-desc">Chess with a twist — captures and promotions decided by math races.</p>
        </div>

        {connectError && (
          <p className="form-error">Cannot reach the server. Make sure the backend is running.</p>
        )}

        {view === 'options' && (
          <div className="lobby-options">
            <button
              className="lobby-option"
              onClick={() => navigate('/play', { state: { mode: 'local' satisfies GameMode, gameVariant: 'chessmatics' } })}
            >
              <span className="lobby-option__icon">🎮</span>
              <span className="lobby-option__title">Local 2-Player</span>
              <span className="lobby-option__desc">Both players race to answer on the same screen</span>
            </button>
            <button
              className="lobby-option"
              onClick={() => navigate('/play', { state: { mode: 'computer' satisfies GameMode, gameVariant: 'chessmatics' } })}
            >
              <span className="lobby-option__icon">🤖</span>
              <span className="lobby-option__title">vs Bot</span>
              <span className="lobby-option__desc">Race the computer — it tries to defend after a random delay</span>
            </button>
            <button className="lobby-option" onClick={handleCreateRoom} disabled={connectError}>
              <span className="lobby-option__icon">⊕</span>
              <span className="lobby-option__title">Create Room</span>
              <span className="lobby-option__desc">Get a code and share it with a friend — you play as White</span>
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
              <button className="btn-lobby-join" onClick={handleJoinRoom} disabled={connectError || !joinInput.trim()}>
                Join
              </button>
            </div>
            {joinError && <p className="form-error">{joinError}</p>}
            <button className="back-btn" onClick={() => navigate('/games')}>← Back</button>
          </div>
        )}

        {view === 'creating' && (
          <div className="lobby-state">
            <div className="searching-spinner" aria-label="Creating room" />
            <p className="lobby-state__title">Creating your room…</p>
          </div>
        )}

        {view === 'waiting-for-joiner' && (
          <div className="lobby-state">
            <p className="lobby-state__title">Room ready — you are White</p>
            <p className="lobby-state__sub">Share this code with your opponent</p>
            <div className="room-code">{roomCode}</div>
            <p className="lobby-state__sub">Waiting for opponent to join…</p>
            <div className="searching-spinner" aria-label="Waiting" />
            <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
          </div>
        )}

        {view === 'joining' && (
          <div className="lobby-state">
            <div className="searching-spinner" aria-label="Joining room" />
            <p className="lobby-state__title">Joining room…</p>
            <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
          </div>
        )}
      </main>
    </div>
  )
}
