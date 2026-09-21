import { createApp } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env, validateProductionEnv } from './config/env.js'
import { ensureAdmin } from './modules/auth/auth.service.js'
import { seedActivitiesIfEmpty } from './seed/seed.service.js'

validateProductionEnv()
await connectDatabase()
await seedActivitiesIfEmpty()
await ensureAdmin()

const server = createApp().listen(env.port, () => {
  console.log(`Brush&Colours API listening on port ${env.port} with MongoDB`)
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`${signal} received; closing the API.`)
  server.close(async () => {
    await disconnectDatabase()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error)
  shutdown('unhandledRejection')
})
