#!/usr/bin/env node
// Restores a database backup produced by scripts/backup.js.
//
// DESTRUCTIVE: replaces every table in the "imsop" database with the
// contents of the chosen dump. Only ever run this deliberately - never
// wire it into an automated job.
//
// Usage:
//   node scripts/restore.js                       (restores the most recent backup)
//   node scripts/restore.js backups/database/imsop-2026-08-20T02-00-00-000Z.dump

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const BACKEND_DIR = path.join(__dirname, '..')
const BACKUP_ROOT = process.env.BACKUP_DIR || path.join(BACKEND_DIR, 'backups')

function latestBackup() {
  const dir = path.join(BACKUP_ROOT, 'database')
  if (!fs.existsSync(dir)) throw new Error(`No backups directory at ${dir}`)
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.dump')).sort()
  if (files.length === 0) throw new Error(`No database backups found in ${dir}`)
  return path.join(dir, files[files.length - 1])
}

function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close()
    resolve(answer.trim().toLowerCase())
  }))
}

function runRestore(file) {
  return new Promise((resolve, reject) => {
    const input = fs.createReadStream(file)
    const proc = spawn(
      'docker',
      ['compose', 'exec', '-T', 'postgres', 'pg_restore', '-U', 'imsop', '-d', 'imsop', '--clean', '--if-exists'],
      { cwd: BACKEND_DIR },
    )
    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk })
    input.pipe(proc.stdin)
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`pg_restore exited with code ${code}:\n${stderr.trim()}`))
      }
      resolve()
    })
  })
}

async function main() {
  const target = process.argv[2] ? path.resolve(process.argv[2]) : latestBackup()
  if (!fs.existsSync(target)) {
    throw new Error(`Backup file not found: ${target}`)
  }

  console.log(`This will REPLACE ALL DATA in the "imsop" database with:\n  ${target}\n`)
  const answer = await confirm('Type "yes" to continue: ')
  if (answer !== 'yes') {
    console.log('Aborted - no changes made.')
    return
  }

  await runRestore(target)
  console.log(`[restore] Database restored from ${target}`)
  console.log('[restore] Note: this only restores the database. If you also need the')
  console.log('[restore] documents from that point in time, copy them back into the')
  console.log('[restore] MinIO bucket manually from backups/documents/<matching timestamp>/.')
}

main().catch((err) => {
  console.error('[restore] FAILED:', err.message)
  process.exit(1)
})
