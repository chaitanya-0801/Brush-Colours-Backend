import mongoose from 'mongoose'
import { conflict, notFound, badRequest, AppError } from '../../common/errors/AppError.js'
import { paymentReference } from '../../common/utils/ids.js'
import { env, paymentsConfigured } from '../../config/env.js'
import { Booking } from '../bookings/booking.model.js'
import { bookingView } from '../bookings/booking.view.js'
import { Payment } from './payment.model.js'
import {
  captureAuthorizedProviderPayment,
  createProviderOrder,
  fetchProviderPayment,
  verifyCheckoutSignature,
} from './razorpay.gateway.js'

const depositTarget = (booking) => Math.min(booking.depositAmount, booking.amount ?? booking.depositAmount)

export async function createPaymentOrder(userId, bookingReference, requestedKind) {
  const booking = await Booking.findOne({ reference: bookingReference, user: userId })
  if (!booking) throw notFound('Booking not found.', 'BOOKING_NOT_FOUND')
  if (booking.status === 'cancelled') throw conflict('This booking has been cancelled.', 'BOOKING_CANCELLED')
  if (booking.status === 'completed') throw conflict('This event is already completed.', 'BOOKING_COMPLETED')
  if (!['deposit', 'balance'].includes(requestedKind)) throw badRequest('Choose either a deposit or balance payment.', 'INVALID_PAYMENT_KIND')
  const kind = requestedKind
  const deposit = depositTarget(booking)
  let amount
  if (kind === 'deposit') {
    if (booking.amountPaid >= deposit) throw conflict('The non-refundable pre-booking amount is already paid.', 'DEPOSIT_ALREADY_PAID')
    amount = deposit - booking.amountPaid
  } else {
    if (booking.amount == null) throw badRequest('The owner must confirm the final price before the balance can be paid online.', 'QUOTE_REQUIRED')
    if (booking.amountPaid < deposit) throw conflict('Please pay the pre-booking amount first.', 'DEPOSIT_REQUIRED')
    amount = booking.amount - booking.amountPaid
    if (amount <= 0) throw conflict('This booking has no remaining balance.', 'NOTHING_TO_PAY')
  }

  const recent = await Payment.findOne({
    booking: booking._id, kind, status: 'created', amount,
    createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
  }).sort({ createdAt: -1 })
  if (recent) return paymentOrderView(recent)

  let provider = 'development'
  let orderId = `demo_order_${new mongoose.Types.ObjectId()}`
  if (paymentsConfigured()) {
    const order = await createProviderOrder({ amount, receipt: `${booking.reference}-${kind}`, notes: { bookingReference: booking.reference, kind } })
    provider = 'razorpay'
    orderId = order.id
  } else if (!env.allowDemoPayments) {
    throw new AppError(503, 'Online payments are not configured. Please contact the owner.', 'PAYMENTS_NOT_CONFIGURED')
  }

  const payment = await Payment.create({
    reference: paymentReference(), booking: booking._id, bookingReference: booking.reference,
    user: booking.user, kind, provider, amount, providerOrderId: orderId,
  })
  booking.latestOrder = { provider, orderId, amount, kind, createdAt: new Date() }
  await booking.save()
  return paymentOrderView(payment)
}

const paymentOrderView = (payment) => ({
  provider: payment.provider,
  keyId: payment.provider === 'razorpay' ? env.razorpayKeyId : undefined,
  orderId: payment.providerOrderId,
  amount: payment.amount * 100,
  currency: 'INR',
  paymentKind: payment.kind,
})

export async function verifyPayment({ userId, bookingReference, orderId, paymentId, signature }) {
  const payment = await Payment.findOne({ providerOrderId: orderId, bookingReference, user: userId })
  if (!payment) throw notFound('Payment order not found.', 'PAYMENT_ORDER_NOT_FOUND')
  if (payment.status === 'captured') return bookingView(await Booking.findById(payment.booking))
  if (payment.provider === 'razorpay' && !verifyCheckoutSignature(orderId, paymentId, signature)) {
    throw badRequest('Payment verification failed.', 'PAYMENT_VERIFICATION_FAILED')
  }
  if (payment.provider === 'razorpay') {
    if (!paymentId) throw badRequest('The payment id is required.', 'PAYMENT_ID_REQUIRED')
    let providerPayment = await fetchProviderPayment(paymentId)
    assertProviderPaymentMatches(payment, providerPayment)
    if (providerPayment.status === 'authorized') {
      try {
        providerPayment = await captureAuthorizedProviderPayment(paymentId, payment.amount)
      } catch (error) {
        // Auto-capture can win this race. Re-fetch once before returning an error.
        providerPayment = await fetchProviderPayment(paymentId)
        if (providerPayment.status !== 'captured') throw error
      }
      assertProviderPaymentMatches(payment, providerPayment)
    }
    if (providerPayment.status !== 'captured') {
      throw conflict('Payment is not captured yet. Please wait a moment and refresh your bookings.', 'PAYMENT_NOT_CAPTURED')
    }
  }
  const verifiedPaymentId = payment.provider === 'development' ? (paymentId || `demo_pay_${new mongoose.Types.ObjectId()}`) : paymentId
  return capturePayment(payment, verifiedPaymentId)
}

