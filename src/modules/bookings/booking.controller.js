import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { cancelBooking, createBooking, findBookingForReceipt, listUserBookings } from './booking.service.js'
import { createReceiptPdf } from './receipt.service.js'

export const create = asyncHandler(async (req, res) => res.status(201).json({ booking: await createBooking(req.user, req.body) }))
export const mine = asyncHandler(async (req, res) => res.json({ bookings: await listUserBookings(req.user.id) }))
export const cancel = asyncHandler(async (req, res) => res.json({ booking: await cancelBooking(req.user.id, req.params.reference, req.body.reason) }))
export const receipt = asyncHandler(async (req, res) => {
  const booking = await findBookingForReceipt(req.params.reference, req.user)
  const pdf = await createReceiptPdf(booking)
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${booking.reference}-receipt.pdf"`, 'Content-Length': pdf.length })
  res.send(pdf)
})
