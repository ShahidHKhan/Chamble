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

export default router