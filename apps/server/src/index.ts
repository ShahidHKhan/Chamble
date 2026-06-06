import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import 'dotenv/config'
import { EVENTS } from '@chess/shared'

const app  = express()
const http = createServer(app)
const io   = new Server(http, { cors: { origin: '*' } })
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_, res) => res.json({ ok: true }))

// ── Matchmaking state ────────────────────────────────────────────────────────

interface RoomEntry { hostSocketId: string; hostUsername: string; wager: number }

const privateRooms = new Map<string, RoomEntry>()

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

// ── Active game tracking (for disconnect/reconnect) ──────────────────────────

interface ActivePlayer { socketId: string | null; name: string; color: 'w' | 'b' }
interface ActiveGame   { gameId: string; code: string; players: [ActivePlayer, ActivePlayer]; wager: number }

const activeGames  = new Map<string, ActiveGame>() // gameId  → game
const socketToGame = new Map<string, string>()      // socketId → gameId
const codeToGame   = new Map<string, string>()      // roomCode → gameId (for rejoin)

// Per-game matics challenge state: prevent double-resolution on simultaneous MATICS_WIN
const activeMaticsChallenges = new Map<string, { resolved: boolean }>()

function startGame(p1Id: string, p1Name: string, p2Id: string, p2Name: string, code: string, wager: number) {
  const gameId = `game_${Date.now()}`
  io.sockets.sockets.get(p1Id)?.join(gameId)
  io.sockets.sockets.get(p2Id)?.join(gameId)

  activeGames.set(gameId, {
    gameId, code, wager,
    players: [
      { socketId: p1Id, name: p1Name, color: 'w' },
      { socketId: p2Id, name: p2Name, color: 'b' },
    ],
  })
  socketToGame.set(p1Id, gameId)
  socketToGame.set(p2Id, gameId)
  codeToGame.set(code, gameId)

  io.to(p1Id).emit(EVENTS.GAME_START, { gameId, color: 'w', opponent: p2Name, wager })
  io.to(p2Id).emit(EVENTS.GAME_START, { gameId, color: 'b', opponent: p1Name, wager })
  console.log(`[game] ${p1Name} vs ${p2Name} → ${gameId} (wager: ${wager})`)
}

