import PDFDocument from 'pdfkit'
import { bookingView } from './booking.view.js'

const money = (value) => `Rs ${new Intl.NumberFormat('en-IN').format(Number(value || 0))}`

export function createReceiptPdf(booking) {
  const view = bookingView(booking)
  const document = new PDFDocument({ size: 'A4', margin: 52, info: { Title: `Brush&Colours receipt ${view.id}` } })
  const chunks = []
  document.on('data', (chunk) => chunks.push(chunk))
  const promise = new Promise((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)
  })
  document.fillColor('#1b1a18').font('Helvetica-Bold').fontSize(22).text('BRUSH & COLOURS')
  document.fillColor('#df7658').fontSize(10).text('BOOKING RECEIPT', { characterSpacing: 2 })
  document.moveDown(1.2).strokeColor('#e7ddd3').moveTo(52, document.y).lineTo(543, document.y).stroke()
  document.moveDown().fillColor('#1b1a18').fontSize(20).text(view.activityTitle)
  document.font('Helvetica').fontSize(10).fillColor('#6f6861')
  document.text(`Booking reference: ${view.id}`)
  document.text(`Customer: ${view.customerName} (${view.customerEmail})`)
  document.text(`Event: ${view.eventDate}, ${view.eventTime}`)
  document.text(`Location: ${view.city} - ${view.venueAddress}`)
  document.text(`Guests: ${view.guests}`)
  document.moveDown(1.2)
  const startY = document.y
  const rows = [
    ['Total', view.amount == null ? 'Final quote pending' : money(view.amount)],
    ['Pre-booking amount', money(view.depositAmount)],
    ['Amount received', money(view.amountPaid)],
    ['Balance', view.balanceAmount == null ? 'To be confirmed' : money(view.balanceAmount)],
    ['Payment status', view.paymentStatus.replaceAll('_', ' ')],
  ]
  rows.forEach(([label, value], index) => {
    const y = startY + index * 28
    document.rect(52, y, 491, 28).fill(index % 2 ? '#fbf7f2' : '#f3ece5')
    document.fillColor('#4f4943').font('Helvetica').fontSize(10).text(label, 64, y + 9)
    document.fillColor('#1b1a18').font('Helvetica-Bold').text(value, 320, y + 9, { width: 210, align: 'right' })
  })
  document.y = startY + rows.length * 28 + 24
  document.fillColor('#b6543e').font('Helvetica-Bold').fontSize(10).text('Cancellation policy')
  document.fillColor('#5f5953').font('Helvetica').fontSize(9.5).text(`The ${money(view.depositAmount)} pre-booking amount is non-refundable if the booking is cancelled. When the event is completed, it is credited toward the final amount and deducted from the balance.`)
  if (view.status === 'cancelled') document.moveDown().fillColor('#b6543e').font('Helvetica-Bold').text(`Cancelled - deposit retained: ${money(view.cancellation?.depositRetained)}`)
  document.moveDown(2).fillColor('#6f6861').font('Helvetica').fontSize(9).text('Brush&Colours | +91 63787 88998 | Thank you for creating with us.', { align: 'center' })
  document.end()
  return promise
}
