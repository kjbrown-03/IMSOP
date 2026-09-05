/**
 * Comparaison du nom tapé en signature électronique avec celui du compte.
 *
 * La règle doit être stricte sur le fond — on ne signe pas sous un autre nom —
 * mais tolérante sur la forme, sinon elle bloque des signataires légitimes pour
 * des raisons qui n'ont rien de juridique : un accent absent du clavier, une
 * majuscule, un prénom et un nom saisis dans l'autre ordre, un « Dr. » que le
 * praticien met ou ne met pas.
 *
 * Ce qui est neutralisé : casse, accents, ponctuation, espaces multiples,
 * civilités, ordre des composants du nom.
 * Ce qui ne l'est pas : un nom différent, un nom incomplet, un nom en trop.
 */

const CIVILITES = new Set(['dr', 'pr', 'm', 'mr', 'mme', 'mlle', 'me', 'prof', 'docteur', 'professeur'])

function normaliser(valeur) {
  return String(valeur ?? '')
    .normalize('NFD')
    // Retire les diacritiques : « Ngô » et « Ngo » sont le même nom.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Traits d'union, apostrophes et points deviennent des séparateurs :
    // « Jean-Baptiste » et « Jean Baptiste » doivent concorder.
    .replace(/['’\-.,]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
}

function composants(valeur) {
  return normaliser(valeur).filter((mot) => !CIVILITES.has(mot))
}

/**
 * @returns {boolean} vrai si le nom saisi désigne bien le titulaire du compte.
 */
function correspondAuTitulaire(saisi, officiel) {
  const a = composants(saisi)
  const b = composants(officiel)
  // Un compte sans nom exploitable ne peut servir de référence : on refuse
  // plutôt que de laisser passer par défaut.
  if (a.length === 0 || b.length === 0) return false
  if (a.length !== b.length) return false
  const trie = (l) => [...l].sort().join(' ')
  return trie(a) === trie(b)
}

module.exports = { correspondAuTitulaire, normaliser, composants }
