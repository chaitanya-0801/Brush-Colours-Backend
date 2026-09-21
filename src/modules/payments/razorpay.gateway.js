import { createHmac, timingSafeEqual } from 'node:crypto'
import { AppError } from '../../common/errors/AppError.js'
import { env, paymentsConfigured } from '../../config/env.js'

const authHeader = () => `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')}`

async function razorpayRequest(path, body) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new AppError(502, data.error?.description || 'The payment provider could not complete the request.', 'PAYMENT_PROVIDER_ERROR')
  return data
}

export async function createProviderOrder({ amount, receipt, notes }) {
  if (!paymentsConfigured()) return null
  return razorpayRequest('/orders', { amount: amount * 100, currency: 'INR', receipt, notes })
}

export function verifyCheckoutSignature(orderId, paymentId, signature) {
  const expected = createHmac('sha256', env.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(String(signature || ''))
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}

export function verifyWebhookSignature(rawBody, signature) {
  if (!env.razorpayWebhookSecret) return false
  const expected = createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(String(signature || ''))
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
}
