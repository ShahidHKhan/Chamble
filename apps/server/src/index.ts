import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import 'dotenv/config'

const app    = express()
const http   = createServer(app)
const io     = new Server(http, { cors: { origin: '*' } })
const PORT   = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/health', (_, res) => res.json({ ok: true }))

io.on('connection', (socket) => {
  console.log('client connected:', socket.id)
  socket.on('disconnect', () => console.log('client left:', socket.id))
})

http.listen(PORT, () => console.log(`server running on ${PORT}`))
