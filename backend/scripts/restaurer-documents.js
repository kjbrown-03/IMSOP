#!/usr/bin/env node
// Remet dans le bucket les documents issus d'une sauvegarde.
//
// Le pendant de `backup.js --documents-vers` : celui-ci descend le bucket vers
// un dossier, celui-là remonte un dossier vers le bucket. La clé de chaque objet
// est son chemin relatif à la racine fournie — c'est exactement ce que la
// sauvegarde a écrit, donc les deux se referment l'un sur l'autre.
//
// Usage : node scripts/restaurer-documents.js <dossier> [--remplacer]
//
// Par défaut un objet déjà présent dans le bucket n'est PAS écrasé : on restaure
// le plus souvent après une perte partielle, et réécrire par-dessus des fichiers
// sains est un risque inutile. `--remplacer` force la réécriture.
//
// Voir docs/BACKUPS.md pour la procédure complète.

const fs = require('fs')
const path = require('path')
const { HeadObjectCommand } = require('@aws-sdk/client-s3')
const { s3, ensureBucket, putObject } = require('../src/lib/s3')
const env = require('../src/config/env')

const TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

function* fichiers(racine, prefixe = '') {
  for (const entree of fs.readdirSync(path.join(racine, prefixe), { withFileTypes: true })) {
    const relatif = path.join(prefixe, entree.name)
    if (entree.isDirectory()) {
      yield* fichiers(racine, relatif)
    } else if (entree.isFile()) {
      yield relatif
    }
  }
}

async function existe(cle) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: cle }))
    return true
  } catch {
    return false
  }
}

async function main() {
  const racine = process.argv[2]
  const remplacer = process.argv.includes('--remplacer')

  if (!racine) {
    console.error('Usage : node scripts/restaurer-documents.js <dossier> [--remplacer]')
    process.exitCode = 1
    return
  }
  if (!fs.existsSync(racine) || !fs.statSync(racine).isDirectory()) {
    console.error(`[restauration] ${racine} n'est pas un dossier.`)
    process.exitCode = 1
    return
  }

  await ensureBucket()

  let restaures = 0
  let ignores = 0
  let echecs = 0

  for (const relatif of fichiers(racine)) {
    // Les clés S3 utilisent toujours « / », y compris quand la restauration a eu
    // lieu sur une machine qui sépare ses chemins autrement.
    const cle = relatif.split(path.sep).join('/')

    if (!remplacer && (await existe(cle))) {
      ignores += 1
      continue
    }

    try {
      const type = TYPES[path.extname(cle).toLowerCase()] || 'application/octet-stream'
      await putObject(cle, fs.readFileSync(path.join(racine, relatif)), type)
      restaures += 1
    } catch (err) {
      console.error(`[restauration] ÉCHEC ${cle} : ${err.message}`)
      echecs += 1
    }
  }

  console.log(
    `[restauration] ${restaures} document(s) restauré(s), ` +
      `${ignores} déjà présent(s)${remplacer ? '' : ' (ignorés)'}, ${echecs} échec(s)`,
  )
  if (echecs > 0) process.exitCode = 1
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[restauration] interrompue :', err.message)
    process.exitCode = 1
  })
}

module.exports = { main }
