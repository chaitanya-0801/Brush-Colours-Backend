import path from 'node:path'
import 'dotenv/config'

export const cities = ['Delhi', 'Kota', 'Bombay', 'Pune', 'Jaipur', 'Gujarat']

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: path.resolve(process.cwd(), process.env.DATABASE_PATH || './data/brush-colours.db'),
  jwtSecret: process.env.JWT_SECRET || 'change-this-development-secret',
  adminName: process.env.ADMIN_NAME || 'Garima',
  adminEmail: (process.env.ADMIN_EMAIL || 'admin@brushandcolours.in').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || 'Brush&Colours@2026!',
  frontendOrigins: (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  allowDemoPayments: process.env.ALLOW_DEMO_PAYMENTS === 'true',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
}
