import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { changePassword, clearSessionCookie, publicUser, registerUser, setSessionCookie, signSession, verifyCredentials } from './auth.service.js'
import { User } from './user.model.js'

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body)
  setSessionCookie(res, signSession(user))
  res.status(201).json({ user: publicUser(user) })
})

export const login = asyncHandler(async (req, res) => {
  const user = await verifyCredentials(req.body.email, req.body.password)
  setSessionCookie(res, signSession(user))
  res.json({ user: publicUser(user) })
})

export const logout = (_req, res) => {
  clearSessionCookie(res)
  res.json({ ok: true })
}

export const me = (req, res) => res.json({ user: req.user })

export const updatePassword = asyncHandler(async (req, res) => {
  await changePassword(req.user.id, req.body.currentPassword, req.body.newPassword)
  clearSessionCookie(res)
  res.json({ ok: true, message: 'Password changed. Please sign in again.' })
})

export const revokeUserSessions = async (userId) => {
  await User.findByIdAndUpdate(userId, { passwordChangedAt: new Date() })
}
