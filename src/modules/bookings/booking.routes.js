import { Router } from 'express'
import { authenticate, requireCustomer } from '../auth/auth.middleware.js'
import { cancel, create, mine, receipt } from './booking.controller.js'

export const bookingRouter = Router()
bookingRouter.use(authenticate)
bookingRouter.get('/mine', mine)
bookingRouter.get('/:reference/receipt', receipt)
bookingRouter.post('/', requireCustomer, create)
bookingRouter.post('/:reference/cancel', requireCustomer, cancel)
