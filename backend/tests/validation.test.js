require('./helpers/env')
const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api, entete } = require('./helpers/http')
const f = require('./helpers/factories')

// La validation Zod est ce qui sépare une entrée malformée d'une erreur 500
// Prisma — et, pour les schémas `.strict()`, ce qui empêche un champ non prévu
// d'être transmis tel quel à la base. `updateDossier` passe explicitement
// `req.body` à Prisma en s'appuyant sur cette garantie : si `.strict()`
// disparaissait d'un schéma, la faille serait immédiate et silencieuse.
describe('Validation des entrées', () => {
  let patient

  beforeEach(async () => {
    await viderBase()
    patient = await f.creerPatient()
  })

  after(async () => {
    await viderBase()
    await fermerBase()
  })

  const creer = (corps) =>
    api().post('/api/dossiers').set('Authorization', entete(patient.user)).send(corps)

  const dossierValide = {
    specialiteRequise: 'Cardiologie',
    motif: 'Second avis sur un diagnostic de cardiopathie',
  }

  test('un corps valide est accepté', async () => {
    const res = await creer(dossierValide)
    assert.equal(res.status, 201)
  })

  test('un champ obligatoire manquant renvoie 400 et désigne le champ', async () => {
    const res = await creer({ specialiteRequise: 'Cardiologie' })

    assert.equal(res.status, 400)
    assert.equal(res.body.message, 'Requête invalide')
    assert.ok(Array.isArray(res.body.errors))
    assert.ok(
      res.body.errors.some((e) => e.field === 'motif'),
      `le champ fautif doit être nommé, reçu : ${JSON.stringify(res.body.errors)}`,
    )
  })

  test('un champ inconnu est rejeté, pas ignoré', async () => {
    const res = await creer({ ...dossierValide, status: 'RAPPORT_VALIDE' })

    assert.equal(res.status, 400)
    // Le rejet est ce qui compte : un simple filtrage silencieux laisserait
    // croire à l'appelant que son champ a été pris en compte.
    const cree = await prisma.dossier.count()
    assert.equal(cree, 0)
  })

  test('une valeur hors énumération est rejetée', async () => {
    const res = await creer({ ...dossierValide, urgence: 'TRES_URGENT' })
    assert.equal(res.status, 400)
  })

  test('une chaîne vide ne passe pas pour un texte obligatoire', async () => {
    const res = await creer({ ...dossierValide, motif: '   ' })
    assert.equal(res.status, 400)
  })

  test('un texte au-delà de la limite est rejeté', async () => {
    const res = await creer({ ...dossierValide, motif: 'a'.repeat(2001) })
    assert.equal(res.status, 400)
  })

  test('un identifiant qui n\'est pas un UUID renvoie 400, pas 500', async () => {
    const res = await api()
      .get('/api/dossiers/pas-un-uuid')
      .set('Authorization', entete(patient.user))

    assert.equal(res.status, 400)
  })

  test('un type invalide dans la pagination est rejeté', async () => {
    const res = await api()
      .get('/api/dossiers?pageSize=beaucoup')
      .set('Authorization', entete(patient.user))

    assert.equal(res.status, 400)
  })

  test('une pagination hors bornes est rejetée', async () => {
    const res = await api()
      .get('/api/dossiers?pageSize=5000')
      .set('Authorization', entete(patient.user))

    assert.equal(res.status, 400)
  })

  // Sans `.strict()` sur le schéma de mise à jour, ce corps écrirait
  // directement `status` en base et sauterait tout le workflow du CDC §52.
  test('un patient ne peut pas forcer le statut de son dossier par la mise à jour', async () => {
    const dossier = await f.creerDossier({ patient: patient.patient, status: 'BROUILLON' })

    const res = await api()
      .patch(`/api/dossiers/${dossier.id}`)
      .set('Authorization', entete(patient.user))
      .send({ status: 'RAPPORT_VALIDE' })

    assert.equal(res.status, 400)
    const apres = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(apres.status, 'BROUILLON')
  })

  test('une route inexistante renvoie un 404 JSON', async () => {
    const res = await api().get('/api/route-qui-nexiste-pas')
    assert.equal(res.status, 404)
    assert.ok(res.body.message)
  })
})
