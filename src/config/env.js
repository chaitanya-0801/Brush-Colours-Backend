import 'dotenv/config'

const list = (value, fallback = '') => String(value || fallback).split(',').map((item) => item.trim()).filter(Boolean)
const integer = (value, fallback) => Number.isInteger(Number(value)) ? Number(value) : fallback

export const serviceCities = ['Delhi', 'Kota', 'Bombay', 'Pune', 'Jaipur', 'Gujarat']

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: integer(process.env.PORT, 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/brush-colours',
  jwtSecret: process.env.JWT_SECRET || 'local-only-change-this-secret',
  sessionDays: integer(process.env.SESSION_DAYS, 7),
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  frontendOrigins: list(process.env.FRONTEND_ORIGINS, 'http://localhost:5173,http://127.0.0.1:5173,https://gvrp534f-5173.inc1.devtunnels.ms'),
  adminName: process.env.ADMIN_NAME || 'Garima',
  adminEmail: String(process.env.ADMIN_EMAIL || 'admin@brushandcolours.in').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  depositAmount: integer(process.env.PREBOOK_AMOUNT, 299),
  allowDemoPayments: process.env.ALLOW_DEMO_PAYMENTS === 'true',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
})

export function validateProductionEnv() {
  if (env.nodeEnv !== 'production') return
  const missing = []
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI')
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push('JWT_SECRET (minimum 32 characters)')
  if (!env.frontendOrigins.length) missing.push('FRONTEND_ORIGINS')
  const anyRazorpayVariable = Boolean(env.razorpayKeyId || env.razorpayKeySecret || env.razorpayWebhookSecret)
  if (anyRazorpayVariable && !env.razorpayKeyId) missing.push('RAZORPAY_KEY_ID')
  if (anyRazorpayVariable && !env.razorpayKeySecret) missing.push('RAZORPAY_KEY_SECRET')
  if (anyRazorpayVariable && !env.razorpayWebhookSecret) missing.push('RAZORPAY_WEBHOOK_SECRET')
  if (missing.length) throw new Error(`Missing production configuration: ${missing.join(', ')}`)
}

export const paymentsConfigured = () => Boolean(env.razorpayKeyId && env.razorpayKeySecret)
export const uploadsConfigured = () => Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret)
