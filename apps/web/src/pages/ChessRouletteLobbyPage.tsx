import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { socket } from '../lib/socket'
import { EVENTS } from '@chess/shared'
import { useAuth } from '../context/AuthContext'
import { Navbar } from '../components/Navbar'
import type { GameMode } from '../hooks/useChessGame'
import type { WheelType } from '../hooks/useChessRoulette'
import type { Color } from 'chess.js'

type LobbyView = 'options' | 'computer-wheel' | 'wager-setup' | 'creating' | 'waiting-for-joiner' | 'joining'

interface GameStartPayload {
  gameId: string
  color: Color
  opponent: string
  wager: number
  wheelType?: string
  isRejoin?: boolean
}

export function ChessRouletteLobbyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [view, setView]                 = useState<LobbyView>('options')
  const [roomCode, setRoomCode]         = useState('')
  const [joinInput, setJoinInput]       = useState('')
  const [joinError, setJoinError]       = useState('')
  const [connectError, setConnectError] = useState(false)
  const [wager, setWager]               = useState(0)
  const [wagerInput, setWagerInput]     = useState('0')
  const [wagerError, setWagerError]     = useState('')
  const [wheelType, setWheelType]       = useState<WheelType>('weighted')
  const [timerEnabled, setTimerEnabled] = useState(true)
  const [timerMinutes, setTimerMinutes] = useState(10)
  // mode pending wheel selection (local or computer)
  const pendingMode = useRef<'local' | 'computer' | null>(null)
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
        state: {
          mode: 'multiplayer' satisfies GameMode,
          gameVariant: 'chessroulette',
          wheelType: payload.wheelType ?? 'weighted',
          ...payload,
        },
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

  const handleOpenWagerSetup = useCallback(() => {
    setWagerInput('0')
    setWagerError('')
    setWheelType('weighted')
    setView('wager-setup')
  }, [])

  const handleConfirmWager = useCallback(() => {
    const amount = parseInt(wagerInput, 10)
    if (isNaN(amount) || amount < 0) { setWagerError('Enter a valid amount (0 or more)'); return }
    if (amount > (user?.elo ?? 0)) { setWagerError(`You only have ${user?.elo ?? 0} ELO`); return }
    setWager(amount)
    setWagerError('')
    setView('creating')
    emitWhenReady(EVENTS.CREATE_ROOM, { username: user?.displayName ?? 'Player', wager: amount, wheelType, timerEnabled, timerMs: timerMinutes * 60_000, gameVariant: 'chessroulette' })
  }, [wagerInput, user, wheelType, timerEnabled, timerMinutes, emitWhenReady])

  const handleJoinRoom = useCallback(() => {
    const code = joinInput.trim().toUpperCase()
    if (!code) return
    setJoinError('')
    setView('joining')
    emitWhenReady(EVENTS.JOIN_ROOM, { username: user?.displayName ?? 'Player', roomCode: code, elo: user?.elo ?? 0, gameVariant: 'chessroulette' })
  }, [joinInput, user, emitWhenReady])

  const handleCancel = useCallback(() => {
    setView('options'); setRoomCode(''); setJoinInput(''); setJoinError('')
    setWager(0); setWagerInput('0'); setWagerError(''); setWheelType('weighted')
    setTimerEnabled(true); setTimerMinutes(10)
  }, [])

  const handleSelectWheel = useCallback((type: WheelType) => {
    const mode = pendingMode.current
    if (!mode) return
    navigate('/play', { state: { mode: mode satisfies GameMode, gameVariant: 'chessroulette', wheelType: type } })
  }, [navigate])

  return (
    <div className="page">
      <Navbar />
      <main className="lobby-main">
        <div className="lobby-header">
          <h2 className="lobby-title">Chess-Roulette</h2>
          <p className="lobby-desc">Spin the wheel each turn — move only the piece type you roll.</p>
        </div>

        {connectError && (
          <p className="form-error">Cannot reach the server. Make sure the backend is running.</p>
        )}

        {view === 'options' && (
          <div className="lobby-options">
            <button
              className="lobby-option"
              onClick={() => { pendingMode.current = 'computer'; setView('computer-wheel') }}
            >
              <span className="lobby-option__icon">🤖</span>
              <span className="lobby-option__title">vs Bot</span>
              <span className="lobby-option__desc">Play against the computer — it spins its own wheel</span>
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

        {/* Wheel selection for local / computer modes */}
        {view === 'computer-wheel' && (
          <div className="lobby-state">
            <p className="lobby-state__title">Choose Your Wheel</p>
            <p className="lobby-state__sub">Determines how pieces are distributed on each spin.</p>
            <div className="roulette-wheel-picker">
              <button
                className="roulette-wheel-option roulette-wheel-option--weighted"
                onClick={() => handleSelectWheel('weighted')}
              >
                <span className="roulette-wheel-option__icon">🎰</span>
                <span className="roulette-wheel-option__name">Weighted</span>
                <span className="roulette-wheel-option__desc">
                  Pawns 30% · Knights/Bishops/Rooks 20% each · Queen 10%
                </span>
              </button>
              <button
                className="roulette-wheel-option roulette-wheel-option--balanced"
                onClick={() => handleSelectWheel('balanced')}
              >
                <span className="roulette-wheel-option__icon">⚖️</span>
                <span className="roulette-wheel-option__name">Balanced</span>
                <span className="roulette-wheel-option__desc">
                  All five piece types — equal 20% chance each
                </span>
              </button>
            </div>
            <button className="back-btn" onClick={() => setView('options')}>← Back</button>
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
              <span className="setup-card__label">Wheel Type</span>
              <div className="roulette-wheel-picker">
                <button
                  className={`roulette-wheel-option roulette-wheel-option--weighted${wheelType === 'weighted' ? ' roulette-wheel-option--active' : ''}`}
                  onClick={() => setWheelType('weighted')}
                >
                  <span className="roulette-wheel-option__icon">🎰</span>
                  <span className="roulette-wheel-option__name">Weighted</span>
                  <span className="roulette-wheel-option__desc">Pawns 30% · Knights/Bishops/Rooks 20% · Queen 10%</span>
                </button>
                <button
                  className={`roulette-wheel-option roulette-wheel-option--balanced${wheelType === 'balanced' ? ' roulette-wheel-option--active' : ''}`}
                  onClick={() => setWheelType('balanced')}
                >
                  <span className="roulette-wheel-option__icon">⚖️</span>
                  <span className="roulette-wheel-option__name">Balanced</span>
                  <span className="roulette-wheel-option__desc">All five piece types — equal 20% chance each</span>
                </button>
              </div>
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
            <p className="lobby-state__sub">
              Wheel: <strong>{wheelType === 'balanced' ? 'Balanced' : 'Weighted'}</strong>
            </p>
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
