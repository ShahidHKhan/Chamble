import { Router } from 'express'
import * as Users from '../models/users'
import { requireAuth } from '../middleware/auth'
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

router.get('/:id', async (req, res) => {
  try {
    const user = await Users.getById(req.params.id)
    const envelope: DataEnvelope<User> = { data: user, isSuccess: true }
    res.json(envelope)
  } catch {
    res.status(404).json({ data: null, isSuccess: false, message: 'User not found' })
  }
})

router.patch('/:id/elo', requireAuth, async (req, res) => {
  try {
    const updated = await Users.updateElo(req.params.id as string, Number(req.body.delta))
    res.json({ data: updated, isSuccess: true })
  } catch {
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to update ELO' })
  }
})

router.post('/:id/daily-reward', requireAuth, async (req, res) => {
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