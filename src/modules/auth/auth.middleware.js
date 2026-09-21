import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'
import { forbidden, unauthorized } from '../../common/errors/AppError.js'
import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { User } from './user.model.js'
import { cookieName } from './auth.service.js'

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[cookieName]
  if (!token) throw unauthorized()
  let payload
  try {
    payload = jwt.verify(token, env.jwtSecret)
  } catch {
    throw unauthorized('Your session has expired. Please sign in again.')
  }
  const user = await User.findById(payload.sub)
  if (!user?.active) throw unauthorized('Your session is no longer valid.')
  if (user.passwordChangedAt && Number(payload.iat) * 1000 < user.passwordChangedAt.getTime()) {
    throw unauthorized('Your password changed. Please sign in again.')
  }
  req.user = publicAuthUser(user)
  next()
})

const publicAuthUser = (user) => ({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt })

export const requireAdmin = (req, _res, next) => {
  if (req.user?.role !== 'admin') return next(forbidden('Administrator access required.'))
  next()
}

export const requireCustomer = (req, _res, next) => {
  if (req.user?.role === 'admin') return next(forbidden('Administrator accounts cannot create or pay for event bookings.'))
  next()
}
