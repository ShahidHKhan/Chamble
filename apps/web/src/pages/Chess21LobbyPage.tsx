import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../lib/socket'
import { EVENTS } from '@chess/shared'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import type { GameMode } from '../hooks/useChessGame'
import type { Color } from 'chess.js'

type LobbyView = 'options' | 'wager-setup' | 'creating' | 'waiting-for-joiner' | 'joining'

interface GameStartPayload {
  gameId: string
  color: Color
  opponent: string
  wager: number
  isRejoin?: boolean
}

export function Chess21LobbyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [view, setView]               = useState<LobbyView>('options')
  const [roomCode, setRoomCode]       = useState('')
  const [joinInput, setJoinInput]     = useState('')
  const [joinError, setJoinError]     = useState('')
  const [connectError, setConnectError] = useState(false)
  const [wager, setWager]             = useState(0)
  const [wagerInput, setWagerInput]   = useState('0')
  const [wagerError, setWagerError]   = useState('')
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timerMinutes, setTimerMinutes] = useState(10)
  // Track whether we navigated into a game so we skip disconnect on unmount.
  // Disconnecting would assign a new socket ID, losing the server-side room membership.
  const launchedGame = useRef(false)

  // Always start with a fresh connection so stale game-room membership is cleared
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

  // Navigate to game when server signals start
  useEffect(() => {
    const onGameStart = (payload: GameStartPayload) => {
      launchedGame.current = true
      navigate('/play', {
        state: { mode: 'multiplayer' satisfies GameMode, ...payload },
      })
    }
    socket.on(EVENTS.GAME_START, onGameStart)
    return () => { socket.off(EVENTS.GAME_START, onGameStart) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  // Room created → show code
  useEffect(() => {
    const onRoomCreated = ({ roomCode: code }: { roomCode: string }) => {
      setRoomCode(code)
      setView('waiting-for-joiner')
    }
    socket.on(EVENTS.ROOM_CREATED, onRoomCreated)
    return () => { socket.off(EVENTS.ROOM_CREATED, onRoomCreated) }
  }, [])

  // Room joined → error or wait for GAME_START
  useEffect(() => {
    const onRoomJoined = ({ error }: { error?: string }) => {
      if (error) {
        setJoinError(error)
        setView('options')
      }
    }
    socket.on(EVENTS.ROOM_JOINED, onRoomJoined)
    return () => { socket.off(EVENTS.ROOM_JOINED, onRoomJoined) }
  }, [])

  const emitWhenReady = useCallback((event: string, payload: object) => {
    if (socket.connected) {
      socket.emit(event, payload)
    } else {
      socket.once('connect', () => socket.emit(event, payload))
    }
  }, [])

  const handleOpenWagerSetup = useCallback(() => {
    setWagerInput('0')
    setWagerError('')
    setView('wager-setup')
  }, [])

  const handleConfirmWager = useCallback(() => {
    const amount = parseInt(wagerInput, 10)
    if (isNaN(amount) || amount < 0) { setWagerError('Enter a valid amount (0 or more)'); return }
    if (amount > (user?.elo ?? 0)) { setWagerError(`You only have ${user?.elo ?? 0} ELO`); return }
    setWager(amount)
    setWagerError('')
    setView('creating')
    emitWhenReady(EVENTS.CREATE_ROOM, { username: user?.displayName ?? 'Player', wager: amount, timerEnabled, timerMs: timerMinutes * 60_000, gameVariant: 'chess21' })
  }, [wagerInput, user, timerEnabled, timerMinutes, emitWhenReady])

  const handleCreateRoom = handleConfirmWager

  const handleJoinRoom = useCallback(() => {
    const code = joinInput.trim().toUpperCase()
    if (!code) return
    setJoinError('')
    setView('joining')
    emitWhenReady(EVENTS.JOIN_ROOM, { username: user?.displayName ?? 'Player', roomCode: code, elo: user?.elo ?? 0, gameVariant: 'chess21' })
  }, [joinInput, user, emitWhenReady])

  const handleCancel = useCallback(() => {
    setView('options')
    setRoomCode('')
    setJoinInput('')
    setJoinError('')
    setWager(0)
    setWagerInput('0')
    setWagerError('')
    setTimerEnabled(true)
    setTimerMinutes(10)
  }, [])

  return (
    <div className="page">
      <Navbar />
      <main className="lobby-main">
        <div className="lobby-header">
          <h2 className="lobby-title">Chess-21</h2>
          <p className="lobby-desc">Classic chess with a twist — captures decided by Blackjack.</p>
        </div>

        {connectError && (
          <p className="form-error">Cannot reach the server. Make sure the backend is running.</p>
        )}

        {view === 'options' && (
          <div className="lobby-options">
            <button className="lobby-option" onClick={() => navigate('/play', { state: { mode: 'computer' satisfies GameMode } })}>
              <span className="lobby-option__icon">🤖</span>
              <span className="lobby-option__title">vs Bot</span>
              <span className="lobby-option__desc">Play against a random-move bot</span>
            </button>
            <button className="lobby-option" onClick={handleOpenWagerSetup} disabled={connectError}>
              <span className="lobby-option__icon">👥</span>
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

        {view === 'wager-setup' && (
          <div className="lobby-state">
            <p className="lobby-state__title">Room Setup</p>

            <div className="setup-card">
              <span className="setup-card__label">ELO Wager</span>
              <p className="lobby-state__sub">Winner takes the Prize Pool. Your ELO: <strong>{user?.elo ?? 0}</strong></p>
              <input
                className="form-input"
                type="number"
                min={0}
                max={user?.elo ?? 0}
                value={wagerInput}
                onChange={e => { setWagerInput(e.target.value); setWagerError('') }}
                onKeyDown={e => e.key === 'Enter' && handleConfirmWager()}
                style={{ width: '120px', textAlign: 'center', fontSize: '1.2rem' }}
              />
              {wagerError && <p className="form-error">{wagerError}</p>}
            </div>

            <div className="setup-card">
              <span className="setup-card__label">Timer</span>
              <div className="lobby-toggle-row">
                <button className={`lobby-toggle-btn${timerEnabled ? ' lobby-toggle-btn--active' : ''}`} onClick={() => setTimerEnabled(true)}>On</button>
                <button className={`lobby-toggle-btn${!timerEnabled ? ' lobby-toggle-btn--active' : ''}`} onClick={() => setTimerEnabled(false)}>Off</button>
              </div>
              {timerEnabled && (
                <div className="lobby-toggle-row">
                  {[10, 30].map(m => (
                    <button key={m} className={`lobby-toggle-btn${timerMinutes === m ? ' lobby-toggle-btn--active' : ''}`} onClick={() => setTimerMinutes(m)}>{m} min</button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-lobby-join" onClick={handleConfirmWager}>Create Room</button>
              <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
            </div>
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
            {wager > 0 && <p className="lobby-state__sub">ELO wager: <strong>{wager}</strong> per player</p>}
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
