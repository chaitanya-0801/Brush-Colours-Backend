import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'
import { badRequest, conflict, unauthorized } from '../../common/errors/AppError.js'
import { User } from './user.model.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const cookieName = 'bc_session'

export const publicUser = (user) => ({
  id: user._id.toString(), name: user.name, email: user.email, role: user.role, createdAt: user.createdAt,
})

export async function registerUser(input) {
  const name = String(input.name || '').trim()
  const email = String(input.email || '').trim().toLowerCase()
  const password = String(input.password || '')
  if (name.length < 2) throw badRequest('Please enter your full name.', 'INVALID_NAME')
  if (!emailPattern.test(email)) throw badRequest('Please enter a valid email address.', 'INVALID_EMAIL')
  if (password.length < 8) throw badRequest('Password must contain at least 8 characters.', 'WEAK_PASSWORD')
  if (await User.exists({ email })) throw conflict('An account already exists with this email.', 'EMAIL_EXISTS')
  return User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: 'user' })
}

export async function verifyCredentials(emailValue, passwordValue) {
  const email = String(emailValue || '').trim().toLowerCase()
  const user = await User.findOne({ email, active: true }).select('+passwordHash')
  if (!user || !await bcrypt.compare(String(passwordValue || ''), user.passwordHash)) {
    throw unauthorized('Incorrect email or password.')
  }
  return user
}

export function signSession(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, { expiresIn: `${env.sessionDays}d` })
}

export function setSessionCookie(res, token) {
  res.cookie(cookieName, token, {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.nodeEnv === 'production',
    maxAge: env.sessionDays * 24 * 60 * 60 * 1000,
    path: '/',
  })
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName, {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.nodeEnv === 'production',
    path: '/',
  })
}

export async function changePassword(userId, currentPassword, newPassword) {
  if (String(newPassword || '').length < 8) throw badRequest('New password must contain at least 8 characters.', 'WEAK_PASSWORD')
  const user = await User.findById(userId).select('+passwordHash')
  if (!user || !await bcrypt.compare(String(currentPassword || ''), user.passwordHash)) {
    throw badRequest('Current password is incorrect.', 'INCORRECT_PASSWORD')
  }
  user.passwordHash = await bcrypt.hash(newPassword, 12)
  user.passwordChangedAt = new Date()
  await user.save()
}

export async function ensureAdmin() {
  if (!env.adminPassword) {
    if (env.nodeEnv !== 'test') console.warn('ADMIN_PASSWORD is not set; automatic admin creation skipped.')
    return null
  }
  const existing = await User.findOne({ email: env.adminEmail })
  if (existing) return existing
  return User.create({
    name: env.adminName,
    email: env.adminEmail,
    passwordHash: await bcrypt.hash(env.adminPassword, 12),
    role: 'admin',
  })
}
