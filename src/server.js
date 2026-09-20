import { createApp } from './app.js'
import { config } from './config.js'
import { db } from './db.js'

const app = createApp(db)
const server = app.listen(config.port, () => {
  console.log(`Brush&Colours API running at http://localhost:${config.port}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
