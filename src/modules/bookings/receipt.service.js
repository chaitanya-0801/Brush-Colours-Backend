import PDFDocument from 'pdfkit'
import { bookingView } from './booking.view.js'

const money = (value) =>
  `₹${new Intl.NumberFormat('en-IN').format(Number(value || 0))}`

export function createReceiptPdf(booking) {
  const view = bookingView(booking)

  const document = new PDFDocument({
    size: 'A4',
    margin: 45,
    info: {
      Title: `Brush&Colours Receipt ${view.id}`,
      Author: 'Brush&Colours',
      Subject: 'Booking Receipt',
    },
  })

  const chunks = []

  document.on('data', (chunk) => chunks.push(chunk))

  const promise = new Promise((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)
  })

  // --------------------------------------------------
  // COLORS
  // --------------------------------------------------

  const colors = {
    dark: '#241F1B',
    text: '#49433E',
    muted: '#827A73',
    orange: '#D86F52',
    orangeDark: '#B9573E',
    cream: '#FAF6F1',
    light: '#F3ECE5',
    border: '#E6DDD5',
    white: '#FFFFFF',
    green: '#3C8C68',
    red: '#B95757',
  }

  const left = 45
  const right = 550
  const width = right - left

  // --------------------------------------------------
  // PAGE BACKGROUND
  // --------------------------------------------------

  document
    .rect(0, 0, 595, 842)
    .fill(colors.white)

  // Top accent
  document
    .rect(0, 0, 595, 7)
    .fill(colors.orange)

  // --------------------------------------------------
  // HEADER
  // --------------------------------------------------

  document
    .fillColor(colors.dark)
    .font('Helvetica-Bold')
    .fontSize(24)
    .text('BRUSH & COLOURS', left, 42)

  document
    .fillColor(colors.orange)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('CREATE • CELEBRATE • MEMORABLE', left, 71, {
      characterSpacing: 1.5,
    })

  // Receipt label
  document
    .roundedRect(408, 40, 142, 52, 8)
    .fill(colors.cream)

  document
    .fillColor(colors.orangeDark)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('BOOKING RECEIPT', 420, 52, {
      width: 118,
      align: 'center',
      characterSpacing: 1,
    })

  document
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text('Official payment record', 420, 69, {
      width: 118,
      align: 'center',
    })

  // Divider
  document
    .strokeColor(colors.border)
    .lineWidth(1)
    .moveTo(left, 108)
    .lineTo(right, 108)
    .stroke()

  // --------------------------------------------------
  // BOOKING TITLE
  // --------------------------------------------------

  document
    .fillColor(colors.dark)
    .font('Helvetica-Bold')
    .fontSize(19)
    .text(view.activityTitle || 'Event Booking', left, 130, {
      width: width,
    })

  document
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(9)
    .text(`Booking Reference  •  ${view.id}`, left, 157)

  // Status badge
  const statusText = view.paymentStatus
    ? view.paymentStatus.replaceAll('_', ' ').toUpperCase()
    : 'PENDING'

  const statusWidth = 105

  let statusColor = colors.orange

  if (
    ['PAID', 'COMPLETED', 'SUCCESS', 'CONFIRMED'].includes(
      statusText
    )
  ) {
    statusColor = colors.green
  }

  if (statusText.includes('CANCEL')) {
    statusColor = colors.red
  }

  document
    .roundedRect(right - statusWidth, 128, statusWidth, 27, 13)
    .fill(statusColor)

  document
    .fillColor(colors.white)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(statusText, right - statusWidth, 137, {
      width: statusWidth,
      align: 'center',
    })

  // --------------------------------------------------
  // CUSTOMER + EVENT DETAILS
  // --------------------------------------------------

  let y = 190

  document
    .fillColor(colors.dark)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('BOOKING DETAILS', left, y)

  y += 22

  document
    .roundedRect(left, y, width, 142, 10)
    .fill(colors.cream)

  const detailLeft = left + 18
  const detailRight = left + 270

  const drawDetail = (label, value, x, currentY, valueWidth = 210) => {
    document
      .fillColor(colors.muted)
      .font('Helvetica')
      .fontSize(8)
      .text(label.toUpperCase(), x, currentY)

    document
      .fillColor(colors.text)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(value || '-', x, currentY + 13, {
        width: valueWidth,
      })
  }

  drawDetail(
    'Customer',
    view.customerName,
    detailLeft,
    y + 18
  )

  drawDetail(
    'Email',
    view.customerEmail,
    detailRight,
    y + 18,
    220
  )

  drawDetail(
    'Event Date',
    view.eventDate,
    detailLeft,
    y + 58
  )

  drawDetail(
    'Event Time',
    view.eventTime,
    detailRight,
    y + 58
  )

  drawDetail(
    'Guests',
    String(view.guests ?? '-'),
    detailLeft,
    y + 98
  )

  drawDetail(
    'City',
    view.city,
    detailRight,
    y + 98
  )

  y += 165

  // Venue
  document
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(8)
    .text('VENUE / ADDRESS', left, y)

  document
    .fillColor(colors.text)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(
      `${view.city || ''} - ${view.venueAddress || '-'}`,
      left,
      y + 13,
      {
        width: width,
      }
    )

  y += 48

  // --------------------------------------------------
  // PAYMENT SUMMARY
  // --------------------------------------------------

  document
    .fillColor(colors.dark)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('PAYMENT SUMMARY', left, y)

  y += 20

  const rows = [
    [
      'Total Booking Amount',
      view.amount == null ? 'Final quote pending' : money(view.amount),
    ],
    ['Pre-booking Amount', money(view.depositAmount)],
    ['Amount Received', money(view.amountPaid)],
    [
      'Balance Due',
      view.balanceAmount == null
        ? 'To be confirmed'
        : money(view.balanceAmount),
    ],
  ]

  const rowHeight = 31
  const tableHeight = rows.length * rowHeight

  // Table background
  document
    .roundedRect(left, y, width, tableHeight, 8)
    .fill(colors.white)

  // Border
  document
    .roundedRect(left, y, width, tableHeight, 8)
    .strokeColor(colors.border)
    .lineWidth(1)
    .stroke()

  rows.forEach(([label, value], index) => {
    const rowY = y + index * rowHeight

    if (index % 2 === 0) {
      document
        .rect(left + 1, rowY + 1, width - 2, rowHeight - 1)
        .fill(colors.cream)
    }

    document
      .fillColor(colors.text)
      .font('Helvetica')
      .fontSize(9.5)
      .text(label, left + 15, rowY + 10)

    document
      .fillColor(
        label === 'Balance Due'
          ? colors.orangeDark
          : colors.dark
      )
      .font(
        label === 'Balance Due'
          ? 'Helvetica-Bold'
          : 'Helvetica-Bold'
      )
      .fontSize(9.5)
      .text(value, left + 285, rowY + 10, {
        width: width - 300,
        align: 'right',
      })
  })

  y += tableHeight + 18

  // --------------------------------------------------
  // BALANCE HIGHLIGHT
  // --------------------------------------------------

  if (view.balanceAmount != null) {
    document
      .roundedRect(left, y, width, 54, 9)
      .fill(colors.orange)

    document
      .fillColor(colors.white)
      .font('Helvetica')
      .fontSize(9)
      .text('BALANCE DUE', left + 18, y + 12)

    document
      .fillColor(colors.white)
      .font('Helvetica-Bold')
      .fontSize(17)
      .text(money(view.balanceAmount), left + 18, y + 27)

    document
      .fillColor('#FFF4EE')
      .font('Helvetica')
      .fontSize(8)
      .text('Please settle the remaining amount as agreed.', left + 250, y + 20, {
        width: 225,
        align: 'right',
      })

    y += 72
  }

  // --------------------------------------------------
  // CANCELLATION POLICY
  // --------------------------------------------------

  document
    .fillColor(colors.orangeDark)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('CANCELLATION POLICY', left, y)

  y += 17

  const policyText =
    `The ${money(view.depositAmount)} pre-booking amount is non-refundable if the booking is cancelled. ` +
    `When the event is completed, it is credited toward the final amount and deducted from the balance.`

  document
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(8.5)
    .text(policyText, left, y, {
      width: width,
      lineGap: 3,
    })

  y += 43

  // --------------------------------------------------
  // CANCELLED NOTICE
  // --------------------------------------------------

  if (view.status === 'cancelled') {
    document
      .roundedRect(left, y, width, 42, 7)
      .fill('#FDF0EE')

    document
      .fillColor(colors.red)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('BOOKING CANCELLED', left + 14, y + 9)

    document
      .fillColor('#754646')
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        `Deposit retained: ${money(
          view.cancellation?.depositRetained
        )}`,
        left + 14,
        y + 23
      )

    y += 58
  }

  // --------------------------------------------------
  // FOOTER
  // --------------------------------------------------

  const footerY = 775

  document
    .strokeColor(colors.border)
    .lineWidth(1)
    .moveTo(left, footerY)
    .lineTo(right, footerY)
    .stroke()

  document
    .fillColor(colors.dark)
    .font('Helvetica-Bold')
    .fontSize(9)
    .text('BRUSH & COLOURS', left, footerY + 13)

  document
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(
      '+91 63787 88998  •  Thank you for creating with us.',
      left,
      footerY + 27
    )

  document
    .fillColor(colors.muted)
    .font('Helvetica')
    .fontSize(7.5)
    .text(
      'This is a computer-generated receipt and does not require a signature.',
      right - 280,
      footerY + 19,
      {
        width: 280,
        align: 'right',
      }
    )

  // Bottom accent
  document
    .rect(0, 835, 595, 7)
    .fill(colors.orange)

  document.end()

  return promise
}