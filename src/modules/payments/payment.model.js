import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
  bookingReference: { type: String, required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  kind: { type: String, enum: ['deposit', 'balance'], required: true },
  provider: { type: String, enum: ['razorpay', 'development', 'cash'], required: true },
  status: { type: String, enum: ['created', 'captured', 'failed', 'refund_pending', 'refunded', 'partially_refunded'], default: 'created', index: true },
  amount: { type: Number, required: true, min: 1 },
  providerOrderId: { type: String, sparse: true, unique: true, index: true },
  providerPaymentId: { type: String, sparse: true, unique: true, index: true },
  providerRefundIds: [{ type: String }],
  refundedAmount: { type: Number, min: 0, default: 0 },
  capturedAt: Date,
  refundedAt: Date,
  failureReason: String,
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

paymentSchema.index({ booking: 1, status: 1 })
paymentSchema.index({ capturedAt: 1, status: 1 })

export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema)
