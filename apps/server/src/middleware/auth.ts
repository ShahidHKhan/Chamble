import type { Request, Response, NextFunction } from 'express'
import { getSupabase } from '../lib/supabase'
import * as Users from '../models/users'

// Augment Express Request so req.userId / req.userEmail are typed everywhere
declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
    }
  }
}

// Runs on every request — attaches user if token present
export async function extractUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return next()

  const db = getSupabase()
  const { data, error } = await db.auth.getUser(token)

  if (error || !data.user) return next()

  req.userId    = data.user.id
  req.userEmail = data.user.email
  next()
}

// Guard for routes that require login
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({
      data: null,
      isSuccess: false,
      message: 'Authentication required',
    })
  }
  next()
}

// Guard for routes that require admin role
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res.status(401).json({ data: null, isSuccess: false, message: 'Authentication required' })
  }
  try {
    const user = await Users.getById(req.userId)
    if (user.role !== 'admin') {
      return res.status(403).json({ data: null, isSuccess: false, message: 'Admin access required' })
    }
    next()
  } catch {
    return res.status(403).json({ data: null, isSuccess: false, message: 'Admin access required' })
  }
}