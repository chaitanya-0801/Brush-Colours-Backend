import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDatabase(uri = env.mongoUri) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, {
    maxPoolSize: 10,
    minPoolSize: env.nodeEnv === 'production' ? 1 : 0,
    serverSelectionTimeoutMS: 10_000,
  })
  return mongoose.connection
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}

export function databaseHealth() {
  return { connected: mongoose.connection.readyState === 1, state: mongoose.connection.readyState }
}
