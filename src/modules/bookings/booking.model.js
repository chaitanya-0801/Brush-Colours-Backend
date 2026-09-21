import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  activity: { type: mongoose.Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  activitySnapshot: {
    slug: { type: String, required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    image: { type: String, required: true },
    priceUnit: { type: String, required: true },
  },
  eventDate: { type: String, required: true, index: true },
  timeSlot: {
    id: { type: String, required: true },
    label: { type: String, required: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
  },
  guests: { type: Number, required: true, min: 1, max: 5000 },
  city: { type: String, required: true, index: true },
  venueAddress: { type: String, required: true, minlength: 8, maxlength: 600 },
  contactPhone: { type: String, required: true, maxlength: 24 },
  baseAmount: { type: Number, min: 0, default: null },
  guestAdjustment: {
    extraGuests: { type: Number, min: 0, default: 0 },
    percentagePerGuest: { type: Number, min: 0, default: 0 },
    amount: { type: Number, min: 0, default: 0 },
  },
  amount: { type: Number, min: 0, default: null },
  depositAmount: { type: Number, required: true, min: 0, default: 299 },
  amountPaid: { type: Number, required: true, min: 0, default: 0 },
  status: { type: String, enum: ['quote_requested', 'payment_pending', 'confirmed', 'completed', 'cancelled'], default: 'payment_pending', index: true },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'partially_refunded', 'refunded'], default: 'pending' },
  latestOrder: {
    provider: String,
    orderId: String,
    amount: Number,
    kind: String,
    createdAt: Date,
  },
  cancellation: {
    cancelledAt: Date,
    reason: String,
    depositRetained: { type: Number, default: 0 },
    refundableAmount: { type: Number, default: 0 },
    refundStatus: { type: String, enum: ['none', 'not_applicable', 'processed', 'pending', 'manual_required'], default: 'none' },
  },
  manualPriceReason: { type: String, maxlength: 300 },
}, { timestamps: true, optimisticConcurrency: true })

bookingSchema.index({ user: 1, createdAt: -1 })
bookingSchema.index({ eventDate: 1, status: 1 })
bookingSchema.index({ 'customer.email': 1 })

export const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema)
