/**
 * Tamponne le service worker construit avec une empreinte du build.
 *
 * POURQUOI CETTE ÉTAPE EXISTE
 *
 * Un navigateur ne réinstalle un service worker que si le fichier `sw.js` qu'il
 * reçoit diffère, ne serait-ce que d'un octet, de celui qu'il détient déjà. Tant
 * que `sw.js` portait une version écrite à la main, il restait identique d'un
 * déploiement à l'autre : `install` ne se redéclenchait jamais, `activate` ne
 * purgeait rien, et le cache de la toute première visite survivait indéfiniment.
 * Il contenait l'`index.html` d'origine, qui désigne un bundle que le serveur ne
 * sert plus — l'application démarrait donc tantôt à jour, tantôt périmée, selon
 * que le cache répondait ou non.
 *
 * POURQUOI UN SCRIPT ET NON UN PLUGIN VITE
 *
 * Vite recopie `public/` dans `dist/` après le hook `closeBundle`. Un plugin qui
 * écrit à ce moment-là voit son travail écrasé par la copie, sans la moindre
 * erreur. L'étape est donc séparée et lancée après `vite build`, ce qui la rend
 * indépendante de l'ordre interne des hooks.
 *
 * L'empreinte vient du contenu d'`index.html`, pas d'un horodatage : ce fichier
 * nomme les bundles, qui portent eux-mêmes le hachage de leur contenu. Il change
 * donc exactement quand le code change. Reconstruire sans rien modifier laisse le
 * service worker intact et évite une réinstallation inutile chez les visiteurs.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const JETON = '__EMPREINTE_BUILD__'
const sortie = resolve(process.argv[2] ?? 'dist')
const sw = join(sortie, 'sw.js')
const index = join(sortie, 'index.html')

// Aucune sortie discrète : un service worker livré sans empreinte fige
// l'application chez tous les visiteurs, et rien ne le signale avant qu'ils ne
// voient deux versions alterner.
for (const [chemin, role] of [
  [sw, 'le service worker'],
  [index, "l'index"],
]) {
  if (!existsSync(chemin)) {
    console.error(`versionner-sw : ${role} est introuvable à ${chemin}.`)
    process.exit(1)
  }
}

const source = readFileSync(sw, 'utf8')
if (!source.includes(JETON)) {
  console.error(
    `versionner-sw : le jeton ${JETON} a disparu de public/sw.js. ` +
      "Sans lui, le cache du service worker n'est plus versionné.",
  )
  process.exit(1)
}

const empreinte = createHash('sha256').update(readFileSync(index)).digest('hex').slice(0, 12)
writeFileSync(sw, source.replaceAll(JETON, empreinte))
console.log(`service worker versionné : imsop-${empreinte}`)
