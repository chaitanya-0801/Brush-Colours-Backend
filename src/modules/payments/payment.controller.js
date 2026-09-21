import { badRequest } from '../../common/errors/AppError.js'
import { asyncHandler } from '../../common/middleware/asyncHandler.js'
import { Payment } from './payment.model.js'
import { captureProviderPayment, createPaymentOrder, verifyPayment } from './payment.service.js'
import { verifyWebhookSignature } from './razorpay.gateway.js'

export const createOrder = asyncHandler(async (req, res) => {
  res.json(await createPaymentOrder(req.user.id, String(req.body.bookingId || ''), req.body.paymentKind))
})

export const verify = asyncHandler(async (req, res) => {
  const booking = await verifyPayment({
    userId: req.user.id,
    bookingReference: String(req.body.bookingId || ''),
    orderId: String(req.body.orderId || ''),
    paymentId: String(req.body.paymentId || ''),
    signature: String(req.body.signature || ''),
  })
  res.json({ booking })
})

export const razorpayWebhook = asyncHandler(async (req, res) => {
  const signature = req.get('x-razorpay-signature')
  if (!verifyWebhookSignature(req.body, signature)) throw badRequest('Invalid webhook signature.', 'INVALID_WEBHOOK_SIGNATURE')
  const event = JSON.parse(req.body.toString('utf8'))
  const entity = event.payload?.payment?.entity
  if (event.event === 'payment.captured' && entity?.order_id) await captureProviderPayment(entity.order_id, entity.id)
  if (event.event === 'payment.failed' && entity?.order_id) {
    await Payment.findOneAndUpdate({ providerOrderId: entity.order_id, status: 'created' }, { status: 'failed', failureReason: entity.error_description || 'Payment failed.' })
  }
  res.json({ ok: true })
})
