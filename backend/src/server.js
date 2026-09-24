const app = require('./app')
const env = require('./config/env')
const { prisma } = require('./lib/prisma')
const { ensureBucket } = require('./lib/s3')
const { startMessagingCloseCron } = require('./services/messagingCloseService')
const { startBackupCron } = require('./services/backupService')
const { startHabilitationExpiryCron } = require('./services/habilitationExpiryService')
const { startDelaiReponseCron } = require('./services/delaiReponseService')
const { initCallSignaling } = require('./services/callSignalingService')

// A single uncaught error must never take the whole server down for every
// connected user - log it and fail fast so the process manager (PM2/Docker/
// systemd) restarts a fresh worker in seconds. The alternative (staying up
// in an unknown state) risks silently corrupting requests for everyone else.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception - exiting for a clean restart:', err)
  process.exit(1)
})
process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection - exiting for a clean restart:', err)
  process.exit(1)
})

async function start() {
  try {
    await ensureBucket()
  } catch (err) {
    console.warn('Could not ensure S3/MinIO bucket exists (is MinIO running?):', err.message)
  }

  startMessagingCloseCron()
  startBackupCron()
  startHabilitationExpiryCron()
  startDelaiReponseCron()

  const server = app.listen(env.port, env.host, () => {
    console.log(`IMSOP backend listening on ${env.host}:${env.port} (${env.nodeEnv})`)
  })

  initCallSignaling(server)

  // Let in-flight requests finish before the process actually exits, so a
  // deploy/restart under load doesn't cut off users mid-request.
  async function shutdown(signal) {
    console.log(`${signal} received, shutting down gracefully...`)
    server.close(async () => {
      await prisma.$disconnect()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start()
