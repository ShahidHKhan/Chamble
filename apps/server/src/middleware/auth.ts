import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import * as Users from '../models/users'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      userEmail?: string
    }
  }
}

// Runs on every request — attaches userId if a valid JWT is present
export function extractUser(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return next()

  try {
    const secret = process.env.JWT_SECRET
    if (!secret) return next()
    const payload = jwt.verify(token, secret) as { sub: string }
    req.userId = payload.sub
  } catch {
    // Invalid or expired token — just continue without a userId
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
