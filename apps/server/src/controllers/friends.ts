// apps/server/src/controllers/friends.ts
//
// GET    /api/v1/friends              — your accepted friends list
// GET    /api/v1/friends/requests     — pending requests sent TO you
// POST   /api/v1/friends/request      — send a friend request
// POST   /api/v1/friends/accept/:id   — accept a pending request
// DELETE /api/v1/friends/:friendId    — unfriend someone
//
// All routes require login since friendships are user-specific.

import { Router } from 'express'
import * as Friends from '../models/friends'
import { requireAuth } from '../middleware/auth'

const router = Router()

// All routes require authentication
router.use(requireAuth)

// Get your friends list (accepted friendships only)
router.get('/', async (req, res) => {
  try {
    const friends = await Friends.getFriendProfiles(req.userId!)
    res.json({ data: friends, isSuccess: true, total: friends.length })
  } catch (err) {
    console.error('[friends/list]', err)
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to load friends' })
  }
})

// Get pending friend requests sent TO you
router.get('/requests', async (req, res) => {
  try {
    const requests = await Friends.getPendingRequests(req.userId!)
    res.json({ data: requests, isSuccess: true, total: requests.length })
  } catch (err) {
    console.error('[friends/requests]', err)
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to load requests' })
  }
})

// Send a friend request — body: { friendId: string }
router.post('/request', async (req, res) => {
  const { friendId } = req.body

  if (!friendId) {
    res.status(400).json({
      data: null,
      isSuccess: false,
      message: 'friendId is required',
    })
    return
  }

  try {
    const friendship = await Friends.sendRequest(req.userId!, friendId)
    res.status(201).json({ data: friendship, isSuccess: true })
  } catch (err: any) {
    // sendRequest throws descriptive errors (already friends, can't friend yourself, etc.)
    res.status(400).json({
      data: null,
      isSuccess: false,
      message: err.message ?? 'Failed to send friend request',
    })
  }
})

// Accept a pending friend request — :id is the friendship row ID
router.post('/accept/:id', async (req, res) => {
  try {
    const friendship = await Friends.acceptRequest(req.params.id, req.userId!)
    res.json({ data: friendship, isSuccess: true })
  } catch (err: any) {
    res.status(400).json({
      data: null,
      isSuccess: false,
      message: err.message ?? 'Failed to accept request',
    })
  }
})

// Unfriend someone — :friendId is the OTHER user's ID
router.delete('/:friendId', async (req, res) => {
  try {
    await Friends.unfriend(req.userId!, req.params.friendId)
    res.json({ data: null, isSuccess: true, message: 'Unfriended' })
  } catch (err) {
    console.error('[friends/unfriend]', err)
    res.status(500).json({ data: null, isSuccess: false, message: 'Failed to unfriend' })
  }
})

export default router