import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { AppError } from './common/errors/AppError.js'
import { errorHandler, notFoundHandler } from './common/middleware/errors.js'
import { databaseHealth } from './config/database.js'
import { env, paymentsConfigured, serviceCities, uploadsConfigured } from './config/env.js'
import { adminRouter } from './modules/admin/admin.routes.js'
import { activityRouter, adminActivityRouter } from './modules/activities/activity.routes.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { bookingRouter } from './modules/bookings/booking.routes.js'
import { favoriteRouter } from './modules/favorites/favorite.routes.js'
import { razorpayWebhook } from './modules/payments/payment.controller.js'
import { paymentRouter } from './modules/payments/payment.routes.js'
import { uploadRouter } from './modules/uploads/upload.routes.js'

export function createApp() {
  const app = express()
  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(helmet({ crossOriginResourcePolicy: false }))
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || env.frontendOrigins.includes(origin)) return callback(null, true)
      return callback(new AppError(403, 'This website is not allowed to access the API.', 'CORS_ORIGIN_DENIED'))
    },
  }))

  app.post('/api/payments/webhook/razorpay', express.raw({ type: 'application/json', limit: '1mb' }), razorpayWebhook)
  app.use(express.json({ limit: '250kb' }))
  app.use(cookieParser())
  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.nodeEnv === 'test' ? 10_000 : 500,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'Too many requests. Please wait a few minutes and try again.', code: 'RATE_LIMITED' }),
  }))
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  app.get('/api/health', (_req, res) => {
    const database = databaseHealth()
    res.status(database.connected ? 200 : 503).json({
      ok: database.connected,
      service: 'Brush&Colours API',
      database: database.connected ? 'mongodb-connected' : 'mongodb-disconnected',
    })
  })
  app.get('/api/config', (_req, res) => res.json({
    cities: serviceCities,
    depositAmount: env.depositAmount,
    cancellationPolicy: `The Rs ${env.depositAmount} pre-booking amount is non-refundable and is credited toward the final balance when the event is completed.`,
    paymentsConfigured: paymentsConfigured(),
    demoPayments: env.allowDemoPayments,
    uploadsConfigured: uploadsConfigured(),
  }))

  app.use('/api/auth', authRouter)
  app.use('/api/activities', activityRouter)
  app.use('/api/bookings', bookingRouter)
  app.use('/api/favorites', favoriteRouter)
  app.use('/api/payments', paymentRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/admin/activities', adminActivityRouter)
  app.use('/api/admin/uploads', uploadRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
