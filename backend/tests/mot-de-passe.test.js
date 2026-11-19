const test = require('node:test')
const assert = require('node:assert')
const { motDePasseLisible } = require('../src/lib/motDePasse')

// Un tradipraticien a reçu « OoKel5L2Y99VaL » par courriel : « l » ou « I » ?
// Impossible à dire dans la police de Gmail, et la connexion échouait.
test('le mot de passe envoyé par courriel ne contient aucun caractère ambigu', () => {
  for (let i = 0; i < 2000; i++) {
    const mdp = motDePasseLisible()
    assert.strictEqual(mdp.length, 14)
    assert.doesNotMatch(mdp, /[0Oo1lIi5Ss2Zz8B]/, mdp)
  }
})
