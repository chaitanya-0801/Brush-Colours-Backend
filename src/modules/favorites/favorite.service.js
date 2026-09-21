import { notFound } from '../../common/errors/AppError.js'
import { Activity } from '../activities/activity.model.js'
import { User } from '../auth/user.model.js'

export async function addFavorite(userId, activitySlug) {
  const slug = String(activitySlug || '').trim().toLowerCase()
  const activityExists = await Activity.exists({ slug, active: true, deletedAt: null })
  if (!activityExists) throw notFound('This activity is not available.', 'ACTIVITY_NOT_FOUND')

  const user = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { favoriteActivityIds: slug } },
    { new: true },
  )
  if (!user) throw notFound('User account not found.', 'USER_NOT_FOUND')
  return user
}

export async function removeFavorite(userId, activitySlug) {
  const slug = String(activitySlug || '').trim().toLowerCase()
  const user = await User.findByIdAndUpdate(
    userId,
    { $pull: { favoriteActivityIds: slug } },
    { new: true },
  )
  if (!user) throw notFound('User account not found.', 'USER_NOT_FOUND')
  return user
}
