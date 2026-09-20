import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { config } from '../src/config.js'
import { createDatabase } from '../src/db.js'

let db
let app
let userAgent
let adminAgent
let bookingId
let orderId

before(() => {
  db = createDatabase(':memory:')
  app = createApp(db)
  userAgent = request.agent(app)
  adminAgent = request.agent(app)
})

after(() => db.close())

test('health endpoint responds', async () => {
  const response = await request(app).get('/api/health').expect(200)
  assert.equal(response.body.ok, true)
})

test('a customer can register and keep an authenticated session', async () => {
  const response = await userAgent.post('/api/auth/register').send({ name: 'Test Customer', email: 'customer@example.com', password: 'Customer@123' }).expect(201)
  assert.equal(response.body.user.role, 'user')
  const session = await userAgent.get('/api/auth/me').expect(200)
  assert.equal(session.body.user.email, 'customer@example.com')
})

test('same-day bookings are rejected', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const response = await userAgent.post('/api/bookings').send({
    activityId: 'pottery-party', eventDate: today, eventTime: '11:00 AM – 1:00 PM', guests: 6,
    city: 'Delhi', venueAddress: '123 Test Venue, Delhi', contactPhone: '+91 98765 43210',
  }).expect(400)
  assert.match(response.body.error, /Same-day bookings/i)
})

test('customer can pre-book a future event for ₹299', async () => {
  const future = new Date()
  future.setDate(future.getDate() + 10)
  const eventDate = future.toISOString().slice(0, 10)
  const created = await userAgent.post('/api/bookings').send({
    activityId: 'pottery-party', eventDate, eventTime: '11:00 AM – 1:00 PM', guests: 6,
    city: 'Kota', venueAddress: '456 Creative Street, Kota', contactPhone: '+91 98765 43210',
  }).expect(201)
  bookingId = created.body.booking.id
  assert.equal(created.body.booking.city, 'Kota')
  const order = await userAgent.post('/api/payments/create-order').send({ bookingId, paymentKind: 'deposit' }).expect(200)
  assert.equal(order.body.provider, 'development')
  assert.equal(order.body.amount, 29900)
  orderId = order.body.orderId
  const prebooked = await userAgent.post('/api/payments/verify').send({ bookingId, orderId }).expect(200)
  assert.equal(prebooked.body.booking.paymentStatus, 'pending')
  assert.equal(prebooked.body.booking.status, 'confirmed')
  assert.equal(prebooked.body.booking.amountPaid, 299)
  assert.equal(prebooked.body.booking.balanceAmount, 4400)
})

test('admin dashboard counts collected deposits as revenue', async () => {
  await userAgent.get('/api/admin/dashboard').expect(403)
  const login = await adminAgent.post('/api/auth/login').send({ email: config.adminEmail, password: config.adminPassword }).expect(200)
  assert.equal(login.body.user.role, 'admin')
  const dashboard = await adminAgent.get('/api/admin/dashboard').expect(200)
  assert.equal(dashboard.body.metrics.totalRevenue, 299)
  assert.equal(dashboard.body.metrics.pendingValue, 4400)
  assert.equal(dashboard.body.monthlyRevenue.length, 12)
})

test('customer can pay the remaining balance online later', async () => {
  const order = await userAgent.post('/api/payments/create-order').send({ bookingId, paymentKind: 'balance' }).expect(200)
  assert.equal(order.body.amount, 440000)
  const paid = await userAgent.post('/api/payments/verify').send({ bookingId, orderId: order.body.orderId }).expect(200)
  assert.equal(paid.body.booking.paymentStatus, 'paid')
  assert.equal(paid.body.booking.amountPaid, 4699)
  assert.equal(paid.body.booking.balanceAmount, 0)
  const dashboard = await adminAgent.get('/api/admin/dashboard').expect(200)
  assert.equal(dashboard.body.metrics.totalRevenue, 4699)
})

test('admin can set a custom quote and collect its balance in cash', async () => {
  const future = new Date()
  future.setDate(future.getDate() + 14)
  const created = await userAgent.post('/api/bookings').send({
    activityId: 'perfume-making-stall', eventDate: future.toISOString().slice(0, 10), eventTime: '2:00 PM – 4:00 PM', guests: 25,
    city: 'Jaipur', venueAddress: '789 Celebration Avenue, Jaipur', contactPhone: '+91 90000 11111',
  }).expect(201)
  const quoteBookingId = created.body.booking.id
  const depositOrder = await userAgent.post('/api/payments/create-order').send({ bookingId: quoteBookingId, paymentKind: 'deposit' }).expect(200)
  await userAgent.post('/api/payments/verify').send({ bookingId: quoteBookingId, orderId: depositOrder.body.orderId }).expect(200)

  const priced = await adminAgent.patch(`/api/admin/bookings/${quoteBookingId}/amount`).send({ amount: 6000 }).expect(200)
  assert.equal(priced.body.booking.balanceAmount, 5701)
  const settled = await adminAgent.post(`/api/admin/bookings/${quoteBookingId}/settle-balance`).expect(200)
  assert.equal(settled.body.booking.paymentStatus, 'paid')
  assert.equal(settled.body.booking.amountPaid, 6000)
  assert.equal(settled.body.booking.balanceAmount, 0)

  const dashboard = await adminAgent.get('/api/admin/dashboard').expect(200)
  assert.equal(dashboard.body.metrics.totalRevenue, 10699)
})

test('admin can update an activity price in the database', async () => {
  const updated = await adminAgent.patch('/api/admin/activities/perfume-making-stall').send({ price: 5999 }).expect(200)
  assert.equal(updated.body.activity.price, 5999)
  const activities = await request(app).get('/api/activities').expect(200)
  assert.equal(activities.body.activities.find((activity) => activity.id === 'perfume-making-stall').price, 5999)
})
