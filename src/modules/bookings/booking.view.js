export function bookingView(booking) {
  const amount = booking.amount ?? null
  const amountPaid = Number(booking.amountPaid || 0)
  return {
    id: booking.reference,
    activityId: booking.activitySnapshot.slug,
    activityTitle: booking.activitySnapshot.title,
    activityImage: booking.activitySnapshot.image,
    category: booking.activitySnapshot.category,
    eventDate: booking.eventDate,
    eventTime: booking.timeSlot.label,
    timeSlot: booking.timeSlot,
    guests: booking.guests,
    city: booking.city,
    venueAddress: booking.venueAddress,
    contactPhone: booking.contactPhone,
    customerName: booking.customer.name,
    customerEmail: booking.customer.email,
    baseAmount: booking.baseAmount ?? null,
    guestAdjustment: booking.guestAdjustment,
    amount,
    depositAmount: booking.depositAmount,
    amountPaid,
    balanceAmount: amount === null ? null : Math.max(amount - amountPaid, 0),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    cancellation: booking.cancellation,
    receiptUrl: `/api/bookings/${booking.reference}/receipt`,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  }
}
