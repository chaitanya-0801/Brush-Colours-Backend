import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from './auth.middleware.js'
import { login, logout, me, register, updatePassword } from './auth.controller.js'

import { resetPassword,resetPasswordToken } from './passwordReset.controller.js'

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false })
export const authRouter = Router()

authRouter.post('/register', limiter, register)
authRouter.post('/login', limiter, login)
authRouter.post('/logout', logout)
authRouter.get('/me', authenticate, me)
authRouter.post('/change-password', authenticate, updatePassword)
authRouter.post('/forgot-password', limiter, resetPasswordToken);
authRouter.post('/reset-password/:token', limiter, resetPassword);

