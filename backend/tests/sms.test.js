require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { normaliserNumero, sendSms } = require('../src/lib/sms')

// Les numéros sont saisis à la main dans les profils. Sans normalisation, une
// passerelle SMS rejette la plupart des formes utilisées au quotidien.
test('SMS — normalisation des numéros', async (t) => {
  await t.test('un numéro local reçoit l\'indicatif du pays', () => {
    assert.equal(normaliserNumero('699000001', '237'), '+237699000001')
  })

  await t.test('les espaces et séparateurs sont ignorés', () => {
    assert.equal(normaliserNumero('6 99 00 00 01', '237'), '+237699000001')
    assert.equal(normaliserNumero('699-00.00 01', '237'), '+237699000001')
    assert.equal(normaliserNumero('(699) 000001', '237'), '+237699000001')
  })

  await t.test('le zéro de service saute une fois l\'indicatif posé', () => {
    assert.equal(normaliserNumero('0699000001', '237'), '+237699000001')
  })

  await t.test('un numéro déjà international est respecté', () => {
    assert.equal(normaliserNumero('+33612345678', '237'), '+33612345678')
    assert.equal(normaliserNumero('+237 699 00 00 01', '237'), '+237699000001')
  })

  await t.test('le préfixe 00 vaut le +', () => {
    assert.equal(normaliserNumero('0033612345678', '237'), '+33612345678')
  })

  await t.test('un indicatif différent est respecté', () => {
    assert.equal(normaliserNumero('0612345678', '33'), '+33612345678')
  })

  await t.test('une saisie inexploitable ne produit pas de numéro', () => {
    assert.equal(normaliserNumero(null), null)
    assert.equal(normaliserNumero(''), null)
    assert.equal(normaliserNumero('   '), null)
    assert.equal(normaliserNumero('abc'), null)
  })
})

test('SMS — envoi', async (t) => {
  // Un compte sans téléphone est le cas courant : ça ne doit rien casser.
  await t.test('un numéro absent est ignoré sans erreur', async () => {
    const res = await sendSms({ to: null, body: 'test' })
    assert.equal(res.skipped, true)
    assert.equal(res.raison, 'numero-absent')
  })

  // Sans passerelle configurée, le canal reste inerte : la plateforme doit
  // fonctionner sans contrat opérateur.
  await t.test('sans passerelle configurée, rien ne part', async () => {
    const res = await sendSms({ to: '699000001', body: 'test' })
    assert.equal(res.skipped, true)
  })
})
