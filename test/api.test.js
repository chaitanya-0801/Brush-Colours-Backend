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

test('customer can create and pay for a future booking', async () => {
  const future = new Date()
  future.setDate(future.getDate() + 10)
  const eventDate = future.toISOString().slice(0, 10)
  const created = await userAgent.post('/api/bookings').send({
    activityId: 'pottery-party', eventDate, eventTime: '11:00 AM – 1:00 PM', guests: 6,
    city: 'Kota', venueAddress: '456 Creative Street, Kota', contactPhone: '+91 98765 43210',
  }).expect(201)
  bookingId = created.body.booking.id
  assert.equal(created.body.booking.city, 'Kota')
  const order = await userAgent.post('/api/payments/create-order').send({ bookingId }).expect(200)
  assert.equal(order.body.provider, 'development')
  orderId = order.body.orderId
  const paid = await userAgent.post('/api/payments/verify').send({ bookingId, orderId }).expect(200)
  assert.equal(paid.body.booking.paymentStatus, 'paid')
  assert.equal(paid.body.booking.status, 'confirmed')
})

test('admin access is protected and dashboard reports paid revenue', async () => {
  await userAgent.get('/api/admin/dashboard').expect(403)
  const login = await adminAgent.post('/api/auth/login').send({ email: config.adminEmail, password: config.adminPassword }).expect(200)
  assert.equal(login.body.user.role, 'admin')
  const dashboard = await adminAgent.get('/api/admin/dashboard').expect(200)
  assert.equal(dashboard.body.metrics.totalRevenue, 4699)
  assert.equal(dashboard.body.monthlyRevenue.length, 12)
})

test('admin can update an activity price in the database', async () => {
  const updated = await adminAgent.patch('/api/admin/activities/perfume-making-stall').send({ price: 5999 }).expect(200)
  assert.equal(updated.body.activity.price, 5999)
  const activities = await request(app).get('/api/activities').expect(200)
  assert.equal(activities.body.activities.find((activity) => activity.id === 'perfume-making-stall').price, 5999)
})
