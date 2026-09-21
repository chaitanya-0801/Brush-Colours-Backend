import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { createGroupInquiry, listGroupInquiries, updateGroupInquiryStatus } from './groupInquiry.service.js'

export const create = asyncHandler(async (req, res) => res.status(201).json({ inquiry: await createGroupInquiry(req.body) }))
export const listForAdmin = asyncHandler(async (req, res) => res.json({ inquiries: await listGroupInquiries(req.query.search) }))
export const patchStatus = asyncHandler(async (req, res) => res.json({ inquiry: await updateGroupInquiryStatus(req.params.id, req.body.status, req.user.id) }))
