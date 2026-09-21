import { badRequest, conflict, notFound } from '../../common/errors/AppError.js'
import { indiaDateString } from '../../common/utils/dates.js'
import { serviceCities } from '../../config/env.js'
import { Booking } from '../bookings/booking.model.js'
import { bookingView } from '../bookings/booking.view.js'
import { Payment } from '../payments/payment.model.js'
import { markRefundProcessed, queueEligibleRefunds, recordCashBalance } from '../payments/payment.service.js'

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export async function dashboard() {
  const today = indiaDateString()
  const start = new Date()
  start.setUTCMonth(start.getUTCMonth() - 11, 1)
  start.setUTCHours(0, 0, 0, 0)
  const [totalBookings, todayBookings, pendingRows, revenueRows, monthlyRows, upcomingBookings] = await Promise.all([
    Booking.countDocuments(),
    Booking.countDocuments({ eventDate: today, status: { $ne: 'cancelled' } }),
    Booking.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $project: { due: { $cond: [{ $eq: ['$amount', null] }, 0, { $max: [{ $subtract: ['$amount', '$amountPaid'] }, 0] }] }, pending: { $cond: [{ $or: [{ $eq: ['$amount', null] }, { $gt: ['$amount', '$amountPaid'] }] }, 1, 0] } } },
      { $group: { _id: null, pendingPayments: { $sum: '$pending' }, pendingValue: { $sum: '$due' } } },
    ]),
    Payment.aggregate([
      { $match: { status: { $in: ['captured', 'refund_pending', 'partially_refunded', 'refunded'] } } },
      { $group: { _id: null, value: { $sum: { $subtract: ['$amount', '$refundedAmount'] } } } },
    ]),
    Payment.aggregate([
      { $match: { capturedAt: { $gte: start }, status: { $in: ['captured', 'refund_pending', 'partially_refunded', 'refunded'] } } },
      { $project: { month: { $dateToString: { format: '%Y-%m', date: '$capturedAt', timezone: 'Asia/Kolkata' } }, net: { $subtract: ['$amount', '$refundedAmount'] }, booking: 1 } },
      { $group: { _id: '$month', revenue: { $sum: '$net' }, bookings: { $addToSet: '$booking' } } },
      { $project: { month: '$_id', revenue: 1, bookings: { $size: '$bookings' }, _id: 0 } },
      { $sort: { month: 1 } },
    ]),
    Booking.find({ eventDate: { $gte: today }, status: { $ne: 'cancelled' } }).sort({ eventDate: 1, 'timeSlot.start': 1 }).limit(8).lean(),
  ])
  const monthlyRevenue = buildMonthSeries(monthlyRows)
  const currentMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date())
  const thisMonthRevenue = monthlyRevenue.find((row) => row.month === currentMonth)?.revenue || 0
  return {
    metrics: {
      totalBookings, todayBookings,
      pendingPayments: pendingRows[0]?.pendingPayments || 0,
      pendingValue: pendingRows[0]?.pendingValue || 0,
      totalRevenue: revenueRows[0]?.value || 0,
      thisMonthRevenue,
    },
    monthlyRevenue,
    upcomingBookings: upcomingBookings.map(bookingView),
    cities: serviceCities,
  }
}

function buildMonthSeries(rows) {
  const map = new Map(rows.map((row) => [row.month, row]))
  const cursor = new Date()
  cursor.setUTCDate(1)
  cursor.setUTCMonth(cursor.getUTCMonth() - 11)
  return Array.from({ length: 12 }, () => {
    const month = cursor.toISOString().slice(0, 7)
    const row = map.get(month)
    const output = { month, label: cursor.toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }), revenue: row?.revenue || 0, bookings: row?.bookings || 0 }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    return output
  })
}

export async function searchBookings(searchValue = '') {
  const search = new RegExp(escapeRegex(searchValue.trim()), 'i')
  return (await Booking.find({ $or: [
    { reference: search }, { 'activitySnapshot.title': search }, { 'customer.name': search },
    { 'customer.email': search }, { city: search },
  ] }).sort({ createdAt: -1 }).limit(250).lean()).map(bookingView)
}

const getBooking = async (reference) => {
  const booking = await Booking.findOne({ reference })
  if (!booking) throw notFound('Booking not found.', 'BOOKING_NOT_FOUND')
  return booking
}

export async function updateStatus(reference, status) {
  if (!['quote_requested', 'payment_pending', 'confirmed', 'completed', 'cancelled'].includes(status)) throw badRequest('Invalid booking status.', 'INVALID_STATUS')
  const booking = await getBooking(reference)
  if (status === 'cancelled' && booking.status !== 'cancelled') {
    const refund = await queueEligibleRefunds(booking)
    booking.cancellation = { cancelledAt: new Date(), reason: 'Cancelled by admin', depositRetained: Math.min(booking.amountPaid, booking.depositAmount), refundableAmount: refund.refundableAmount, refundStatus: refund.status }
  }
  booking.status = status
  await booking.save()
  return bookingView(booking)
}

export async function updateAmount(reference, amountValue, reason = '') {
  const booking = await getBooking(reference)
  const amount = Number(amountValue)
  if (!Number.isInteger(amount) || amount < booking.amountPaid || amount > 10_000_000) throw badRequest('The final total must be a whole-rupee amount not below the amount already paid.', 'INVALID_AMOUNT')
  booking.amount = amount
  booking.manualPriceReason = String(reason || 'Admin total update').trim().slice(0, 300)
  booking.paymentStatus = amount === booking.amountPaid ? 'paid' : 'pending'
  await booking.save()
  return bookingView(booking)
}

export async function updateGuestPricing(reference, guestsValue, percentageValue, reason = '') {
  const booking = await getBooking(reference)
  const guests = Number(guestsValue)
  const percentage = Number(percentageValue)
  if (!Number.isInteger(guests) || guests < 1 || guests > 5000) throw badRequest('Enter a valid guest count.', 'INVALID_GUEST_COUNT')
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw badRequest('Percentage must be between 0 and 100.', 'INVALID_PERCENTAGE')
  const includedGuests = Math.max(1, booking.guests - Number(booking.guestAdjustment?.extraGuests || 0))
  const extraGuests = Math.max(0, guests - includedGuests)
  const adjustmentAmount = booking.baseAmount == null ? 0 : Math.round(booking.baseAmount * percentage * extraGuests / 100)
  const amount = booking.baseAmount == null ? null : booking.baseAmount + adjustmentAmount
  if (amount != null && amount < booking.amountPaid) throw conflict('The recalculated total cannot be less than the amount already paid.', 'AMOUNT_BELOW_PAID')
  booking.guests = guests
  booking.guestAdjustment = { extraGuests, percentagePerGuest: percentage, amount: adjustmentAmount }
  booking.amount = amount
  booking.manualPriceReason = String(reason || `Guest count changed to ${guests}`).trim().slice(0, 300)
  booking.paymentStatus = amount != null && amount === booking.amountPaid ? 'paid' : 'pending'
  await booking.save()
  return bookingView(booking)
}

export async function settleBalance(reference, adminId) {
  const booking = await getBooking(reference)
  if (booking.status === 'cancelled') throw conflict('A cancelled booking cannot be settled.', 'BOOKING_CANCELLED')
  return recordCashBalance(booking, adminId)
}

export async function completeRefund(reference, adminId) {
  const booking = await getBooking(reference)
  if (!['pending', 'manual_required'].includes(booking.cancellation?.refundStatus)) throw conflict('This booking has no refund waiting for confirmation.', 'NO_PENDING_REFUND')
  return markRefundProcessed(booking, adminId)
}
