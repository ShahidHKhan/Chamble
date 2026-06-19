import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as Users from '../models/users'
import { requireAuth } from '../middleware/auth'
import type { DataEnvelope, User } from '@chess/shared'

const router = Router()

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Missing JWT_SECRET in server .env')
  return secret
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, displayName, email: _email, password } = req.body as {
    username: string
    displayName: string
    email?: string
    password: string
  }

  if (!username || !displayName || !password) {
    res.status(400).json({ data: null, isSuccess: false, message: 'All fields are required' })
    return
  }

  const existing = await Users.getByUsername(username).catch(() => null)
  if (existing) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Username already taken' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await Users.create(
      { username, displayName, elo: 1200, wins: 0, losses: 0, draws: 0, role: 'user' },
      passwordHash,
    )
    const token = jwt.sign({ sub: user.id, role: user.role }, getJwtSecret(), { expiresIn: '7d' })
    const envelope: DataEnvelope<{ user: User; token: string }> = {
      data: { user, token },
      isSuccess: true,
    }
    res.status(201).json(envelope)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create user'
    res.status(500).json({ data: null, isSuccess: false, message })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username: string; password: string }

  if (!username || !password) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Username and password are required' })
    return
  }

  const profile = await Users.getByUsername(username).catch(() => null)
  if (!profile) {
    res.status(401).json({ data: null, isSuccess: false, message: 'Invalid credentials' })
    return
  }

  const hash = await Users.getPasswordHash(profile.id).catch(() => null)
  if (!hash) {
    res.status(401).json({ data: null, isSuccess: false, message: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, hash)
  if (!valid) {
    res.status(401).json({ data: null, isSuccess: false, message: 'Invalid credentials' })
    return
  }

  const token = jwt.sign({ sub: profile.id, role: profile.role }, getJwtSecret(), { expiresIn: '7d' })
  res.json({ data: { user: profile, token }, isSuccess: true })
})

// POST /api/auth/logout
router.post('/logout', requireAuth, (_req, res) => {
  res.json({ data: null, isSuccess: true, message: 'Logged out' })
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await Users.getById((req as any).userId)
    const envelope: DataEnvelope<User> = { data: user, isSuccess: true }
    res.json(envelope)
  } catch {
    res.status(404).json({ data: null, isSuccess: false, message: 'User not found' })
  }
})

export default router
