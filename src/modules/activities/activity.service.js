import { badRequest, conflict, notFound } from '../../common/errors/AppError.js'
import { slugify } from '../../common/utils/ids.js'
import { serviceCities } from '../../config/env.js'
import { Activity } from './activity.model.js'

const categoryValues = new Set(['birthday', 'wedding', 'workshop'])
const defaultSlots = [
  { id: 'morning', label: '11:00 AM - 1:00 PM', start: '11:00', end: '13:00', active: true },
  { id: 'afternoon', label: '2:00 PM - 4:00 PM', start: '14:00', end: '16:00', active: true },
  { id: 'evening', label: '5:00 PM - 7:00 PM', start: '17:00', end: '19:00', active: true },
]

const cleanTextList = (items, max = 20) => Array.isArray(items) ? items.map((item) => String(item || '').trim()).filter(Boolean).slice(0, max) : []

function normalizeTimeSlots(items) {
  if (!Array.isArray(items) || !items.length) return defaultSlots
  const seen = new Set()
  return items.map((slot, index) => {
    const start = String(slot.start || '').trim()
    const end = String(slot.end || '').trim()
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end) {
      throw badRequest(`Time slot ${index + 1} needs a valid start and end time.`, 'INVALID_TIME_SLOT')
    }
    let id = slugify(slot.id || `${start}-${end}`)
    if (!id || seen.has(id)) id = `${id || 'slot'}-${index + 1}`
    seen.add(id)
    return { id, label: String(slot.label || `${start} - ${end}`).trim(), start, end, active: slot.active !== false }
  })
}

