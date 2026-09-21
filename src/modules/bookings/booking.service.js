import { badRequest, conflict, notFound } from '../../common/errors/AppError.js'
import { bookingReference } from '../../common/utils/ids.js'
import { earliestAllowedDate, indiaDateString, isIsoDate } from '../../common/utils/dates.js'
import { env, serviceCities } from '../../config/env.js'
import { calculateGuestPrice, findBookableActivity } from '../activities/activity.service.js'
import { queueEligibleRefunds } from '../payments/payment.service.js'
import { Booking } from './booking.model.js'
import { bookingView } from './booking.view.js'

const phonePattern = /^[+\d][\d\s-]{7,17}$/

export async function createBooking(user, input) {
  const activity = await findBookableActivity(String(input.activityId || ''))
  const eventDate = String(input.eventDate || '')
  const city = String(input.city || '').trim()
  const venueAddress = String(input.venueAddress || '').trim()
  const contactPhone = String(input.contactPhone || '').trim()
  const guests = Number(input.guests)
  if (!isIsoDate(eventDate) || eventDate < earliestAllowedDate(activity.minLeadDays)) {
    throw badRequest(`Please choose ${earliestAllowedDate(activity.minLeadDays)} or a later date. Same-day bookings are not available.`, 'DATE_TOO_SOON')
  }
  if (!serviceCities.includes(city) || !activity.locations.includes(city)) throw badRequest('This activity is not available in the selected city.', 'CITY_NOT_AVAILABLE')
  if (!Number.isInteger(guests) || guests < 1 || guests > Number(activity.guestPricing?.maxGuests || 1000)) throw badRequest('Please enter a valid guest count.', 'INVALID_GUEST_COUNT')
  if (venueAddress.length < 8) throw badRequest('Please enter the complete venue address.', 'INVALID_ADDRESS')
  if (!phonePattern.test(contactPhone)) throw badRequest('Please enter a valid contact number.', 'INVALID_PHONE')
  const selectedSlot = activity.timeSlots.find((slot) => slot.id === input.timeSlotId && slot.active !== false)
  if (!selectedSlot) throw badRequest('Choose an available time slot for this event.', 'INVALID_TIME_SLOT')
  const pricing = calculateGuestPrice(activity, guests)
  const booking = await Booking.create({
    reference: bookingReference(), user: user.id, activity: activity._id,
    customer: { name: user.name, email: user.email },
    activitySnapshot: { slug: activity.slug, title: activity.title, category: activity.category, image: activity.image.url, priceUnit: activity.priceUnit },
    eventDate, timeSlot: { id: selectedSlot.id, label: selectedSlot.label, start: selectedSlot.start, end: selectedSlot.end },
    guests, city, venueAddress, contactPhone,
    baseAmount: pricing.baseAmount,
    guestAdjustment: { extraGuests: pricing.extraGuests, percentagePerGuest: activity.guestPricing?.percentPerExtraGuest || 0, amount: pricing.adjustmentAmount },
    amount: pricing.amount, depositAmount: env.depositAmount,
    status: pricing.amount == null ? 'quote_requested' : 'payment_pending', paymentStatus: 'pending',
  })
  return bookingView(booking)
}

export async function listUserBookings(userId) {
  return (await Booking.find({ user: userId }).sort({ createdAt: -1 }).lean()).map(bookingView)
}

export async function getOwnedBooking(userId, reference) {
  const booking = await Booking.findOne({ reference, user: userId })
  if (!booking) throw notFound('Booking not found.', 'BOOKING_NOT_FOUND')
  return booking
}

export async function cancelBooking(userId, reference, reason) {
  const booking = await getOwnedBooking(userId, reference)
  if (booking.status === 'cancelled') return bookingView(booking)
  if (booking.status === 'completed' || booking.eventDate < indiaDateString()) throw conflict('Completed or past events cannot be cancelled online.', 'CANCELLATION_CLOSED')
  const depositRetained = Math.min(booking.amountPaid, booking.depositAmount)
  const refund = await queueEligibleRefunds(booking)
  booking.status = 'cancelled'
  booking.cancellation = {
    cancelledAt: new Date(), reason: String(reason || 'Cancelled by customer').trim().slice(0, 300),
    depositRetained, refundableAmount: refund.refundableAmount, refundStatus: refund.status,
  }
  await booking.save()
  return bookingView(booking)
}

export async function findBookingForReceipt(reference, user) {
  const query = { reference }
  if (user.role !== 'admin') query.user = user.id
  const booking = await Booking.findOne(query)
  if (!booking) throw notFound('Booking not found.', 'BOOKING_NOT_FOUND')
  return booking
}
