/**
 * Comparaison du nom tapé en signature avec celui du compte.
 *
 * Doublon assumé de `backend/src/lib/nomSignataire.js` : le navigateur et le
 * serveur ne partagent pas de module, et la règle doit être identique des deux
 * côtés. Celle-ci sert au retour immédiat pendant la saisie ; c'est la version
 * serveur qui fait foi — un contrôle uniquement côté navigateur se contourne
 * avec la console.
 *
 * Neutralisé : casse, accents, ponctuation, espaces multiples, civilités,
 * ordre des composants. Pas neutralisé : un nom différent, incomplet, ou en trop.
 */

const CIVILITES = new Set(['dr', 'pr', 'm', 'mr', 'mme', 'mlle', 'me', 'prof', 'docteur', 'professeur'])

function composants(valeur) {
  return String(valeur ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’\-.,]/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .filter((mot) => !CIVILITES.has(mot))
}

export function correspondAuTitulaire(saisi, officiel) {
  const a = composants(saisi)
  const b = composants(officiel)
  if (a.length === 0 || b.length === 0) return false
  if (a.length !== b.length) return false
  const trie = (l) => [...l].sort().join(' ')
  return trie(a) === trie(b)
}
