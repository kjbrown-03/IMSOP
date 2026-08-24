#!/usr/bin/env node
// Backs up the two places IMSOP actually loses data from if something goes
// wrong: the Postgres database (patients, dossiers, messages, reports...)
// and the MinIO document store (uploaded medical files, generated report
// PDFs). Keeps the last BACKUP_RETENTION_DAYS days locally.
//
// Usage: node scripts/backup.js   (or `npm run backup` from backend/)
//
// See docs/BACKUPS.md for the restore procedure and why a production
// deployment needs to also ship these off this machine, not just keep them
// on the same disk as the database they're backing up.

const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const { ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3')
const { s3, ensureBucket } = require('../src/lib/s3')
const env = require('../src/config/env')

const BACKEND_DIR = path.join(__dirname, '..')
const BACKUP_ROOT = process.env.BACKUP_DIR || path.join(BACKEND_DIR, 'backups')
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '14', 10)

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

// Runs pg_dump *inside* the postgres container via `docker compose exec`, so
// this works with only Docker installed on the host - no separate Postgres
// client tools needed. Custom format (-Fc): compressed, and restorable with
// pg_restore regardless of table order/dependencies.
function backupDatabase() {
  return new Promise((resolve, reject) => {
    const dir = path.join(BACKUP_ROOT, 'database')
    fs.mkdirSync(dir, { recursive: true })
    const file = path.join(dir, `imsop-${timestamp()}.dump`)
    const out = fs.createWriteStream(file)

    const proc = spawn(
      'docker',
      ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'imsop', '-Fc', 'imsop'],
      { cwd: BACKEND_DIR },
    )
    let stderr = ''
    proc.stderr.on('data', (chunk) => { stderr += chunk })
    proc.stdout.pipe(out)
    proc.on('error', reject)
    proc.on('close', (code) => {
      out.close()
      if (code !== 0) {
        fs.rmSync(file, { force: true })
        return reject(new Error(`pg_dump exited with code ${code}: ${stderr.trim()}`))
      }
      const sizeMb = (fs.statSync(file).size / 1024 / 1024).toFixed(2)
      console.log(`[backup] Database dumped to ${file} (${sizeMb} MB)`)
      resolve(file)
    })
  })
}

// Mirrors every object currently in the documents bucket into a timestamped
// local folder. Not incremental - fine at this project's current volume,
// but worth revisiting (e.g. only copying new keys) once the bucket is
// large enough for a full daily copy to be slow.
async function backupDocuments() {
  await ensureBucket()
  const dir = path.join(BACKUP_ROOT, 'documents', timestamp())

  let continuationToken
  let count = 0
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: env.s3.bucket, ContinuationToken: continuationToken }),
    )
    for (const obj of page.Contents || []) {
      const dest = path.join(dir, obj.Key)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const { Body } = await s3.send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: obj.Key }))
      await new Promise((resolve, reject) => {
        const out = fs.createWriteStream(dest)
        Body.pipe(out)
        Body.on('error', reject)
        out.on('finish', resolve)
        out.on('error', reject)
      })
      count += 1
    }
    continuationToken = page.NextContinuationToken
  } while (continuationToken)

  console.log(`[backup] ${count} document(s) mirrored to ${dir}`)
  return dir
}

function pruneOldBackups(subdir) {
  const dir = path.join(BACKUP_ROOT, subdir)
  if (!fs.existsSync(dir)) return
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.rmSync(full, { recursive: true, force: true })
      console.log(`[backup] Pruned old backup: ${full}`)
    }
  }
}

async function main() {
  console.log(`[backup] Starting IMSOP backup - ${new Date().toISOString()}`)
  let failed = false

  try {
    await backupDatabase()
  } catch (err) {
    console.error('[backup] Database backup FAILED:', err.message)
    failed = true
  }

  try {
    await backupDocuments()
  } catch (err) {
    console.error('[backup] Document backup FAILED:', err.message)
    failed = true
  }

  pruneOldBackups('database')
  pruneOldBackups('documents')
  console.log(`[backup] Done - ${new Date().toISOString()}`)
  if (failed) process.exitCode = 1
}

if (require.main === module) {
  main()
}

module.exports = { backupDatabase, backupDocuments, pruneOldBackups }
