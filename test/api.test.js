import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import request from 'supertest'

let replset
let disconnectDatabase
let app
let userAgent
let adminAgent
let bookingReference

const futureDate = (days = 10) => {
  const value = new Date()
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

const binaryParser = (res, callback) => {
  res.setEncoding('binary')
  let data = ''
  res.on('data', (chunk) => { data += chunk })
  res.on('end', () => callback(null, Buffer.from(data, 'binary')))
}

before(async () => {
  process.env.NODE_ENV = 'test'
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-automated-tests'
  process.env.ADMIN_NAME = 'Garima'
  process.env.ADMIN_EMAIL = 'admin@example.com'
  process.env.ADMIN_PASSWORD = 'AdminPass@123'
  process.env.ALLOW_DEMO_PAYMENTS = 'true'
  const binary = process.env.MONGOMS_SYSTEM_BINARY ? { systemBinary: process.env.MONGOMS_SYSTEM_BINARY } : undefined
  replset = await MongoMemoryReplSet.create({ binary, replSet: { count: 1, storageEngine: 'wiredTiger' } })
  process.env.MONGODB_URI = replset.getUri('brush-colours-test')

  const database = await import('../src/config/database.js')
  const auth = await import('../src/modules/auth/auth.service.js')
  const seed = await import('../src/seed/seed.service.js')
  const application = await import('../src/app.js')
  disconnectDatabase = database.disconnectDatabase
  await database.connectDatabase(process.env.MONGODB_URI)
  await seed.seedActivitiesIfEmpty()
  await auth.ensureAdmin()
  app = application.createApp()
  userAgent = request.agent(app)
  adminAgent = request.agent(app)
})

after(async () => {
  if (disconnectDatabase) await disconnectDatabase()
  if (replset) await replset.stop()
})

test('health reports a MongoDB connection', async () => {
  const response = await request(app).get('/api/health').expect(200)
  assert.equal(response.body.ok, true)
  assert.equal(response.body.database, 'mongodb-connected')
})

test('customer registration and admin login use protected cookie sessions', async () => {
  const customer = await userAgent.post('/api/auth/register').send({
    name: 'Test Customer', email: 'customer@example.com', password: 'Customer@123',
  }).expect(201)
  assert.equal(customer.body.user.role, 'user')
  const admin = await adminAgent.post('/api/auth/login').send({
    email: 'admin@example.com', password: 'AdminPass@123',
  }).expect(200)
  assert.equal(admin.body.user.role, 'admin')
})

test('admin can create an event with database-managed time slots and guest pricing', async () => {
  const created = await adminAgent.post('/api/admin/activities').send({
    title: 'Dynamic Paint Party',
    category: 'birthday',
    short: 'A colourful test event.',
    description: 'A complete painting party with materials and a facilitator.',
    price: 1000,
    priceUnit: 'per event',
    duration: '2 hrs',
    guestsLabel: '5-30 guests',
    locations: ['Delhi', 'Jaipur'],
    badge: 'New',
    minLeadDays: 2,
    imageUrl: 'https://images.unsplash.com/photo-1541961017774-22349e4a1262',
    includes: ['Paint supplies', 'Facilitator'],
    timeSlots: [
      { id: 'brunch', label: '10:30 AM - 12:30 PM', start: '10:30', end: '12:30' },
      { id: 'sunset', label: '4:30 PM - 6:30 PM', start: '16:30', end: '18:30' },
    ],
    guestPricing: { enabled: true, includedGuests: 5, percentPerExtraGuest: 10, maxGuests: 30 },
  }).expect(201)
  assert.equal(created.body.activity.timeSlots[0].id, 'brunch')
  assert.equal(created.body.activity.guestPricing.percentPerExtraGuest, 10)

  const publicList = await request(app).get('/api/activities').expect(200)
  const activity = publicList.body.activities.find((item) => item.id === 'dynamic-paint-party')
  assert.equal(activity.timeSlots.length, 2)
  assert.equal(activity.description.includes('painting party'), true)
})

test('admin accounts are forbidden from booking events', async () => {
  await adminAgent.post('/api/bookings').send({
    activityId: 'dynamic-paint-party', eventDate: futureDate(), timeSlotId: 'brunch',
    guests: 7, city: 'Delhi', venueAddress: '123 Creative Street, Delhi', contactPhone: '+91 98765 43210',
  }).expect(403)
})

test('customer booking uses the selected dynamic slot and percentage guest price', async () => {
  const created = await userAgent.post('/api/bookings').send({
    activityId: 'dynamic-paint-party', eventDate: futureDate(), timeSlotId: 'sunset',
    guests: 7, city: 'Delhi', venueAddress: '123 Creative Street, Delhi', contactPhone: '+91 98765 43210',
  }).expect(201)
  bookingReference = created.body.booking.id
  assert.equal(created.body.booking.eventTime, '4:30 PM - 6:30 PM')
  assert.equal(created.body.booking.baseAmount, 1000)
  assert.equal(created.body.booking.guestAdjustment.extraGuests, 2)
  assert.equal(created.body.booking.guestAdjustment.amount, 200)
  assert.equal(created.body.booking.amount, 1200)
})

test('customer pays the non-refundable Rs 299 deposit and can download a receipt', async () => {
  const order = await userAgent.post('/api/payments/create-order').send({
    bookingId: bookingReference, paymentKind: 'deposit',
  }).expect(200)
  assert.equal(order.body.amount, 29900)
  const paid = await userAgent.post('/api/payments/verify').send({
    bookingId: bookingReference, orderId: order.body.orderId,
  }).expect(200)
  assert.equal(paid.body.booking.amountPaid, 299)
  assert.equal(paid.body.booking.balanceAmount, 901)
  assert.equal(paid.body.booking.receiptUrl.endsWith('/receipt'), true)

  const receipt = await userAgent.get(`/api/bookings/${bookingReference}/receipt`)
    .buffer(true).parse(binaryParser).expect(200).expect('Content-Type', /pdf/)
  assert.equal(receipt.body.subarray(0, 4).toString(), '%PDF')
})

test('admin can recalculate a booking after a guest increase using a percentage', async () => {
  const updated = await adminAgent.patch(`/api/admin/bookings/${bookingReference}/guests`).send({
    guests: 8, percentage: 5, reason: 'Customer added one more guest',
  }).expect(200)
  assert.equal(updated.body.booking.guests, 8)
  assert.equal(updated.body.booking.guestAdjustment.extraGuests, 3)
  assert.equal(updated.body.booking.guestAdjustment.amount, 150)
  assert.equal(updated.body.booking.amount, 1150)
})

test('customer cancellation retains Rs 299 and does not perform an automatic refund', async () => {
  const cancelled = await userAgent.post(`/api/bookings/${bookingReference}/cancel`).send({
    reason: 'Plans changed',
  }).expect(200)
  assert.equal(cancelled.body.booking.status, 'cancelled')
  assert.equal(cancelled.body.booking.cancellation.depositRetained, 299)
  assert.equal(cancelled.body.booking.cancellation.refundStatus, 'not_applicable')
  assert.equal(cancelled.body.booking.amountPaid, 299)
})

test('admin can archive an event so it disappears from the customer catalogue', async () => {
  await adminAgent.delete('/api/admin/activities/dynamic-paint-party').expect(200)
  const publicList = await request(app).get('/api/activities').expect(200)
  assert.equal(publicList.body.activities.some((item) => item.id === 'dynamic-paint-party'), false)
})

test('dashboard revenue is calculated from captured MongoDB payments', async () => {
  const response = await adminAgent.get('/api/admin/dashboard').expect(200)
  assert.equal(response.body.metrics.totalRevenue, 299)
  assert.equal(response.body.monthlyRevenue.length, 12)
})
