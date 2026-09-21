import { Router } from 'express'
import { authenticate, requireAdmin } from '../auth/auth.middleware.js'
import { getBookings, getDashboard, patchAmount, patchGuests, patchStatus, postCompleteRefund, postSettleBalance } from './admin.controller.js'

export const adminRouter = Router()
adminRouter.use(authenticate, requireAdmin)
adminRouter.get('/dashboard', getDashboard)
adminRouter.get('/bookings', getBookings)
adminRouter.patch('/bookings/:reference/status', patchStatus)
adminRouter.patch('/bookings/:reference/amount', patchAmount)
adminRouter.patch('/bookings/:reference/guests', patchGuests)
adminRouter.post('/bookings/:reference/settle-balance', postSettleBalance)
adminRouter.post('/bookings/:reference/complete-refund', postCompleteRefund)
