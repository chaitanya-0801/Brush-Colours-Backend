import { badRequest, notFound } from '../../common/errors/AppError.js'
import { groupInquiryReference } from '../../common/utils/ids.js'
import { serviceCities } from '../../config/env.js'
import { GroupInquiry } from './groupInquiry.model.js'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^[+\d][\d\s()-]{7,23}$/
const allowedStatuses = new Set(['new', 'contacted', 'closed'])

const view = (inquiry) => ({
  id: inquiry._id.toString(),
  reference: inquiry.reference,
  fullName: inquiry.fullName,
  eventType: inquiry.eventType,
  organizationName: inquiry.organizationName,
  whatsappNumber: inquiry.whatsappNumber,
  email: inquiry.email,
  eventDate: inquiry.eventDate,
  city: inquiry.city,
  participants: inquiry.participants,
  activityPreference: inquiry.activityPreference,
  details: inquiry.details,
  status: inquiry.status,
  createdAt: inquiry.createdAt,
  statusUpdatedAt: inquiry.statusUpdatedAt,
})

export async function createGroupInquiry(input) {
  const fullName = String(input.fullName || '').trim()
  const eventType = String(input.eventType || '').trim()
  const organizationName = String(input.organizationName || '').trim()
  const whatsappNumber = String(input.whatsappNumber || '').trim()
  const email = String(input.email || '').trim().toLowerCase()
  const eventDate = String(input.eventDate || '').trim()
  const city = String(input.city || '').trim()
  const participants = Number(input.participants)
  const activityPreference = String(input.activityPreference || '').trim()
  const details = String(input.details || '').trim()

  if (fullName.length < 2) throw badRequest('Please enter your full name.', 'INVALID_NAME')
  if (!eventType) throw badRequest('Please choose the kind of event.', 'INVALID_EVENT_TYPE')
  if (!phonePattern.test(whatsappNumber)) throw badRequest('Please enter a valid WhatsApp number.', 'INVALID_PHONE')
  if (!emailPattern.test(email)) throw badRequest('Please enter a valid email address.', 'INVALID_EMAIL')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate < new Date().toISOString().slice(0, 10)) throw badRequest('Please choose a future event date.', 'INVALID_EVENT_DATE')
  if (!serviceCities.includes(city)) throw badRequest('Please choose one of our service cities.', 'INVALID_CITY')
  if (!Number.isInteger(participants) || participants < 2 || participants > 5000) throw badRequest('Participants must be between 2 and 5,000.', 'INVALID_PARTICIPANTS')
  if (activityPreference.length < 2) throw badRequest('Tell us which activity you prefer.', 'INVALID_ACTIVITY')
  if (details.length < 10) throw badRequest('Please add a short description of your event.', 'INVALID_DETAILS')

  const inquiry = await GroupInquiry.create({
    reference: groupInquiryReference(), fullName, eventType, organizationName, whatsappNumber,
    email, eventDate, city, participants, activityPreference, details,
  })
  return view(inquiry)
}

export async function listGroupInquiries(search = '') {
  const query = String(search || '').trim()
  const filter = query ? { $or: [
    { reference: { $regex: query, $options: 'i' } },
    { fullName: { $regex: query, $options: 'i' } },
    { email: { $regex: query, $options: 'i' } },
    { city: { $regex: query, $options: 'i' } },
    { activityPreference: { $regex: query, $options: 'i' } },
  ] } : {}
  const inquiries = await GroupInquiry.find(filter).sort({ createdAt: -1 }).lean()
  return inquiries.map(view)
}

export async function updateGroupInquiryStatus(id, statusValue, adminId) {
  const status = String(statusValue || '').trim().toLowerCase()
  if (!allowedStatuses.has(status)) throw badRequest('Choose new, contacted or closed.', 'INVALID_STATUS')
  const inquiry = await GroupInquiry.findByIdAndUpdate(id, {
    status, statusUpdatedAt: new Date(), statusUpdatedBy: adminId,
  }, { new: true })
  if (!inquiry) throw notFound('Group enquiry not found.', 'GROUP_INQUIRY_NOT_FOUND')
  return view(inquiry)
}