export async function captureProviderPayment({ orderId, paymentId, amount, currency, eventId }) {
  const payment = await Payment.findOne({ providerOrderId: orderId })
  if (!payment) return null
  if (payment.provider !== 'razorpay') throw badRequest('Webhook order does not belong to Razorpay.', 'PAYMENT_PROVIDER_MISMATCH')
  assertProviderPaymentMatches(payment, { id: paymentId, order_id: orderId, amount, currency, status: 'captured' })
  if (eventId && payment.providerEventIds.includes(eventId)) return bookingView(await Booking.findById(payment.booking))
  if (payment.status === 'captured') {
    if (eventId) {
      payment.providerEventIds.addToSet(eventId)
      await payment.save()
    }
    return bookingView(await Booking.findById(payment.booking))
  }
  return capturePayment(payment, paymentId, eventId)
}

function assertProviderPaymentMatches(payment, providerPayment) {
  const matches = providerPayment
    && providerPayment.order_id === payment.providerOrderId
    && providerPayment.amount === payment.amount * 100
    && providerPayment.currency === 'INR'
  if (!matches) throw badRequest('Payment details do not match this booking.', 'PAYMENT_DETAILS_MISMATCH')
}

async function capturePayment(paymentDocument, providerPaymentId, eventId) {
  const session = await mongoose.startSession()
  let output
  try {
    await session.withTransaction(async () => {
      const payment = await Payment.findById(paymentDocument._id).session(session)
      if (payment.status === 'captured') {
        output = bookingView(await Booking.findById(payment.booking).session(session))
        return
      }
      const booking = await Booking.findById(payment.booking).session(session)
      if (!booking) throw notFound('Booking not found.', 'BOOKING_NOT_FOUND')
      payment.status = 'captured'
      payment.providerPaymentId = providerPaymentId
      if (eventId) payment.providerEventIds.addToSet(eventId)
      payment.capturedAt = new Date()
      await payment.save({ session })
      booking.amountPaid += payment.amount
      booking.status = 'confirmed'
      booking.paymentStatus = booking.amount != null && booking.amountPaid >= booking.amount ? 'paid' : 'pending'
      await booking.save({ session })
      output = bookingView(booking)
    })
  } finally {
    await session.endSession()
  }
  return output
}

export async function recordCashBalance(booking, adminId) {
  if (booking.amount == null) throw badRequest('Set the final booking total before collecting the balance.', 'QUOTE_REQUIRED')
  const balance = booking.amount - booking.amountPaid
  if (balance <= 0) throw conflict('This booking has no remaining balance.', 'NOTHING_TO_PAY')
  await Payment.create({
    reference: paymentReference(), booking: booking._id, bookingReference: booking.reference, user: booking.user,
    kind: 'balance', provider: 'cash', status: 'captured', amount: balance,
    providerPaymentId: `CASH-${new mongoose.Types.ObjectId()}`, capturedAt: new Date(), recordedBy: adminId,
  })
  booking.amountPaid += balance
  booking.paymentStatus = 'paid'
  booking.status = 'confirmed'
  await booking.save()
  return bookingView(booking)
}

export async function queueEligibleRefunds(booking) {
  const balancePayments = await Payment.find({ booking: booking._id, kind: 'balance', status: 'captured' })
  const refundableAmount = balancePayments.reduce((sum, payment) => sum + Math.max(payment.amount - payment.refundedAmount, 0), 0)
  if (!refundableAmount) return { refundableAmount: 0, status: 'not_applicable' }
  await Payment.updateMany(
    { _id: { $in: balancePayments.map((payment) => payment._id) } },
    { $set: { status: 'refund_pending' } },
  )
  return { refundableAmount, status: balancePayments.some((payment) => payment.provider === 'cash') ? 'manual_required' : 'pending' }
}

export async function markRefundProcessed(booking, adminId) {
  const payments = await Payment.find({ booking: booking._id, status: 'refund_pending' })
  const total = payments.reduce((sum, payment) => sum + Math.max(payment.amount - payment.refundedAmount, 0), 0)
  for (const payment of payments) {
    payment.refundedAmount = payment.amount
    payment.status = 'refunded'
    payment.refundedAt = new Date()
    payment.recordedBy = adminId
    await payment.save()
  }
  booking.amountPaid = Math.max(0, booking.amountPaid - total)
  booking.paymentStatus = booking.amountPaid > 0 ? 'partially_refunded' : 'refunded'
  booking.cancellation.refundStatus = 'processed'
  await booking.save()
  return bookingView(booking)
}
