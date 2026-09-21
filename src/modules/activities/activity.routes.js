import { Router } from 'express'
import { authenticate, requireAdmin } from '../auth/auth.middleware.js'
import { adminCreateActivity, adminDeleteActivity, adminListActivities, adminUpdateActivity, getActivity, listActivities } from './activity.controller.js'

export const activityRouter = Router()
activityRouter.get('/', listActivities)
activityRouter.get('/:slug', getActivity)

export const adminActivityRouter = Router()
adminActivityRouter.use(authenticate, requireAdmin)
adminActivityRouter.get('/', adminListActivities)
adminActivityRouter.post('/', adminCreateActivity)
adminActivityRouter.patch('/:slug', adminUpdateActivity)
adminActivityRouter.delete('/:slug', adminDeleteActivity)
