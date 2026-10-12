/**
 * Pré-compresse les fichiers statiques du build.
 *
 * POURQUOI
 *
 * nginx sait compresser à la volée, mais il le refait pour chaque visiteur et
 * s'arrête au niveau 6 pour ne pas y passer trop de temps. Produire les `.gz`
 * ici permet d'aller au niveau 9 — une fois, à la construction — et
 * `gzip_static on` les sert tels quels, sans coût processeur par requête.
 *
 * Ça compte sur cette machine : deux cœurs, qui font déjà tourner la base, le
 * stockage objet, le relais d'appels et la transcription vocale.
 *
 * Les formats déjà compressés par nature (images, woff2, vidéos) sont laissés de
 * côté : les repasser au gzip les alourdirait.
 */
import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

const EXTENSIONS = new Set(['.js', '.css', '.html', '.json', '.svg', '.webmanifest', '.txt'])

// En dessous, le gain ne vaut pas le fichier supplémentaire — et nginx ne
// compresse pas non plus (gzip_min_length 1024).
const TAILLE_MINIMALE = 1024

const racine = resolve(process.argv[2] ?? 'dist')

function* fichiers(dossier) {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name)
    if (entree.isDirectory()) yield* fichiers(chemin)
    else if (entree.isFile()) yield chemin
  }
}

let traites = 0
let avant = 0
let apres = 0

for (const chemin of fichiers(racine)) {
  if (chemin.endsWith('.gz')) continue
  if (!EXTENSIONS.has(extname(chemin).toLowerCase())) continue

  const source = readFileSync(chemin)
  if (source.length < TAILLE_MINIMALE) continue

  const comprime = gzipSync(source, { level: 9 })
  // Un .gz plus gros que l'original n'aurait aucun intérêt, et nginx le servirait
  // en croyant bien faire.
  if (comprime.length >= source.length) continue

  writeFileSync(`${chemin}.gz`, comprime)
  traites += 1
  avant += source.length
  apres += comprime.length
}

const ko = (n) => `${Math.round(n / 1024)} Ko`
const gain = avant ? Math.round((1 - apres / avant) * 100) : 0
console.log(`pré-compression : ${traites} fichier(s), ${ko(avant)} → ${ko(apres)} (−${gain} %)`)
