import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import * as Users from '../models/users'
import * as ResetTokens from '../models/resetTokens'
import { sendPasswordResetEmail } from '../lib/email'
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
  const { username, displayName, email, password } = req.body as {
    username: string
    displayName: string
    email: string
    password: string
  }

  if (!username || !displayName || !email || !password) {
    res.status(400).json({ data: null, isSuccess: false, message: 'All fields are required' })
    return
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Invalid email address' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Password must be at least 8 characters' })
    return
  }

  const [existingUsername, existingEmail] = await Promise.all([
    Users.getByUsername(username).catch(() => null),
    Users.getByEmail(email).catch(() => null),
  ])

  if (existingUsername) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Username already taken' })
    return
  }
  if (existingEmail) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Email already registered' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await Users.create(
      { username, displayName, email, elo: 1200, wins: 0, losses: 0, draws: 0, role: 'user' },
      passwordHash,
    )
    const token = jwt.sign({ sub: user.id, role: user.role }, getJwtSecret(), { expiresIn: '7d' })
    const envelope: DataEnvelope<{ user: User; token: string }> = {
      data: { user, token },
      isSuccess: true,
    }
    res.status(201).json(envelope)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : (err as any)?.message ?? 'Failed to create user'
    console.error('[register]', err)
    res.status(500).json({ data: null, isSuccess: false, message })
  }
})

// POST /api/auth/login  (accepts username or email)
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username: string; password: string }

  if (!username || !password) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Credentials are required' })
    return
  }

  const profile = await Users.getByUsernameOrEmail(username).catch(() => null)
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

// POST /api/auth/forgot-password
// Always returns 200 to prevent email enumeration attacks.
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body as { email: string }

  if (!email) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Email is required' })
    return
  }

  try {
    const user = await Users.getByEmail(email).catch(() => null)
    if (user) {
      const code = await ResetTokens.createToken(user.id)
      await sendPasswordResetEmail(user.email, code)
    }
  } catch (err) {
    console.error('[forgot-password]', err)
  }

  // Always return success — never reveal whether the email exists
  res.json({ data: null, isSuccess: true, message: 'If that email is registered, a reset code has been sent.' })
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body as {
    email: string
    code: string
    newPassword: string
  }

  if (!email || !code || !newPassword) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Email, code, and new password are required' })
    return
  }

  if (newPassword.length < 8) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Password must be at least 8 characters' })
    return
  }

  // Look up user first, then validate the token belongs to that user
  const user = await Users.getByEmail(email).catch(() => null)
  if (!user) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Invalid or expired code' })
    return
  }

  const userId = await ResetTokens.consumeToken(code)
  if (!userId || userId !== user.id) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Invalid or expired code' })
    return
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await Users.setPasswordHash(userId, passwordHash)
    res.json({ data: null, isSuccess: true, message: 'Password reset successfully' })
  } catch {
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to reset password' })
  }
})

export default router
