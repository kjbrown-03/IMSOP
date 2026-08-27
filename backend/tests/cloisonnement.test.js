require('./helpers/env')
const { test, describe, before, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { viderBase, fermerBase } = require('./helpers/db')
const { api, entete } = require('./helpers/http')
const f = require('./helpers/factories')

// CDC §4.1 et §32 — le cloisonnement des dossiers médicaux.
//
// C'est l'invariant le plus coûteux à casser du projet : une régression ici ne
// produit pas une page cassée mais une fuite de données de santé, silencieuse.
// Chaque titre d'accès prévu est vérifié positivement ET négativement, parce
// qu'un contrôle qui autorise tout le monde passe très bien un test qui ne
// vérifie que le cas nominal.
describe('Cloisonnement des dossiers', () => {
  let proprietaire, autrePatient, dossier

  before(async () => {
    await viderBase()
  })

  beforeEach(async () => {
    await viderBase()
    proprietaire = await f.creerPatient()
    autrePatient = await f.creerPatient()
    dossier = await f.creerDossier({ patient: proprietaire.patient })
  })

  after(async () => {
    await viderBase()
    await fermerBase()
  })

  test('sans jeton, la lecture est refusée', async () => {
    const res = await api().get(`/api/dossiers/${dossier.id}`)
    assert.equal(res.status, 401)
  })

  test('avec un jeton invalide, la lecture est refusée', async () => {
    const res = await api()
      .get(`/api/dossiers/${dossier.id}`)
      .set('Authorization', 'Bearer pas-un-jeton')
    assert.equal(res.status, 401)
  })

  test('le patient propriétaire lit son dossier', async () => {
    const res = await api()
      .get(`/api/dossiers/${dossier.id}`)
      .set('Authorization', entete(proprietaire.user))
    assert.equal(res.status, 200)
    assert.equal(res.body.id, dossier.id)
  })

  test("un autre patient ne lit pas le dossier d'autrui", async () => {
    const res = await api()
      .get(`/api/dossiers/${dossier.id}`)
      .set('Authorization', entete(autrePatient.user))
    assert.equal(res.status, 403)
  })

  test('le spécialiste assigné lit le dossier', async () => {
    const { user, specialiste } = await f.creerSpecialiste()
    const assigne = await f.creerDossier({ patient: proprietaire.patient, specialiste, status: 'AFFECTE' })

    const res = await api().get(`/api/dossiers/${assigne.id}`).set('Authorization', entete(user))
    assert.equal(res.status, 200)
  })

  test('un spécialiste non assigné ne lit pas le dossier', async () => {
    const { user } = await f.creerSpecialiste()

    const res = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(user))
    assert.equal(res.status, 403)
  })

  test('le médecin traitant désigné par le patient lit le dossier', async () => {
    const { user, medecinLocal } = await f.creerMedecinLocal()
    const designe = await f.creerDossier({ patient: proprietaire.patient, medecinLocal })

    const res = await api().get(`/api/dossiers/${designe.id}`).set('Authorization', entete(user))
    assert.equal(res.status, 200)
  })

  test("le médecin à l'origine de la demande lit son propre dossier", async () => {
    const { user, medecinLocal } = await f.creerMedecinLocal()
    const demande = await f.creerDossier({ demandeurMedecin: medecinLocal, patientAge: 54, patientSexe: 'homme' })

    const res = await api().get(`/api/dossiers/${demande.id}`).set('Authorization', entete(user))
    assert.equal(res.status, 200)
  })

  test('un médecin ni désigné ni demandeur ne lit pas le dossier', async () => {
    const { user } = await f.creerMedecinLocal()

    const res = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(user))
    assert.equal(res.status, 403)
  })

  test('le coordinateur et un administrateur lisent tout dossier', async () => {
    const coordinateur = await f.creerCoordinateur()
    const admin = await f.creerAdmin()

    for (const compte of [coordinateur, admin]) {
      const res = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(compte))
      assert.equal(res.status, 200, `${compte.role} devrait pouvoir lire le dossier`)
    }
  })

  test('un dossier inexistant renvoie 404, pas une fuite', async () => {
    const res = await api()
      .get('/api/dossiers/2c1f4b64-7f1a-4a5d-9d6b-2d3a1f0e5c77')
      .set('Authorization', entete(proprietaire.user))
    assert.equal(res.status, 404)
  })

  // La liste est le second chemin d'accès aux dossiers, avec sa propre clause
  // de filtrage : la vérifier séparément évite qu'un `GET /:id` bien gardé
  // masque une liste qui, elle, renvoie tout.
  describe('GET /api/dossiers ne renvoie que les dossiers accessibles', () => {
    test("un patient ne voit que les siens", async () => {
      await f.creerDossier({ patient: autrePatient.patient })

      const res = await api().get('/api/dossiers').set('Authorization', entete(proprietaire.user))
      assert.equal(res.status, 200)
      assert.equal(res.body.items.length, 1)
      assert.equal(res.body.items[0].id, dossier.id)
    })

    test('un spécialiste ne voit que les dossiers qui lui sont assignés', async () => {
      const { user, specialiste } = await f.creerSpecialiste()
      const sien = await f.creerDossier({ patient: autrePatient.patient, specialiste, status: 'AFFECTE' })

      const res = await api().get('/api/dossiers').set('Authorization', entete(user))
      assert.equal(res.status, 200)
      assert.deepEqual(
        res.body.items.map((d) => d.id),
        [sien.id],
      )
    })

    test('un médecin sans rattachement ne voit aucun dossier', async () => {
      const { user } = await f.creerMedecinLocal()

      const res = await api().get('/api/dossiers').set('Authorization', entete(user))
      assert.equal(res.status, 200)
      assert.equal(res.body.items.length, 0)
    })

    test('le coordinateur voit tous les dossiers', async () => {
      await f.creerDossier({ patient: autrePatient.patient })
      const coordinateur = await f.creerCoordinateur()

      const res = await api().get('/api/dossiers').set('Authorization', entete(coordinateur))
      assert.equal(res.status, 200)
      assert.equal(res.body.total, 2)
    })
  })

  // CDC §32 — le médecin traitant n'a aucun accès au paiement, et l'affectation
  // reste la prérogative de la coordination.
  describe('Actions réservées à un rôle', () => {
    test("un patient ne peut pas s'affecter un spécialiste", async () => {
      const { specialiste } = await f.creerSpecialiste()

      const res = await api()
        .post(`/api/dossiers/${dossier.id}/assigner`)
        .set('Authorization', entete(proprietaire.user))
        .send({ specialisteId: specialiste.id })

      assert.equal(res.status, 403)
    })

    test('un spécialiste ne peut pas affecter un dossier', async () => {
      const { user, specialiste } = await f.creerSpecialiste()

      const res = await api()
        .post(`/api/dossiers/${dossier.id}/assigner`)
        .set('Authorization', entete(user))
        .send({ specialisteId: specialiste.id })

      assert.equal(res.status, 403)
    })

    test('le coordinateur peut affecter un dossier', async () => {
      const coordinateur = await f.creerCoordinateur()
      const { specialiste } = await f.creerSpecialiste()

      const res = await api()
        .post(`/api/dossiers/${dossier.id}/assigner`)
        .set('Authorization', entete(coordinateur))
        .send({ specialisteId: specialiste.id })

      assert.equal(res.status, 200)
    })
  })
})
