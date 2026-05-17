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

interface RoomEntry { hostSocketId: string; hostUsername: string }

const privateRooms = new Map<string, RoomEntry>()

function generateRoomCode(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase()
}

function startGame(p1Id: string, p1Name: string, p2Id: string, p2Name: string) {
  const gameId = `game_${Date.now()}`
  io.to(p1Id).emit(EVENTS.GAME_START, { gameId, color: 'w', opponent: p2Name })
  io.to(p2Id).emit(EVENTS.GAME_START, { gameId, color: 'b', opponent: p1Name })
  console.log(`[game] ${p1Name} vs ${p2Name} → ${gameId}`)
}

// ── Socket handlers ──────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`)

  // Private room: create
  socket.on(EVENTS.CREATE_ROOM, ({ username }: { username: string }) => {
    let code = generateRoomCode()
    while (privateRooms.has(code)) code = generateRoomCode()
    privateRooms.set(code, { hostSocketId: socket.id, hostUsername: username })
    socket.emit(EVENTS.ROOM_CREATED, { roomCode: code })
    console.log(`[room] ${username} created ${code}`)
  })

  // Private room: join
  socket.on(EVENTS.JOIN_ROOM, ({ username, roomCode }: { username: string; roomCode: string }) => {
    const room = privateRooms.get(roomCode.toUpperCase())
    if (!room) {
      socket.emit(EVENTS.ROOM_JOINED, { error: 'Room not found' })
      return
    }
    if (room.hostSocketId === socket.id) {
      socket.emit(EVENTS.ROOM_JOINED, { error: 'Cannot join your own room' })
      return
    }
    privateRooms.delete(roomCode.toUpperCase())
    socket.emit(EVENTS.ROOM_JOINED, {})
    startGame(room.hostSocketId, room.hostUsername, socket.id, username)
    console.log(`[room] ${username} joined ${roomCode}`)
  })

  socket.on('disconnect', () => {
    // Clean up rooms
    for (const [code, room] of privateRooms) {
      if (room.hostSocketId === socket.id) {
        privateRooms.delete(code)
        console.log(`[room] ${code} closed (host left)`)
      }
    }
    console.log(`[-] ${socket.id}`)
  })
})

http.listen(PORT, () => console.log(`server on :${PORT}`))
