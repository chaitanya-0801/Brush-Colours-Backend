import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import { config } from './config.js'
import { seedActivities } from './activities.js'

export function createDatabase(databasePath = config.databasePath) {
  if (databasePath !== ':memory:') fs.mkdirSync(path.dirname(databasePath), { recursive: true })
  const db = new Database(databasePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('birthday', 'wedding', 'workshop')),
      price INTEGER,
      price_unit TEXT NOT NULL,
      min_lead_days INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      guests INTEGER NOT NULL,
      city TEXT NOT NULL,
      venue_address TEXT NOT NULL,
      contact_phone TEXT NOT NULL,
      amount INTEGER,
      deposit_amount INTEGER NOT NULL DEFAULT 299,
      amount_paid INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK (status IN ('quote_requested', 'payment_pending', 'confirmed', 'cancelled')),
      payment_status TEXT NOT NULL CHECK (payment_status IN ('not_required', 'pending', 'paid', 'failed', 'refunded')),
      payment_provider TEXT,
      payment_order_id TEXT,
      payment_order_amount INTEGER,
      payment_order_kind TEXT,
      payment_id TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_id) REFERENCES activities(id)
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON bookings(event_date);
    CREATE INDEX IF NOT EXISTS idx_bookings_paid_at ON bookings(paid_at);
  `)

  const bookingColumns = new Set(db.pragma('table_info(bookings)').map((column) => column.name))
  const bookingMigrations = [
    ['deposit_amount', 'ALTER TABLE bookings ADD COLUMN deposit_amount INTEGER NOT NULL DEFAULT 299'],
    ['amount_paid', 'ALTER TABLE bookings ADD COLUMN amount_paid INTEGER NOT NULL DEFAULT 0'],
    ['payment_order_amount', 'ALTER TABLE bookings ADD COLUMN payment_order_amount INTEGER'],
    ['payment_order_kind', 'ALTER TABLE bookings ADD COLUMN payment_order_kind TEXT'],
  ]
  for (const [column, statement] of bookingMigrations) {
    if (!bookingColumns.has(column)) db.exec(statement)
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS booking_payments (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('deposit', 'balance', 'legacy')),
      provider TEXT NOT NULL,
      provider_order_id TEXT UNIQUE,
      provider_payment_id TEXT,
      amount INTEGER NOT NULL CHECK (amount > 0),
      paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_booking_payments_booking ON booking_payments(booking_id);
    CREATE INDEX IF NOT EXISTS idx_booking_payments_paid_at ON booking_payments(paid_at);
  `)

  db.prepare(`
    UPDATE bookings
    SET amount_paid = COALESCE(amount, 0)
    WHERE payment_status = 'paid' AND amount_paid = 0
  `).run()

  db.prepare(`
    INSERT OR IGNORE INTO booking_payments (
      id, booking_id, kind, provider, provider_order_id, provider_payment_id, amount, paid_at
    )
    SELECT 'legacy-' || id, id, 'legacy', COALESCE(payment_provider, 'legacy'),
      payment_order_id, payment_id, amount, COALESCE(paid_at, created_at)
    FROM bookings
    WHERE payment_status = 'paid' AND amount IS NOT NULL AND amount > 0
  `).run()

  const insertActivity = db.prepare(`
    INSERT OR IGNORE INTO activities (id, title, category, price, price_unit, min_lead_days)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const seedAllActivities = db.transaction(() => {
    for (const activity of seedActivities) insertActivity.run(...activity)
  })
  seedAllActivities()

  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(config.adminEmail)
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(randomUUID(), config.adminName, config.adminEmail, bcrypt.hashSync(config.adminPassword, 12))
  }

  return db
}

export const db = createDatabase()