function normalizeActivity(input, existing = null) {
  const title = String(input.title ?? existing?.title ?? '').trim()
  const category = String(input.category ?? existing?.category ?? '').trim().toLowerCase()
  if (title.length < 3) throw badRequest('Activity title must contain at least 3 characters.', 'INVALID_TITLE')
  if (!categoryValues.has(category)) throw badRequest('Choose birthday, wedding or workshop.', 'INVALID_CATEGORY')
  const rawPrice = input.price !== undefined ? input.price : existing?.price
  const priceValue = rawPrice === '' || rawPrice == null ? null : Number(rawPrice)
  if (priceValue !== null && (!Number.isInteger(priceValue) || priceValue < 0 || priceValue > 10_000_000)) {
    throw badRequest('Enter a valid whole-rupee price or leave it blank for a custom quote.', 'INVALID_PRICE')
  }
  const imageUrl = String(input.imageUrl ?? input.image?.url ?? existing?.image?.url ?? '').trim()
  if (!/^https?:\/\//i.test(imageUrl)) throw badRequest('Add a valid activity image URL or upload an image.', 'INVALID_IMAGE')
  const guestPricingInput = input.guestPricing || existing?.guestPricing || {}
  const maxGuests = Number(guestPricingInput.maxGuests ?? 1000)
  const includedGuests = Number(guestPricingInput.includedGuests ?? 1)
  const percentage = Number(guestPricingInput.percentPerExtraGuest ?? 0)
  if (!Number.isInteger(maxGuests) || !Number.isInteger(includedGuests) || includedGuests < 1 || maxGuests < includedGuests) {
    throw badRequest('Guest limits are invalid.', 'INVALID_GUEST_LIMITS')
  }
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw badRequest('Extra guest percentage must be between 0 and 100.', 'INVALID_GUEST_PERCENTAGE')
  const locations = cleanTextList(input.locations ?? existing?.locations ?? serviceCities, 20)
  if (!locations.length || locations.some((city) => !serviceCities.includes(city))) throw badRequest('Choose at least one supported service city.', 'INVALID_LOCATIONS')
  return {
    slug: slugify(input.slug || existing?.slug || title),
    category,
    title,
    short: String(input.short ?? existing?.short ?? '').trim(),
    description: String(input.description ?? existing?.description ?? '').trim(),
    price: priceValue,
    priceUnit: String(input.priceUnit ?? existing?.priceUnit ?? 'per event').trim(),
    duration: String(input.duration ?? existing?.duration ?? '2 hrs').trim(),
    guestsLabel: String(input.guestsLabel ?? input.guests ?? existing?.guestsLabel ?? 'Group booking').trim(),
    locations,
    rating: input.rating ?? existing?.rating ?? null,
    reviews: Number(input.reviews ?? existing?.reviews ?? 0),
    badge: String(input.badge ?? existing?.badge ?? 'New').trim(),
    minLeadDays: Math.max(1, Number(input.minLeadDays ?? existing?.minLeadDays ?? 1)),
    image: { url: imageUrl, publicId: String(input.imagePublicId ?? input.image?.publicId ?? existing?.image?.publicId ?? '').trim() },
    gallery: Array.isArray(input.gallery) ? input.gallery.slice(0, 8) : existing?.gallery || [],
    includes: cleanTextList(input.includes ?? existing?.includes, 30),
    timeSlots: normalizeTimeSlots(input.timeSlots ?? existing?.timeSlots),
    guestPricing: { enabled: Boolean(guestPricingInput.enabled), includedGuests, percentPerExtraGuest: percentage, maxGuests },
    active: input.active === undefined ? (existing?.active ?? true) : Boolean(input.active),
  }
}

export function activityView(activity) {
  return {
    id: activity.slug,
    mongoId: activity._id.toString(),
    category: activity.category,
    title: activity.title,
    short: activity.short,
    description: activity.description,
    price: activity.price,
    priceUnit: activity.priceUnit,
    duration: activity.duration,
    guests: activity.guestsLabel,
    location: `${activity.locations.length} service ${activity.locations.length === 1 ? 'city' : 'cities'}`,
    locations: activity.locations,
    rating: activity.rating,
    reviews: activity.reviews,
    badge: activity.badge,
    minLeadDays: activity.minLeadDays,
    image: activity.image.url,
    imagePublicId: activity.image.publicId,
    gallery: activity.gallery,
    includes: activity.includes,
    timeSlots: activity.timeSlots.filter((slot) => slot.active !== false),
    guestPricing: activity.guestPricing,
    active: activity.active,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
  }
}

export async function listPublicActivities() {
  const items = await Activity.find({ active: true, deletedAt: null }).sort({ createdAt: 1 }).lean()
  return items.map(activityView)
}

export async function listAdminActivities() {
  const items = await Activity.find({ deletedAt: null }).sort({ createdAt: 1 }).lean()
  return items.map(activityView)
}

export async function getPublicActivity(slug) {
  const activity = await Activity.findOne({ slug, active: true, deletedAt: null }).lean()
  if (!activity) throw notFound('This activity is not available.', 'ACTIVITY_NOT_FOUND')
  return activityView(activity)
}

export async function createActivity(input, adminId) {
  const normalized = normalizeActivity(input)
  if (!normalized.short || !normalized.description) throw badRequest('Add both a short summary and a full description.', 'DESCRIPTION_REQUIRED')
  if (await Activity.exists({ slug: normalized.slug })) throw conflict('An activity with this name or slug already exists.', 'ACTIVITY_EXISTS')
  const activity = await Activity.create({ ...normalized, createdBy: adminId, updatedBy: adminId })
  return activityView(activity)
}

export async function updateActivity(slug, input, adminId) {
  const activity = await Activity.findOne({ slug, deletedAt: null })
  if (!activity) throw notFound('Activity not found.', 'ACTIVITY_NOT_FOUND')
  const normalized = normalizeActivity(input, activity)
  if (normalized.slug !== activity.slug && await Activity.exists({ slug: normalized.slug })) throw conflict('That activity slug is already in use.', 'ACTIVITY_EXISTS')
  Object.assign(activity, normalized, { updatedBy: adminId })
  await activity.save()
  return activityView(activity)
}

export async function archiveActivity(slug, adminId) {
  const activity = await Activity.findOneAndUpdate(
    { slug, deletedAt: null },
    { active: false, deletedAt: new Date(), updatedBy: adminId },
    { new: true },
  )
  if (!activity) throw notFound('Activity not found.', 'ACTIVITY_NOT_FOUND')
  return { id: activity.slug, archived: true }
}

export async function findBookableActivity(slug) {
  const activity = await Activity.findOne({ slug, active: true, deletedAt: null })
  if (!activity) throw notFound('This activity is not available.', 'ACTIVITY_NOT_FOUND')
  return activity
}

export function calculateGuestPrice(activity, guests) {
  if (activity.price == null) return { amount: null, baseAmount: null, adjustmentAmount: 0, extraGuests: 0 }
  const pricing = activity.guestPricing || {}
  const extraGuests = pricing.enabled ? Math.max(0, guests - Number(pricing.includedGuests || 1)) : 0
  const adjustmentAmount = Math.round(activity.price * Number(pricing.percentPerExtraGuest || 0) * extraGuests / 100)
  return { amount: activity.price + adjustmentAmount, baseAmount: activity.price, adjustmentAmount, extraGuests }
}
