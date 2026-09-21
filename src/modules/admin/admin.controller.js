import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { completeRefund, dashboard, searchBookings, settleBalance, updateAmount, updateGuestPricing, updateStatus } from './admin.service.js'

export const getDashboard = asyncHandler(async (_req, res) => res.json(await dashboard()))
export const getBookings = asyncHandler(async (req, res) => res.json({ bookings: await searchBookings(String(req.query.search || '')) }))
export const patchStatus = asyncHandler(async (req, res) => res.json({ booking: await updateStatus(req.params.reference, String(req.body.status || '')) }))
export const patchAmount = asyncHandler(async (req, res) => res.json({ booking: await updateAmount(req.params.reference, req.body.amount, req.body.reason) }))
export const patchGuests = asyncHandler(async (req, res) => res.json({ booking: await updateGuestPricing(req.params.reference, req.body.guests, req.body.percentage, req.body.reason) }))
export const postSettleBalance = asyncHandler(async (req, res) => res.json({ booking: await settleBalance(req.params.reference, req.user.id) }))
export const postCompleteRefund = asyncHandler(async (req, res) => res.json({ booking: await completeRefund(req.params.reference, req.user.id) }))
