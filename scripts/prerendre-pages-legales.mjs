/**
 * Écrit une version lisible sans JavaScript des pages légales.
 *
 * POURQUOI
 *
 * Google a refusé la validation du branding OAuth avec le motif : « La page de
 * vos règles de confidentialité ne contient pas suffisamment de contenu. »
 *
 * Le contenu existe pourtant — 4000 caractères, sept sections — mais il est
 * construit par React au chargement. Le vérificateur de Google n'exécute pas le
 * JavaScript : il recevait l'écran d'attente et rien d'autre. Vérifié en
 * demandant la page avec l'agent de Googlebot — le mot « confidentialité »
 * n'apparaissait pas une seule fois dans la réponse.
 *
 * Ce n'est pas propre à Google : tout robot qui ne rend pas le JavaScript voyait
 * la même page vide, y compris les moteurs de recherche.
 *
 * COMMENT
 *
 * Pour chaque page légale, on écrit `dist/<chemin>/index.html` : le même
 * document que index.html, mais dont le `<div id="root">` contient le texte réel
 * au lieu de l'écran d'attente. nginx le sert directement (`try_files $uri $uri/`
 * passe avant le repli SPA), et le bundle s'y charge comme ailleurs : React
 * remplace ce contenu en montant, donc un visiteur humain voit l'application
 * normale.
 *
 * Le texte vient des mêmes traductions que les composants React : il ne peut pas
 * diverger de ce que lit un humain.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(racine, 'dist')

const fr = JSON.parse(readFileSync(join(racine, 'src/i18n/locales/fr.json'), 'utf8'))
const legal = fr.legal

/** Chemin public → (clé de traduction, sections à rendre dans l'ordre). */
const PAGES = {
  confidentialite: { cle: 'confidentialite', sections: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'] },
  conditions: { cle: 'conditions', sections: ['s1', 's2', 's3', 's4', 's5', 's6'] },
  'mentions-legales': { cle: 'mentions', sections: ['s1', 's2', 's3', 's4'] },
}

/** Le HTML est écrit à la main : on n'échappe que ce qui vient des traductions. */
function echapper(texte) {
  return String(texte)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function rendreBloc(valeur) {
  if (Array.isArray(valeur)) {
    return `<ul>${valeur.map((item) => `<li>${echapper(item)}</li>`).join('')}</ul>`
  }
  return `<p>${echapper(valeur)}</p>`
}

function rendreSection(donnees, cle) {
  const section = donnees[cle]
  if (!section) return ''
  const corps = ['p1', 'liste', 'p2']
    .filter((champ) => section[champ] !== undefined)
    .map((champ) => rendreBloc(section[champ]))
    .join('')
  return `<section><h2>${echapper(section.titre)}</h2>${corps}</section>`
}

const gabarit = readFileSync(join(dist, 'index.html'), 'utf8')

// Le bloc à remplacer : tout l'intérieur de #root, c'est-à-dire l'écran
// d'attente. On garde le <div id="root"> lui-même, que React cherche au montage.
const DEBUT = '<div id="root">'
const FIN = '</div>\n  </body>'

let ecrites = 0
for (const [chemin, { cle, sections }] of Object.entries(PAGES)) {
  const donnees = legal[cle]
  if (!donnees) {
    console.warn(`prerendre : aucune traduction pour « ${cle} », page ignorée`)
    continue
  }

  const contenu =
    `<main>` +
    `<h1>${echapper(donnees.titre)}</h1>` +
    `<p>${echapper(donnees.chapeau)}</p>` +
    sections.map((s) => rendreSection(donnees, s)).join('') +
    (legal.majDate ? `<p>${echapper(legal.majDate)}</p>` : '') +
    `</main>`

  const debut = gabarit.indexOf(DEBUT)
  const fin = gabarit.indexOf(FIN)
  if (debut === -1 || fin === -1) {
    console.error('prerendre : structure de index.html inattendue, abandon')
    process.exit(1)
  }

  const page =
    gabarit.slice(0, debut + DEBUT.length) +
    contenu +
    gabarit.slice(fin)

  const dossier = join(dist, chemin)
  mkdirSync(dossier, { recursive: true })
  writeFileSync(join(dossier, 'index.html'), page)
  ecrites += 1
}

console.log(`pages légales pré-rendues : ${ecrites}`)
