import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true, index: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
  active: { type: Boolean, default: true },
  passwordChangedAt: Date,
}, { timestamps: true })

userSchema.set('toJSON', {
  transform(_doc, value) {
    value.id = value._id.toString()
    delete value._id
    delete value.__v
    delete value.passwordHash
    return value
  },
})

export const User = mongoose.models.User || mongoose.model('User', userSchema)
