import { Router } from 'express'
import multer from 'multer'
import { badRequest } from '../../common/errors/AppError.js'
import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { authenticate, requireAdmin } from '../auth/auth.middleware.js'
import { uploadActivityImage } from './upload.service.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
  },
})

export const uploadRouter = Router()
uploadRouter.use(authenticate, requireAdmin)
uploadRouter.post('/activity-image', upload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Choose a JPG, PNG or WebP image up to 5 MB.', 'IMAGE_REQUIRED')
  res.status(201).json({ image: await uploadActivityImage(req.file) })
}))
