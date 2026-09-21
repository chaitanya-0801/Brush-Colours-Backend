import mongoose from 'mongoose'

const timeSlotSchema = new mongoose.Schema({
  id: { type: String, required: true, trim: true },
  label: { type: String, required: true, trim: true },
  start: { type: String, required: true, trim: true },
  end: { type: String, required: true, trim: true },
  active: { type: Boolean, default: true },
}, { _id: false })

const imageSchema = new mongoose.Schema({
  url: { type: String, required: true, trim: true },
  publicId: { type: String, trim: true },
}, { _id: false })

const activitySchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true, trim: true, lowercase: true },
  category: { type: String, required: true, enum: ['birthday', 'wedding', 'workshop'], index: true },
  title: { type: String, required: true, trim: true, maxlength: 140 },
  short: { type: String, required: true, trim: true, maxlength: 260 },
  description: { type: String, required: true, trim: true, maxlength: 4000 },
  price: { type: Number, min: 0, default: null },
  priceUnit: { type: String, required: true, trim: true, maxlength: 80 },
  duration: { type: String, required: true, trim: true, maxlength: 80 },
  guestsLabel: { type: String, required: true, trim: true, maxlength: 100 },
  locations: [{ type: String, trim: true }],
  rating: { type: Number, min: 0, max: 5, default: null },
  reviews: { type: Number, min: 0, default: 0 },
  badge: { type: String, trim: true, maxlength: 60, default: 'New' },
  minLeadDays: { type: Number, min: 1, max: 90, default: 1 },
  image: { type: imageSchema, required: true },
  gallery: { type: [imageSchema], default: [] },
  includes: [{ type: String, trim: true, maxlength: 160 }],
  timeSlots: { type: [timeSlotSchema], default: [] },
  guestPricing: {
    enabled: { type: Boolean, default: false },
    includedGuests: { type: Number, min: 1, default: 1 },
    percentPerExtraGuest: { type: Number, min: 0, max: 100, default: 0 },
    maxGuests: { type: Number, min: 1, max: 5000, default: 1000 },
  },
  active: { type: Boolean, default: true, index: true },
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

activitySchema.index({ active: 1, category: 1, createdAt: -1 })
activitySchema.index({ title: 'text', short: 'text', description: 'text' })

export const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema)
