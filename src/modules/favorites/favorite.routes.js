import { Router } from 'express'
import { authenticate, requireCustomer } from '../auth/auth.middleware.js'
import { deleteFavorite, saveFavorite } from './favorite.controller.js'

export const favoriteRouter = Router()

favoriteRouter.use(authenticate, requireCustomer)
favoriteRouter.post('/:activitySlug', saveFavorite)
favoriteRouter.delete('/:activitySlug', deleteFavorite)
