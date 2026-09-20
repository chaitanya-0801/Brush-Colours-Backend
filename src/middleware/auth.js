import jwt from 'jsonwebtoken'
import { config } from '../config.js'

export const cookieName = 'bc_session'

export function signSession(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' })
}

export function setSessionCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
    path: '/',
  })
}

export function authenticate(db) {
  return (req, res, next) => {
    try {
      const token = req.cookies[cookieName]
      if (!token) return res.status(401).json({ error: 'Please sign in to continue.' })
      const payload = jwt.verify(token, config.jwtSecret)
      const user = db.prepare('SELECT id, name, email, role, created_at AS createdAt FROM users WHERE id = ?').get(payload.sub)
      if (!user) return res.status(401).json({ error: 'Your session is no longer valid.' })
      req.user = user
      next()
    } catch {
      return res.status(401).json({ error: 'Your session has expired. Please sign in again.' })
    }
  }
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' })
  next()
}
