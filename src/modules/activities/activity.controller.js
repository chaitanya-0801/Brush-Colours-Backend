import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { createActivity, getPublicActivity, listAdminActivities, listPublicActivities, updateActivity, archiveActivity } from './activity.service.js'

export const listActivities = asyncHandler(async (_req, res) => res.json({ activities: await listPublicActivities() }))
export const getActivity = asyncHandler(async (req, res) => res.json({ activity: await getPublicActivity(req.params.slug) }))
export const adminListActivities = asyncHandler(async (_req, res) => res.json({ activities: await listAdminActivities() }))
export const adminCreateActivity = asyncHandler(async (req, res) => res.status(201).json({ activity: await createActivity(req.body, req.user.id) }))
export const adminUpdateActivity = asyncHandler(async (req, res) => res.json({ activity: await updateActivity(req.params.slug, req.body, req.user.id) }))
export const adminDeleteActivity = asyncHandler(async (req, res) => res.json(await archiveActivity(req.params.slug, req.user.id)))
