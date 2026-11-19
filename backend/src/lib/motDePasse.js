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

module.exports = { motDePasseLisible, ALPHABET }
