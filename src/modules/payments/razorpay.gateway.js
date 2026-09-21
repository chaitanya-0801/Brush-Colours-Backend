import { createHmac, timingSafeEqual } from 'node:crypto'
import { AppError } from '../../common/errors/AppError.js'
import { env, paymentsConfigured } from '../../config/env.js'

const authHeader = () => `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')}`

async function razorpayRequest(path, { method = 'GET', body } = {}) {
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method,
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new AppError(502, data.error?.description || 'The payment provider could not complete the request.', 'PAYMENT_PROVIDER_ERROR')
  return data
}

export async function createProviderOrder({ amount, receipt, notes }) {
  if (!paymentsConfigured()) return null
  return razorpayRequest('/orders', {
    method: 'POST',
    body: { amount: amount * 100, currency: 'INR', receipt, notes },
  })
}

export async function fetchProviderPayment(paymentId) {
  if (!paymentsConfigured()) return null
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}`)
}

export async function captureAuthorizedProviderPayment(paymentId, amount) {
  if (!paymentsConfigured()) return null
  return razorpayRequest(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: 'POST',
    body: { amount: amount * 100, currency: 'INR' },
  })
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
