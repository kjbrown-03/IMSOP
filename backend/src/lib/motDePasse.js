const bcrypt = require('bcrypt')
const crypto = require('crypto')

// Un mot de passe envoyé par courriel est RECOPIÉ à la main, souvent depuis un
// téléphone. Le base64 mêlait « l » (L minuscule) et « I » (i majuscule), « O »
// et « 0 », que la police de Gmail rend identiques : un tradipraticien a reçu
// « OoKel5L2Y99VaL » et n'a jamais pu se connecter. On tire donc dans un
// alphabet sans aucun caractère ambigu (ni 0 O o, 1 l I i, 5 S s, 2 Z z, 8 B).
const ALPHABET = 'abcdefghjkmnpqrtuvwxyACDEFGHJKLMNPQRTUVWXY3469'

// 14 caractères sur 46 symboles : environ 77 bits, autant que les 14
// caractères base64 d'avant, à peu de chose près.
function motDePasseLisible(longueur = 14) {
  let resultat = ''
  for (let i = 0; i < longueur; i++) resultat += ALPHABET[crypto.randomInt(ALPHABET.length)]
  return resultat
}

/**
 * Compare un mot de passe saisi à son empreinte, en tolérant les blancs en
 * bordure.
 *
 * Un mot de passe copié depuis un courriel emporte souvent l'espace ou le retour
 * à la ligne qui le suit, invisible dans le champ. La connexion le tolérait déjà ;
 * le changement de mot de passe non : le navigateur, qui avait mémorisé la saisie
 * de la connexion avec son blanc, la reproposait dans « mot de passe actuel », et
 * le praticien lisait « mot de passe actuel incorrect » avec le bon mot de passe
 * sous les yeux. Les deux passent désormais par ici.
 *
 * La version rognée n'est essayée qu'en second, pour ne pas refuser celui qui
 * aurait délibérément choisi des espaces en bordure.
 */
async function motDePasseCorrespond(saisi, empreinte) {
  if (await bcrypt.compare(saisi, empreinte)) return true
  const rogne = saisi.trim()
  return rogne !== saisi && rogne.length > 0 && bcrypt.compare(rogne, empreinte)
}

module.exports = { motDePasseLisible, motDePasseCorrespond, ALPHABET }
