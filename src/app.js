import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { cities, config } from './config.js'
import { authenticate, clearSessionCookie, requireAdmin, setSessionCookie, signSession } from './middleware/auth.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[+\d][\d\s-]{7,17}$/

const publicUser = (user) => ({ id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt || user.created_at })

const bookingSelect = `
  SELECT b.id, b.activity_id AS activityId, a.title AS activityTitle, a.category,
    b.event_date AS eventDate, b.event_time AS eventTime, b.guests, b.city,
    b.venue_address AS venueAddress, b.contact_phone AS contactPhone, b.amount,
    b.deposit_amount AS depositAmount, b.amount_paid AS amountPaid,
    CASE WHEN b.amount IS NULL THEN NULL ELSE MAX(b.amount - b.amount_paid, 0) END AS balanceAmount,
    b.status, b.payment_status AS paymentStatus, b.payment_provider AS paymentProvider,
    b.created_at AS createdAt, u.name AS customerName, u.email AS customerEmail
  FROM bookings b
  JOIN activities a ON a.id = b.activity_id
  JOIN users u ON u.id = b.user_id
`

const isoToday = () => {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function earliestAllowedDate(minLeadDays) {
  const date = new Date(`${isoToday()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + Math.max(1, minLeadDays))
  return date.toISOString().slice(0, 10)
}

export function createApp(db) {
  const app = express()
  app.set('trust proxy', 1)
  app.use(helmet({ crossOriginResourcePolicy: false }))
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || config.frontendOrigins.includes(origin)) return callback(null, true)
      return callback(new Error('Origin is not allowed by CORS'))
    },
  }))
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  const authRequired = authenticate(db)
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false })

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'Brush&Colours API' }))
  app.get('/api/config', (_req, res) => res.json({ cities, paymentsConfigured: Boolean(config.razorpayKeyId && config.razorpayKeySecret), demoPayments: config.allowDemoPayments }))

  app.post('/api/auth/register', authLimiter, (req, res) => {
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    if (name.length < 2) return res.status(400).json({ error: 'Please enter your full name.' })
    if (!emailPattern.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' })
    if (password.length < 8) return res.status(400).json({ error: 'Password must contain at least 8 characters.' })
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'An account already exists with this email.' })

    const user = { id: randomUUID(), name, email, role: 'user' }
    db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, name, email, bcrypt.hashSync(password, 12), user.role)
    setSessionCookie(res, signSession(user))
    return res.status(201).json({ user: publicUser(user) })
  })

  app.post('/api/auth/login', authLimiter, (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user || !bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Incorrect email or password.' })
    setSessionCookie(res, signSession(user))
    return res.json({ user: publicUser(user) })
  })

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res)
    res.json({ ok: true })
  })

  app.get('/api/auth/me', authRequired, (req, res) => res.json({ user: req.user }))

  app.post('/api/auth/change-password', authRequired, (req, res) => {
    const currentPassword = String(req.body.currentPassword || '')
    const newPassword = String(req.body.newPassword || '')
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must contain at least 8 characters.' })
    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id)
    if (!bcrypt.compareSync(currentPassword, user.password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' })
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 12), req.user.id)
    clearSessionCookie(res)
    res.json({ ok: true, message: 'Password changed. Please sign in again.' })
  })

  app.get('/api/activities', (_req, res) => {
    const activities = db.prepare(`
      SELECT id, title, category, price, price_unit AS priceUnit, min_lead_days AS minLeadDays, active
      FROM activities WHERE active = 1 ORDER BY rowid
    `).all().map((activity) => ({ ...activity, active: Boolean(activity.active) }))
    res.json({ activities })
  })

  app.get('/api/bookings/mine', authRequired, (req, res) => {
    const bookings = db.prepare(`${bookingSelect} WHERE b.user_id = ? ORDER BY b.created_at DESC`).all(req.user.id)
    res.json({ bookings })
  })

  app.post('/api/bookings', authRequired, (req, res) => {
    const activityId = String(req.body.activityId || '')
    const eventDate = String(req.body.eventDate || '')
    const eventTime = String(req.body.eventTime || '').trim()
    const city = String(req.body.city || '').trim()
    const venueAddress = String(req.body.venueAddress || '').trim()
    const contactPhone = String(req.body.contactPhone || '').trim()
    const guests = Number(req.body.guests)
    const activity = db.prepare('SELECT * FROM activities WHERE id = ? AND active = 1').get(activityId)

    if (!activity) return res.status(404).json({ error: 'This activity is not available.' })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate < earliestAllowedDate(activity.min_lead_days)) {
      return res.status(400).json({ error: `Please choose ${earliestAllowedDate(activity.min_lead_days)} or a later date. Same-day bookings are not available.` })
    }
    if (!eventTime) return res.status(400).json({ error: 'Please select a time.' })
    if (!Number.isInteger(guests) || guests < 1 || guests > 1000) return res.status(400).json({ error: 'Please enter a valid guest count.' })
    if (!cities.includes(city)) return res.status(400).json({ error: 'Please select one of our service cities.' })
    if (venueAddress.length < 8) return res.status(400).json({ error: 'Please enter the complete venue address.' })
    if (!phonePattern.test(contactPhone)) return res.status(400).json({ error: 'Please enter a valid contact number.' })

    const booking = {
      id: `BC-${randomUUID().slice(0, 8).toUpperCase()}`,
      userId: req.user.id,
      activityId,
      eventDate,
      eventTime,
      guests,
      city,
      venueAddress,
      contactPhone,
      amount: activity.price,
      status: activity.price == null ? 'quote_requested' : 'payment_pending',
      paymentStatus: 'pending',
    }
    db.prepare(`
      INSERT INTO bookings (
        id, user_id, activity_id, event_date, event_time, guests, city, venue_address,
        contact_phone, amount, status, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      booking.id, booking.userId, booking.activityId, booking.eventDate, booking.eventTime,
      booking.guests, booking.city, booking.venueAddress, booking.contactPhone,
      booking.amount, booking.status, booking.paymentStatus,
    )
    res.status(201).json({ booking: db.prepare(`${bookingSelect} WHERE b.id = ?`).get(booking.id) })
  })

  app.post('/api/payments/create-order', authRequired, async (req, res, next) => {
    try {
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(String(req.body.bookingId || ''), req.user.id)
      const paymentKind = req.body.paymentKind === 'balance' ? 'balance' : 'deposit'
      if (!booking) return res.status(404).json({ error: 'Booking not found.' })
      if (booking.status === 'cancelled') return res.status(409).json({ error: 'This booking has been cancelled.' })
      if (booking.payment_status === 'paid') return res.status(409).json({ error: 'This booking has already been paid.' })

      const depositAmount = Math.min(booking.deposit_amount, booking.amount ?? booking.deposit_amount)
      let paymentAmount
      if (paymentKind === 'deposit') {
        if (booking.amount_paid >= depositAmount) return res.status(409).json({ error: 'The pre-booking amount has already been paid.' })
        paymentAmount = depositAmount - booking.amount_paid
      } else {
        if (booking.amount == null) return res.status(400).json({ error: 'The owner must confirm the final price before the balance can be paid online.' })
        if (booking.amount_paid < depositAmount) return res.status(409).json({ error: 'Please pay the pre-booking amount first.' })
        paymentAmount = booking.amount - booking.amount_paid
        if (paymentAmount <= 0) return res.status(409).json({ error: 'This booking has no remaining balance.' })
      }

      if (config.razorpayKeyId && config.razorpayKeySecret) {
        const response = await fetch('https://api.razorpay.com/v1/orders', {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${config.razorpayKeyId}:${config.razorpayKeySecret}`).toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ amount: paymentAmount * 100, currency: 'INR', receipt: `${booking.id}-${paymentKind}` }),
        })
        const order = await response.json()
        if (!response.ok) return res.status(502).json({ error: order.error?.description || 'Could not create the payment order.' })
        db.prepare(`UPDATE bookings SET payment_provider = 'razorpay', payment_order_id = ?, payment_order_amount = ?, payment_order_kind = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(order.id, paymentAmount, paymentKind, booking.id)
        return res.json({ provider: 'razorpay', keyId: config.razorpayKeyId, orderId: order.id, amount: paymentAmount * 100, currency: 'INR', paymentKind })
      }

      if (!config.allowDemoPayments) return res.status(503).json({ error: 'Online payments are not configured yet. Please contact the owner.' })
      const orderId = `demo_order_${randomUUID().replaceAll('-', '')}`
      db.prepare(`UPDATE bookings SET payment_provider = 'development', payment_order_id = ?, payment_order_amount = ?, payment_order_kind = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(orderId, paymentAmount, paymentKind, booking.id)
      return res.json({ provider: 'development', orderId, amount: paymentAmount * 100, currency: 'INR', paymentKind })
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/payments/verify', authRequired, (req, res) => {
    const bookingId = String(req.body.bookingId || '')
    const orderId = String(req.body.orderId || '')
    const paymentId = String(req.body.paymentId || '')
    const signature = String(req.body.signature || '')
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?').get(bookingId, req.user.id)
    if (!booking) return res.status(404).json({ error: 'Booking not found.' })
    const existingPayment = db.prepare('SELECT id FROM booking_payments WHERE provider_order_id = ?').get(orderId)
    if (existingPayment) return res.json({ booking: db.prepare(`${bookingSelect} WHERE b.id = ?`).get(booking.id) })
    if (!booking.payment_order_id || booking.payment_order_id !== orderId) return res.status(400).json({ error: 'Payment order does not match this booking.' })
    if (!booking.payment_order_amount || !booking.payment_order_kind) return res.status(400).json({ error: 'Payment order details are incomplete.' })

    let verified = false
    let verifiedPaymentId = paymentId
    if (booking.payment_provider === 'razorpay' && config.razorpayKeySecret) {
      const expected = createHmac('sha256', config.razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex')
      const expectedBuffer = Buffer.from(expected)
      const receivedBuffer = Buffer.from(signature)
      verified = expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
    } else if (booking.payment_provider === 'development' && config.allowDemoPayments) {
      verified = true
      verifiedPaymentId = paymentId || `demo_pay_${randomUUID().slice(0, 12)}`
    }
    if (!verified) {
      db.prepare(`UPDATE bookings SET payment_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(booking.id)
      return res.status(400).json({ error: 'Payment verification failed.' })
    }

    const newAmountPaid = booking.amount_paid + booking.payment_order_amount
    const isFullyPaid = booking.amount != null && newAmountPaid >= booking.amount
    const recordPayment = db.transaction(() => {
      db.prepare(`
        INSERT INTO booking_payments (
          id, booking_id, kind, provider, provider_order_id, provider_payment_id, amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `PAY-${randomUUID().slice(0, 12).toUpperCase()}`, booking.id, booking.payment_order_kind,
        booking.payment_provider, orderId, verifiedPaymentId, booking.payment_order_amount,
      )
      db.prepare(`
        UPDATE bookings SET status = 'confirmed', payment_status = ?, payment_id = ?,
          amount_paid = ?, paid_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE paid_at END,
          updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(isFullyPaid ? 'paid' : 'pending', verifiedPaymentId, newAmountPaid, isFullyPaid ? 1 : 0, booking.id)
    })
    recordPayment()
    res.json({ booking: db.prepare(`${bookingSelect} WHERE b.id = ?`).get(booking.id) })
  })

  app.get('/api/admin/dashboard', authRequired, requireAdmin, (_req, res) => {
    const today = isoToday()
    const totals = db.prepare(`
      SELECT
        COUNT(*) AS totalBookings,
        COALESCE(SUM(CASE WHEN event_date = ? THEN 1 ELSE 0 END), 0) AS todayBookings,
        COALESCE(SUM(CASE WHEN status != 'cancelled' AND (amount IS NULL OR amount > amount_paid) THEN 1 ELSE 0 END), 0) AS pendingPayments,
        COALESCE(SUM(CASE WHEN status != 'cancelled' AND amount IS NOT NULL AND amount > amount_paid THEN amount - amount_paid ELSE 0 END), 0) AS pendingValue
      FROM bookings
    `).get(today)
    const totalRevenue = db.prepare('SELECT COALESCE(SUM(amount), 0) AS value FROM booking_payments').get().value
    const monthKey = today.slice(0, 7)
    const thisMonthRevenue = db.prepare(`SELECT COALESCE(SUM(amount), 0) AS value FROM booking_payments WHERE substr(paid_at, 1, 7) = ?`).get(monthKey).value

    const revenueRows = db.prepare(`
      SELECT substr(paid_at, 1, 7) AS month, SUM(amount) AS revenue, COUNT(DISTINCT booking_id) AS bookings
      FROM booking_payments
      GROUP BY substr(paid_at, 1, 7) ORDER BY month
    `).all()
    const revenueMap = new Map(revenueRows.map((row) => [row.month, row]))
    const monthlyRevenue = []
    const cursor = new Date(`${monthKey}-01T00:00:00Z`)
    cursor.setUTCMonth(cursor.getUTCMonth() - 11)
    for (let index = 0; index < 12; index += 1) {
      const key = cursor.toISOString().slice(0, 7)
      const row = revenueMap.get(key)
      monthlyRevenue.push({ month: key, label: cursor.toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }), revenue: row?.revenue || 0, bookings: row?.bookings || 0 })
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }

    const upcomingBookings = db.prepare(`${bookingSelect} WHERE b.event_date >= ? AND b.status != 'cancelled' ORDER BY b.event_date, b.event_time LIMIT 8`).all(today)
    res.json({ metrics: { ...totals, totalRevenue, thisMonthRevenue }, monthlyRevenue, upcomingBookings, cities })
  })

  app.get('/api/admin/bookings', authRequired, requireAdmin, (req, res) => {
    const search = `%${String(req.query.search || '').trim()}%`
    const bookings = db.prepare(`${bookingSelect}
      WHERE a.title LIKE ? OR u.name LIKE ? OR u.email LIKE ? OR b.city LIKE ? OR b.id LIKE ?
      ORDER BY b.created_at DESC LIMIT 200
    `).all(search, search, search, search, search)
    res.json({ bookings })
  })

  app.patch('/api/admin/bookings/:id/status', authRequired, requireAdmin, (req, res) => {
    const status = String(req.body.status || '')
    if (!['quote_requested', 'payment_pending', 'confirmed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid booking status.' })
    const result = db.prepare('UPDATE bookings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id)
    if (!result.changes) return res.status(404).json({ error: 'Booking not found.' })
    res.json({ booking: db.prepare(`${bookingSelect} WHERE b.id = ?`).get(req.params.id) })
  })

  app.patch('/api/admin/bookings/:id/amount', authRequired, requireAdmin, (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
    if (!booking) return res.status(404).json({ error: 'Booking not found.' })
    const amount = Number(req.body.amount)
    if (!Number.isInteger(amount) || amount < booking.amount_paid || amount > 10000000) {
      return res.status(400).json({ error: 'The final total must be a whole-rupee amount that is not less than the amount already paid.' })
    }
    const isFullyPaid = amount === booking.amount_paid
    db.prepare(`
      UPDATE bookings SET amount = ?, payment_status = ?,
        paid_at = CASE WHEN ? = 1 THEN COALESCE(paid_at, CURRENT_TIMESTAMP) ELSE paid_at END,
        updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(amount, isFullyPaid ? 'paid' : 'pending', isFullyPaid ? 1 : 0, booking.id)
    res.json({ booking: db.prepare(`${bookingSelect} WHERE b.id = ?`).get(booking.id) })
  })

  app.post('/api/admin/bookings/:id/settle-balance', authRequired, requireAdmin, (req, res) => {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id)
    if (!booking) return res.status(404).json({ error: 'Booking not found.' })
    if (booking.status === 'cancelled') return res.status(409).json({ error: 'A cancelled booking cannot be settled.' })
    if (booking.amount == null) return res.status(400).json({ error: 'Set the final booking total before collecting the balance.' })
    const balance = booking.amount - booking.amount_paid
    if (balance <= 0) return res.status(409).json({ error: 'This booking has no remaining balance.' })

    const paymentId = `CASH-${randomUUID().slice(0, 12).toUpperCase()}`
    const settleBalance = db.transaction(() => {
      db.prepare(`
        INSERT INTO booking_payments (
          id, booking_id, kind, provider, provider_payment_id, amount
        ) VALUES (?, ?, 'balance', 'cash', ?, ?)
      `).run(`PAY-${randomUUID().slice(0, 12).toUpperCase()}`, booking.id, paymentId, balance)
      db.prepare(`
        UPDATE bookings SET amount_paid = amount, status = 'confirmed', payment_status = 'paid',
          payment_provider = 'cash', payment_id = ?, paid_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(paymentId, booking.id)
    })
    settleBalance()
    res.json({ booking: db.prepare(`${bookingSelect} WHERE b.id = ?`).get(booking.id) })
  })

  app.patch('/api/admin/activities/:id', authRequired, requireAdmin, (req, res) => {
    const price = req.body.price === null || req.body.price === '' ? null : Number(req.body.price)
    if (price !== null && (!Number.isInteger(price) || price < 0 || price > 10000000)) return res.status(400).json({ error: 'Please enter a valid whole-rupee price.' })
    const result = db.prepare('UPDATE activities SET price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(price, req.params.id)
    if (!result.changes) return res.status(404).json({ error: 'Activity not found.' })
    const activity = db.prepare('SELECT id, title, category, price, price_unit AS priceUnit, min_lead_days AS minLeadDays FROM activities WHERE id = ?').get(req.params.id)
    res.json({ activity })
  })

  app.use((error, _req, res, _next) => {
    console.error(error)
    res.status(500).json({ error: 'Something went wrong. Please try again.' })
  })

  return app
}
