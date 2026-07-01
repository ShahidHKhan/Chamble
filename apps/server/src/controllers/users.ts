import { Router } from 'express'
import * as Users from '../models/users'
import { requireAuth } from '../middleware/auth'
import { validateUsername } from '../lib/validation'
import type { DataEnvelope, DataListEnvelope, User } from '@chess/shared'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const { list, count } = await Users.getAll(req.query as any)
    const envelope: DataListEnvelope<User> = {
      data: list,
      isSuccess: true,
      total: count,
    }
    res.json(envelope)
  } catch {
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to load users' })
  }
})

router.get('/by-username/:username', async (req, res) => {
  try {
    const user = await Users.getByUsername(req.params.username)
    if (!user) {
      res.status(404).json({ data: null, isSuccess: false, message: 'User not found' })
      return
    }
    res.json({ data: user, isSuccess: true })
  } catch {
    res.status(404).json({ data: null, isSuccess: false, message: 'User not found' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const user = await Users.getById(req.params.id)
    const envelope: DataEnvelope<User> = { data: user, isSuccess: true }
    res.json(envelope)
  } catch {
    res.status(404).json({ data: null, isSuccess: false, message: 'User not found' })
  }
})

router.patch('/:id/username', requireAuth, async (req, res) => {
  if (req.userId !== req.params.id) {
    res.status(403).json({ data: null, isSuccess: false, message: 'Forbidden' })
    return
  }

  const { username } = req.body as { username: string }
  if (!username) {
    res.status(400).json({ data: null, isSuccess: false, message: 'Username is required' })
    return
  }

  const usernameError = validateUsername(username)
  if (usernameError) {
    res.status(400).json({ data: null, isSuccess: false, message: usernameError })
    return
  }

  try {
    const existing = await Users.getByUsername(username)
    if (existing && existing.id !== req.params.id) {
      res.status(400).json({ data: null, isSuccess: false, message: 'Username already taken' })
      return
    }
    const updated = await Users.update(req.params.id as string, { username })
    res.json({ data: updated, isSuccess: true })
  } catch {
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to update username' })
  }
})

router.patch('/:id/elo', requireAuth, async (req, res) => {
  if (req.userId !== req.params.id) {
    res.status(403).json({ data: null, isSuccess: false, message: 'Forbidden' })
    return
  }
  try {
    const updated = await Users.updateElo(req.params.id as string, Number(req.body.delta))
    res.json({ data: updated, isSuccess: true })
  } catch {
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to update ELO' })
  }
})

router.post('/:id/daily-reward', requireAuth, async (req, res) => {
  if (req.userId !== req.params.id) {
    res.status(403).json({ data: null, isSuccess: false, message: 'Forbidden' })
    return
  }
  try {
    const { user, alreadyClaimed } = await Users.claimDailyReward(req.params.id as string)
    if (alreadyClaimed) {
      res.status(400).json({ data: user, isSuccess: false, message: 'Already claimed today' })
      return
    }
    res.json({ data: user, isSuccess: true, message: '+200 ELO claimed!' })
  } catch {
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to claim reward' })
  }
})

export default router