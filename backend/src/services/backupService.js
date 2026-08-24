const cron = require('node-cron')
const { backupDatabase, backupDocuments, pruneOldBackups } = require('../../scripts/backup')

async function runBackup() {
  try {
    await backupDatabase()
  } catch (err) {
    console.error('[backup] Database backup failed:', err.message)
  }
  try {
    await backupDocuments()
  } catch (err) {
    console.error('[backup] Document backup failed:', err.message)
  }
  pruneOldBackups('database')
  pruneOldBackups('documents')
}

function startBackupCron() {
  // Under PM2 cluster mode (ecosystem.config.js runs 8 workers in
  // production) every worker would otherwise schedule this and the backup
  // would run 8x a day. PM2 sets NODE_APP_INSTANCE per worker - only
  // instance 0 runs it. In dev (plain `node`/nodemon, no PM2) this is
  // unset, so the single process runs it as normal.
  if (process.env.NODE_APP_INSTANCE && process.env.NODE_APP_INSTANCE !== '0') return

  // Runs once a day at 02:00 server time, ahead of the 03:00 messaging
  // auto-close job. This only guarantees a backup on days the backend
  // process happens to be up at that hour - it's a reasonable safety net
  // for local/pilot use, but a real production deployment should also (or
  // instead) schedule this at the OS/infra level, independent of app
  // uptime. See docs/BACKUPS.md.
  cron.schedule('0 2 * * *', () => {
    runBackup().catch((err) => console.error('[backup] cron run failed:', err))
  })
}

module.exports = { startBackupCron, runBackup }
