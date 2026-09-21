import mongoose from 'mongoose'

const groupInquirySchema = new mongoose.Schema({
  reference: { type: String, required: true, unique: true, index: true },
  fullName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  eventType: { type: String, required: true, trim: true, maxlength: 80, index: true },
  organizationName: { type: String, trim: true, maxlength: 160, default: '' },
  whatsappNumber: { type: String, required: true, trim: true, maxlength: 24 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, index: true },
  eventDate: { type: String, required: true, index: true },
  city: { type: String, required: true, trim: true, index: true },
  participants: { type: Number, required: true, min: 2, max: 5000 },
  activityPreference: { type: String, required: true, trim: true, maxlength: 180 },
  details: { type: String, required: true, trim: true, minlength: 10, maxlength: 3000 },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
  statusUpdatedAt: Date,
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true })

groupInquirySchema.index({ createdAt: -1, status: 1 })

export const GroupInquiry = mongoose.models.GroupInquiry || mongoose.model('GroupInquiry', groupInquirySchema)
