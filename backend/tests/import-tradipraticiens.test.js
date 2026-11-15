require('./helpers/env')
const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api } = require('./helpers/http')

// Données inventées : la vraie cartographie n'est pas dans le dépôt.
const ENTREES = [
  { nom: 'Essai Un', telephones: ['+237690000001', '+237690000002'], region: 'Adamaoua', departement: 'Mbéré', arrondissement: 'Meiganga', district: 'district de Meiganga', aireSante: 'Meiganga publique', localite: 'Zandaba', maladies: ['typhoïde', 'tout maladie'], experience: 12 },
  { nom: 'Essai Deux', telephones: [], region: 'Adamaoua', departement: 'Vina', arrondissement: null, district: 'district de ndere rural', aireSante: null, localite: 'Wack', maladies: ['fracture'], experience: null },
]

function lancer(...args) {
  const fichier = path.join(os.tmpdir(), `tps-essai-${process.pid}.json`)
  fs.writeFileSync(fichier, JSON.stringify(ENTREES))
  return execFileSync('node', ['scripts/importer-tradipraticiens.js', fichier, ...args], { cwd: path.join(__dirname, '..'), env: process.env }).toString()
}

describe('Import des tradipraticiens', () => {
  beforeEach(viderBase)
  after(fermerBase)

  test('sans --ecrire, rien n\'est écrit', async () => {
    lancer()
    assert.equal(await prisma.medecinLocal.count(), 0)
  })

  test('import : traditionnels, visibles seulement avec un téléphone, sans doublon au second passage', async () => {
    lancer('--ecrire')
    lancer('--ecrire')
    const fiches = await prisma.medecinLocal.findMany({ include: { user: true }, orderBy: { user: { fullName: 'asc' } } })
    assert.equal(fiches.length, 2, 'relancer met à jour, ne duplique pas')
    const [deux, un] = fiches
    assert.equal(un.typePratique, 'TRADITIONNEL')
    assert.equal(un.annuaireVisible, true)
    assert.equal(un.arrondissement, 'Meiganga')
    assert.ok(un.annuaireSpecialites.includes('gastroenterologie'))
    assert.match(un.annuairePresentation, /Autre numéro : \+237690000002/)
    assert.equal(deux.annuaireVisible, false, 'sans téléphone, une mise en relation ne servirait à rien')
    assert.match(un.user.email, /\.invalid$/)
  })

  test('après paiement et choix, l\'adresse fictive n\'est pas montrée au patient', async () => {
    lancer('--ecrire')
    const r = await api().post('/api/annuaire/recherches')
      .send({ symptomes: 'J ai la typhoïde depuis une semaine', pays: 'cm', typePratique: 'TRADITIONNEL', region: 'Adamaoua', departement: 'Mbéré', arrondissement: 'Meiganga' })
      .expect(201)
    assert.equal(r.body.nombre, 1)
    await prisma.rechercheAnnuaire.update({ where: { id: r.body.id }, data: { statut: 'DEBLOQUEE', contactsPayes: 1 } })
    const choix = await api().post(`/api/annuaire/recherches/${r.body.id}/choisir/${r.body.resultats[0].id}`).expect(200)
    assert.equal(choix.body.resultats[0].telephone, '+237690000001')
    assert.equal(choix.body.resultats[0].email, null)
  })
})
