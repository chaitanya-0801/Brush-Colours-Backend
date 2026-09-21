import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, requireAdmin } from '../auth/auth.middleware.js'
import { create, listForAdmin, patchStatus } from './groupInquiry.controller.js'

const enquiryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false })

export const groupInquiryRouter = Router()
groupInquiryRouter.post('/', enquiryLimiter, create)

export const adminGroupInquiryRouter = Router()
adminGroupInquiryRouter.use(authenticate, requireAdmin)
adminGroupInquiryRouter.get('/', listForAdmin)
adminGroupInquiryRouter.patch('/:id/status', patchStatus)
