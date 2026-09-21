import { Router } from 'express'
import { authenticate, requireCustomer } from '../auth/auth.middleware.js'
import { createOrder, verify } from './payment.controller.js'

export const paymentRouter = Router()
paymentRouter.use(authenticate, requireCustomer)
paymentRouter.post('/create-order', createOrder)
paymentRouter.post('/verify', verify)
