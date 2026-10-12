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

// Mirrors every object currently in the documents bucket into a local folder.
// Not incremental - fine at this project's current volume, but worth revisiting
// (e.g. only copying new keys) once the bucket is large enough for a full daily
// copy to be slow.
//
// With no argument it writes a fresh timestamped folder, which is what the
// local retention scheme expects. Given an explicit `destination` it mirrors
// into that stable folder instead and DELETES local files that are no longer in
// the bucket - the mode used by the off-site backup, where history is kept by
// restic rather than by accumulating folders on the same disk.
//
// The deletion half is not an optimisation. These are medical documents: a file
// removed from the bucket (a patient exercising erasure, a candidate's CV being
// purged) must not survive indefinitely in a staging folder that then gets
// shipped off-site every night.
async function backupDocuments(destination) {
  await ensureBucket()
  const dir = destination || path.join(BACKUP_ROOT, 'documents', timestamp())
  const miroir = Boolean(destination)
  const vues = new Set()

  let continuationToken
  let count = 0
  do {
    const page = await s3.send(
      new ListObjectsV2Command({ Bucket: env.s3.bucket, ContinuationToken: continuationToken }),
    )
    for (const obj of page.Contents || []) {
      const dest = path.join(dir, obj.Key)
      vues.add(path.resolve(dest))
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

  let supprimes = 0
  if (miroir && fs.existsSync(dir)) {
    supprimes = elaguerMiroir(dir, vues)
  }

  console.log(
    `[backup] ${count} document(s) mirrored to ${dir}` +
      (miroir ? ` (${supprimes} stale file(s) removed)` : ''),
  )
  return dir
}

// Retire du miroir tout fichier absent du lot qu'on vient d'écrire, puis les
// dossiers devenus vides. Rien d'autre n'écrit dans ce dossier : ce qui n'a pas
// été vu à ce tour n'existe plus côté bucket.
function elaguerMiroir(dir, vues) {
  let supprimes = 0
  for (const entree of fs.readdirSync(dir, { withFileTypes: true })) {
    const complet = path.join(dir, entree.name)
    if (entree.isDirectory()) {
      supprimes += elaguerMiroir(complet, vues)
      if (fs.readdirSync(complet).length === 0) fs.rmdirSync(complet)
    } else if (!vues.has(path.resolve(complet))) {
      fs.rmSync(complet, { force: true })
      supprimes += 1
    }
  }
  return supprimes
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
  // `--documents-vers <dossier>` : miroir des documents seulement, dans un
  // dossier stable. C'est ce qu'appelle la sauvegarde hors site, qui tourne sur
  // l'hôte : le dump de la base y est fait directement avec le client Docker,
  // dont ce conteneur ne dispose pas.
  const i = process.argv.indexOf('--documents-vers')
  if (i !== -1) {
    const destination = process.argv[i + 1]
    if (!destination) {
      console.error('[backup] --documents-vers attend un chemin de dossier')
      process.exitCode = 1
      return
    }
    await backupDocuments(destination)
    return
  }

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
