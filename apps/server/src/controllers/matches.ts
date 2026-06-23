// apps/server/src/controllers/matches.ts
//
// GET    /api/v1/matches            — all matches (admin/leaderboard)
// GET    /api/v1/matches/user/:id   — matches for a specific user
// GET    /api/v1/matches/stats/:id  — win rate + per-variant stats
// GET    /api/v1/matches/:id        — one match by ID
// POST   /api/v1/matches            — record a completed game
// DELETE /api/v1/matches/:id        — delete a match (admin only)

import { Router } from 'express'
import * as Matches from '../models/matches'
import * as Users from '../models/users'
import { requireAuth, requireAdmin } from '../middleware/auth'
import type { DataEnvelope, DataListEnvelope, MatchRecord } from '@chess/shared'

const router = Router()

// All matches — public (for global leaderboard / recent games feed)
router.get('/', async (req, res) => {
  try {
    const { list, count } = await Matches.getAll(req.query as any)
    const envelope: DataListEnvelope<MatchRecord> = {
      data: list,
      isSuccess: true,
      total: count,
    }
    res.json(envelope)
  } catch (err) {
    console.error('[matches/getAll]', err)
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to load matches' })
  }
})

// Matches for a specific user — this is what ProfilePage calls
router.get('/user/:userId', async (req, res) => {
  try {
    const { list, count } = await Matches.getByUserId(
      req.params.userId,
      req.query as any
    )
    const envelope: DataListEnvelope<MatchRecord> = {
      data: list,
      isSuccess: true,
      total: count,
    }
    res.json(envelope)
  } catch (err) {
    console.error('[matches/getByUser]', err)
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to load matches' })
  }
})

// Per-user stats — total games, win rate, breakdown by variant
router.get('/stats/:userId', async (req, res) => {
  try {
    const stats = await Matches.getStats(req.params.userId)
    res.json({ data: stats, isSuccess: true })
  } catch (err) {
    console.error('[matches/stats]', err)
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to load stats' })
  }
})

// One match by ID
router.get('/:id', async (req, res) => {
  try {
    const match = await Matches.getById(req.params.id)
    const envelope: DataEnvelope<MatchRecord> = { data: match, isSuccess: true }
    res.json(envelope)
  } catch {
    res.status(404).json({ data: null, isSuccess: false, message: 'Match not found' })
  }
})

// Record a completed game — requires login.
// Called when a game ends. The body should include:
//   { userId, opponentName, result, color, moves, gameVariant }
router.post('/', requireAuth, async (req, res) => {
  const { userId, opponentName, result, color, moves, gameVariant } = req.body

  if (!userId || !opponentName || !result || !color) {
    res.status(400).json({
      data: null,
      isSuccess: false,
      message: 'userId, opponentName, result, and color are required',
    })
    return
  }

  try {
    const match = await Matches.create({
      userId,
      opponentName,
      result,
      color,
      moves: moves ?? 0,
      gameVariant: gameVariant ?? 'chess21',
    })

    const stat = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws'
    await Users.incrementMatchStat(userId, stat)

    res.status(201).json({ data: match, isSuccess: true })
  } catch (err) {
    console.error('[matches/create]', err)
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to record match' })
  }
})

// Delete — admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const removed = await Matches.remove(req.params.id as string)
    res.json({ data: removed, isSuccess: true, message: 'Match deleted' })
  } catch {
    res.status(404).json({ data: null, isSuccess: false, message: 'Match not found' })
  }
})

export default router