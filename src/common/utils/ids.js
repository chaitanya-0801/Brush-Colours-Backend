import { randomBytes } from 'node:crypto'

export const bookingReference = () => `BC-${randomBytes(4).toString('hex').toUpperCase()}`
export const paymentReference = () => `PAY-${randomBytes(6).toString('hex').toUpperCase()}`
export const cashReference = () => `CASH-${randomBytes(6).toString('hex').toUpperCase()}`

export function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}
