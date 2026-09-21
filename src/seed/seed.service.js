import { Activity } from '../modules/activities/activity.model.js'
import { serviceCities } from '../config/env.js'
import { defaultActivities } from './defaultActivities.js'

const timeSlots = [
  { id: 'morning', label: '11:00 AM - 1:00 PM', start: '11:00', end: '13:00', active: true },
  { id: 'afternoon', label: '2:00 PM - 4:00 PM', start: '14:00', end: '16:00', active: true },
  { id: 'evening', label: '5:00 PM - 7:00 PM', start: '17:00', end: '19:00', active: true },
]

export async function seedActivitiesIfEmpty() {
  const operations = defaultActivities.map((item) => ({
    updateOne: {
      filter: { slug: item.id },
      update: {
        $setOnInsert: {
          slug: item.id,
          category: item.category,
          title: item.title,
          short: item.short,
          description: item.description,
          price: item.price,
          priceUnit: item.priceUnit,
          duration: item.duration,
          guestsLabel: item.guests,
          locations: serviceCities,
          rating: item.rating,
          reviews: item.reviews,
          badge: item.badge,
          minLeadDays: item.minLeadDays,
          image: { url: item.image },
          includes: item.includes,
          timeSlots,
          guestPricing: item.guestPricing || { enabled: false, includedGuests: 1, percentPerExtraGuest: 0, maxGuests: 1000 },
          active: true,
          deletedAt: null,
        },
      },
      upsert: true,
    },
  }))
  await Activity.bulkWrite(operations, { ordered: false })
}
