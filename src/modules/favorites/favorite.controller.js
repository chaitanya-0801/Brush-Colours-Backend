import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { publicUser } from '../auth/auth.service.js'
import { addFavorite, removeFavorite } from './favorite.service.js'

export const saveFavorite = asyncHandler(async (req, res) => {
  const user = await addFavorite(req.user.id, req.params.activitySlug)
  res.json({ user: publicUser(user) })
})

export const deleteFavorite = asyncHandler(async (req, res) => {
  const user = await removeFavorite(req.user.id, req.params.activitySlug)
  res.json({ user: publicUser(user) })
})
