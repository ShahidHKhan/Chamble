import { Router } from 'express'
import { getSupabase } from '../lib/supabase'
import * as Users from '../models/users'
import { requireAuth } from '../middleware/auth'
import type { DataEnvelope, User } from '@chess/shared'

const router = Router()

// POST /api/auth/register
// Creates a Supabase Auth user + a matching row in the users table.
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

  const db = getSupabase()

  // 1. Create the Supabase Auth account
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    res.status(400).json({ data: null, isSuccess: false, message: authError?.message ?? 'Registration failed' })
    return
  }

  try {
    // 2. Create the matching public users row (same id as the Auth user)
    const user = await Users.create({ username, displayName, elo: 1200, wins: 0, losses: 0, draws: 0, role: 'user' })
    const envelope: DataEnvelope<User> = { data: user, isSuccess: true }
    res.status(201).json(envelope)
  } catch (err: unknown) {
    // Roll back the Auth user if the DB insert fails
    await db.auth.admin.deleteUser(authData.user.id)
    const message = err instanceof Error ? err.message : 'Failed to create user profile'
    res.status(500).json({ data: null, isSuccess: false, message })
  }
})

// POST /api/auth/login
// Accepts { username, password }. Looks up the Supabase Auth email for that
// username internally so callers never need to know the email address.
router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username: string; password: string }

  if (!username || !password) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Username and password are required' })
    return
  }

  const db = getSupabase()

  // Step 1: find the profile row so we have the user's UUID
  const profile = await Users.getByUsername(username).catch(() => null)
  if (!profile) {
    res.status(401).json({ data: null, isSuccess: false, message: 'Invalid credentials' })
    return
  }

  // Step 2: look up their email in Supabase Auth using the same UUID
  const { data: authData } = await db.auth.admin.getUserById(profile.id)
  const email = authData.user?.email
  if (!email) {
    res.status(401).json({ data: null, isSuccess: false, message: 'Invalid credentials' })
    return
  }

  // Step 3: sign in with the real email + password
  const { data, error } = await db.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    res.status(401).json({ data: null, isSuccess: false, message: 'Invalid credentials' })
    return
  }

  res.json({
    data: { user: profile, token: data.session.access_token },
    isSuccess: true,
  })
})

// POST /api/auth/logout  (requires login)
router.post('/logout', requireAuth, async (req, res) => {
  const db = getSupabase()
  const token = req.headers.authorization?.replace('Bearer ', '') ?? ''
  await db.auth.admin.signOut(token)
  res.json({ data: null, isSuccess: true, message: 'Logged out' })
})

// GET /api/auth/me  — returns the current user's profile (requires login)
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
