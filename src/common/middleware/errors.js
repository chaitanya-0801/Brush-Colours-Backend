import mongoose from 'mongoose'
import { AppError } from '../errors/AppError.js'

export function notFoundHandler(req, res) {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} was not found.`, code: 'ROUTE_NOT_FOUND' })
}

export function errorHandler(error, _req, res, _next) {
  if (error instanceof AppError) {
    return res.status(error.status).json({ error: error.message, code: error.code, ...(error.details ? { details: error.details } : {}) })
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const details = Object.fromEntries(Object.entries(error.errors).map(([key, value]) => [key, value.message]))
    return res.status(400).json({ error: 'Please check the submitted details.', code: 'VALIDATION_FAILED', details })
  }
  if (error?.code === 11000) return res.status(409).json({ error: 'This value already exists.', code: 'DUPLICATE_VALUE' })
  if (error?.name === 'MulterError') return res.status(400).json({ error: error.message, code: 'UPLOAD_FAILED' })
  console.error(error)
  return res.status(500).json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' })
}
