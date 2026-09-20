# Brush&Colours backend

Express and SQLite API for customer accounts, protected admin access, bookings, activity pricing and monthly revenue.

## Run locally

1. Copy `.env.example` to `.env` and set a strong `JWT_SECRET` and admin password.
2. Run `npm install`.
3. Run `npm run dev`.
4. The API runs at `http://localhost:4000/api`.

The SQLite database is created automatically in `data/brush-colours.db`. The configured admin account is created on the first run and its password is stored only as a bcrypt hash.

## Payments

Local development uses an explicit test-payment flow when `ALLOW_DEMO_PAYMENTS=true`. For real payments, set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; the API creates and verifies Razorpay orders. Disable demo payments before production deployment.

## Important production settings

- Replace the development `JWT_SECRET` and temporary admin password.
- Use HTTPS and set `NODE_ENV=production`.
- Restrict `FRONTEND_ORIGINS` to the deployed website.
- Back up the SQLite database, or migrate to managed PostgreSQL when running multiple server instances.
