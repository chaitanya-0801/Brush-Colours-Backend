import { v2 as cloudinary } from 'cloudinary'
import { env, uploadsConfigured } from '../../config/env.js'
import { AppError } from '../../common/errors/AppError.js'

cloudinary.config({ cloud_name: env.cloudinaryCloudName, api_key: env.cloudinaryApiKey, api_secret: env.cloudinaryApiSecret, secure: true })

export function uploadActivityImage(file) {
  if (!uploadsConfigured()) throw new AppError(503, 'Image uploads are not configured. Add the three CLOUDINARY variables on Railway.', 'UPLOADS_NOT_CONFIGURED')
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      folder: 'brush-colours/activities',
      resource_type: 'image',
      transformation: [{ width: 1800, height: 1400, crop: 'limit', quality: 'auto' }],
    }, (error, result) => {
      if (error) {
        console.error('Cloudinary activity image upload failed', {
          message: error.message,
          httpCode: error.http_code,
          name: error.name,
        })
        reject(new AppError(502, 'The image could not be uploaded. Please verify the Cloudinary credentials and try again.', 'IMAGE_UPLOAD_FAILED'))
      } else resolve({ url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height })
    })
    stream.end(file.buffer)
  })
}
