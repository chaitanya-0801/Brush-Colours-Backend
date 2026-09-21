# Brush&Colours API

Production-structured Express API backed by MongoDB. It provides customer authentication, database-managed activities and time slots, bookings, Razorpay payments, PDF receipts, cancellation/refund tracking, and an admin dashboard.

## Architecture

```text
src/
├── common/
│   ├── errors/              # Typed HTTP errors
│   ├── middleware/          # Async, 404 and central error handling
│   └── utils/               # Dates and public references
├── config/
│   ├── database.js          # Mongoose connection and health
│   └── env.js               # Typed environment configuration
├── modules/
│   ├── auth/                # User model, secure cookies and role guards
│   ├── activities/          # Event CRUD, slots, cities and guest pricing
│   ├── bookings/            # Booking lifecycle and PDF receipts
│   ├── payments/            # Payment ledger, Razorpay and refunds
│   ├── admin/               # Dashboard, revenue and booking operations
│   └── uploads/             # Cloudinary activity-photo uploads
├── seed/                    # Initial activity catalogue (runs only on an empty DB)
├── app.js                   # HTTP middleware and route composition
└── server.js                # Startup, seeding and graceful shutdown
```

Each booking stores an activity, price, customer and slot snapshot. Later event edits therefore do not silently alter an existing booking.

## Local setup

1. Install MongoDB locally or create a MongoDB Atlas database.
2. Copy `.env.example` to `.env`.
3. Set `MONGODB_URI`, a strong `JWT_SECRET`, and the initial admin credentials.
4. Run `npm install`.
5. Run `npm run dev`.

The API is available at `http://localhost:4000/api`. `GET /api/health` returns 200 only while MongoDB is connected.

## Required production variables

| Variable | Purpose |
| --- | --- |
| `NODE_ENV=production` | Enables secure production cookies and validation |
| `MONGODB_URI` | MongoDB Atlas/Railway connection string |
| `JWT_SECRET` | Random secret, at least 32 characters |
| `FRONTEND_ORIGINS` | Comma-separated allowed origins, for example `https://brush-colours.vercel.app` |
| `ADMIN_NAME` | Initial administrator display name |
| `ADMIN_EMAIL` | Initial administrator login |
| `ADMIN_PASSWORD` | Used only to create the admin when it does not exist |
| `PREBOOK_AMOUNT=299` | Non-refundable reservation amount |

For real payments add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET`. Configure Razorpay to send webhooks to `POST https://YOUR-API/api/payments/webhook/razorpay`.

For admin photo uploads add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. Without them, an admin can still use an HTTPS image URL.

Set `ALLOW_DEMO_PAYMENTS=false` in production. It exists only for local and automated testing.

## Business rules implemented

- Only customer accounts can create bookings or make payments. Admin accounts receive HTTP 403.
- The available cities, lead time, maximum guests and time slots are validated by the API, not trusted from the browser.
- Event titles, descriptions, photos, prices, cities, included items, visibility, slots and guest pricing are stored in MongoDB and controlled by admin.
- Additional-guest pricing is calculated from the base amount and percentage. Admin can later recalculate an existing booking with a new guest count and percentage.
- The pre-booking amount is ₹299 by default. It is credited toward the final balance when the event proceeds.
- If a customer cancels, the ₹299 deposit is retained. Captured balance payments become a refund due; admin confirms them as processed after refunding through the payment provider or cash.
- No external refund is triggered automatically. This prevents an accidental money transfer and provides a clear admin audit step.
- Every paid booking exposes an authenticated PDF receipt download.
- Monthly revenue comes from the payment ledger and subtracts processed refunds.

## Main API routes

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/activities
POST   /api/bookings
GET    /api/bookings/mine
POST   /api/bookings/:reference/cancel
GET    /api/bookings/:reference/receipt
POST   /api/payments/create-order
POST   /api/payments/verify

GET    /api/admin/dashboard
GET    /api/admin/bookings
PATCH  /api/admin/bookings/:reference/guests
PATCH  /api/admin/bookings/:reference/amount
PATCH  /api/admin/bookings/:reference/status
POST   /api/admin/bookings/:reference/settle-balance
POST   /api/admin/bookings/:reference/complete-refund
GET    /api/admin/activities
POST   /api/admin/activities
PATCH  /api/admin/activities/:slug
DELETE /api/admin/activities/:slug
POST   /api/admin/uploads/activity-image
```

## Deployment notes

- Use a managed MongoDB deployment that supports transactions, such as MongoDB Atlas.
- The old SQLite file and Railway volume are not read by this version. Existing users/bookings must be migrated separately if they need to be retained.
- Railway's start command remains `npm start`. Do not hard-code `PORT`; Railway supplies it.
- Keep a single public API service and use the Vercel `/api` rewrite already configured by the frontend.
- Enable Atlas backups and restrict database network access and credentials before accepting real payments.

## Verification

`npm test` runs an integration suite against a temporary MongoDB replica set. The first run downloads a MongoDB test binary. `npm run check` validates the server source syntax.