// ── Socket handlers ──────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`)

  // Private room: create
  socket.on(EVENTS.CREATE_ROOM, ({ username, wager = 0 }: { username: string; wager?: number }) => {
    let code = generateRoomCode()
    while (privateRooms.has(code)) code = generateRoomCode()
    privateRooms.set(code, { hostSocketId: socket.id, hostUsername: username, wager })
    socket.emit(EVENTS.ROOM_CREATED, { roomCode: code })
    console.log(`[room] ${username} created ${code} (wager: ${wager})`)
  })

  // Private room: join (also handles rejoin for active games)
  socket.on(EVENTS.JOIN_ROOM, ({ username, roomCode, elo = 0 }: { username: string; roomCode: string; elo?: number }) => {
    const code = roomCode.toUpperCase()

    // ── Rejoin path ──────────────────────────────────────────────────────────
    const activeGameId = codeToGame.get(code)
    if (activeGameId) {
      const game = activeGames.get(activeGameId)
      if (!game) {
        socket.emit(EVENTS.ROOM_JOINED, { error: 'Game is no longer active' })
        return
      }
      const slot = game.players.find(p => p.socketId === null)
      if (!slot) {
        socket.emit(EVENTS.ROOM_JOINED, { error: 'Game is still full' })
        return
      }
      const remaining = game.players.find(p => p !== slot)!
      slot.socketId = socket.id
      socketToGame.set(socket.id, activeGameId)
      socket.join(activeGameId)
      // Rejoin uses GAME_START so the lobby navigates normally
      socket.emit(EVENTS.GAME_START, {
        gameId: activeGameId,
        color: slot.color,
        opponent: remaining.name,
        isRejoin: true,
        wager: game.wager,
      })
      socket.to(activeGameId).emit(EVENTS.OPPONENT_RECONNECTED)
      console.log(`[rejoin] ${username} rejoined ${activeGameId}`)
      return
    }

    // ── Normal join path ─────────────────────────────────────────────────────
    const room = privateRooms.get(code)
    if (!room) {
      socket.emit(EVENTS.ROOM_JOINED, { error: 'Room not found' })
      return
    }
    if (room.hostSocketId === socket.id) {
      socket.emit(EVENTS.ROOM_JOINED, { error: 'Cannot join your own room' })
      return
    }
    if (elo < room.wager) {
      socket.emit(EVENTS.ROOM_JOINED, { error: `This room requires ${room.wager} ELO to join (you have ${elo})` })
      return
    }
    privateRooms.delete(code)
    socket.emit(EVENTS.ROOM_JOINED, {})
    startGame(room.hostSocketId, room.hostUsername, socket.id, username, code, room.wager)
    console.log(`[room] ${username} joined ${code}`)
  })

  // Relay moves
  socket.on(EVENTS.MOVE, ({ gameId, ...moveData }: { gameId: string; [key: string]: unknown }) => {
    socket.to(gameId).emit(EVENTS.MOVE, moveData)
  })

  // Relay resign directly to the opponent's socket (bypasses room lookup)
  socket.on(EVENTS.RESIGN, ({ gameId, color }: { gameId: string; color: string }) => {
    const game = activeGames.get(gameId)
    const opponent = game?.players.find(p => p.socketId !== socket.id && p.socketId !== null)
    if (opponent?.socketId) {
      io.to(opponent.socketId).emit(EVENTS.RESIGN, { color })
    } else {
      socket.to(gameId).emit(EVENTS.RESIGN, { color })
    }
  })

  // Relay pause events
  const pauseEvents = [EVENTS.PAUSE_OFFER, EVENTS.PAUSE_ACCEPT, EVENTS.PAUSE_DECLINE, EVENTS.PAUSE_RESUME] as const
  for (const ev of pauseEvents) {
    socket.on(ev, ({ gameId }: { gameId: string }) => {
      socket.to(gameId).emit(ev)
    })
  }

  // Relay sync request / sync state (for rejoin)
  socket.on(EVENTS.SYNC_REQUEST, ({ gameId }: { gameId: string }) => {
    socket.to(gameId).emit(EVENTS.SYNC_REQUEST)
  })
  socket.on(EVENTS.SYNC_STATE, ({ gameId, ...state }: { gameId: string; [key: string]: unknown }) => {
    socket.to(gameId).emit(EVENTS.SYNC_STATE, state)
  })

  // ── Chess-Matics simultaneous challenge ─────────────────────────────────────

  // Attacker emits this; server relays to opponent so both clients start the challenge
  socket.on(EVENTS.MATICS_START, ({ gameId, from, to, kind }: { gameId: string; from: string; to: string; kind: string }) => {
    activeMaticsChallenges.set(gameId, { resolved: false })
    socket.to(gameId).emit(EVENTS.MATICS_START, { from, to, kind })
  })

  // First correct MATICS_WIN wins; server sends MATICS_RESULT to both clients
  socket.on(EVENTS.MATICS_WIN, ({ gameId, role }: { gameId: string; role: 'attacker' | 'defender' }) => {
    const mc = activeMaticsChallenges.get(gameId)
    if (!mc || mc.resolved) return
    mc.resolved = true
    io.to(gameId).emit(EVENTS.MATICS_RESULT, { winner: role })
  })

  socket.on('disconnect', () => {
    // Clean up waiting rooms
    for (const [code, room] of privateRooms) {
      if (room.hostSocketId === socket.id) {
        privateRooms.delete(code)
        console.log(`[room] ${code} closed (host left)`)
      }
    }

    // Notify opponent in active game
    const gameId = socketToGame.get(socket.id)
    if (gameId) {
      const game = activeGames.get(gameId)
      if (game) {
        const player = game.players.find(p => p.socketId === socket.id)
        if (player) {
          player.socketId = null
          socket.to(gameId).emit(EVENTS.OPPONENT_DISCONNECTED)
          console.log(`[game] ${player.name} disconnected from ${gameId}`)
        }
        if (game.players.every(p => p.socketId === null)) {
          activeGames.delete(gameId)
          codeToGame.delete(game.code)
          console.log(`[game] ${gameId} closed`)
        }
      }
      socketToGame.delete(socket.id)
    }

    console.log(`[-] ${socket.id}`)
  })
})

http.listen(PORT, () => console.log(`server on :${PORT}`))
