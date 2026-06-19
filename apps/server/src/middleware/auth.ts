import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import * as Users from '../models/users'

// Augment Express Request so req.userId / req.userEmail are typed everywhere
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

// Runs on every request — attaches user if token present
export function extractUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return next()

  const secret = process.env.JWT_SECRET
  if (!secret) return next()

  try {
    const decoded = jwt.verify(token, secret) as { sub: string }
    req.userId = decoded.sub
  } catch {
    // invalid or expired token — proceed without user
  }
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