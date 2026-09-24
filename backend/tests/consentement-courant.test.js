require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerPatient, creerSpecialiste, creerDossier } = require('./helpers/factories')

// La table est append-only : révoquer ajoute une ligne, n'en efface aucune.
// Écrire directement en base laisse maîtriser l'horodatage, donc l'ordre — ce
// que l'API de création ne permet pas.
async function ecrireConsentement(dossierId, type, accepted, acceptedAt) {
  return prisma.consentement.create({
    data: { dossierId, type, accepted, acceptedAt },
  })
}

function parType(corps, type) {
  return corps.find((c) => c.type === type)
}

test.beforeEach(viderBase)
test.after(fermerBase)

test('Consentement — état courant', async (t) => {
  await t.test('les cinq types sont renvoyés même sans aucune ligne', async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/consentements/courants`)
      .set('Authorization', entete(user))
      .expect(200)

    assert.equal(res.body.length, 5)
    for (const entree of res.body) {
      // Jamais demandé : ni accepté, ni renseigné.
      assert.equal(entree.renseigne, false)
      assert.equal(entree.accepted, false)
      assert.equal(entree.decideLe, null)
    }
  })

  await t.test('un consentement donné ressort accepté', async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    await ecrireConsentement(dossier.id, 'TRAITEMENT_DONNEES', true, new Date('2026-08-01T10:00:00Z'))

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/consentements/courants`)
      .set('Authorization', entete(user))
      .expect(200)

    const entree = parType(res.body, 'TRAITEMENT_DONNEES')
    assert.equal(entree.renseigne, true)
    assert.equal(entree.accepted, true)
    assert.ok(entree.decideLe)
  })

  // Le cœur du sujet : sans ce calcul, l'historique rendu en vrac laissait
  // croire que le consentement tenait toujours.
  await t.test('une révocation postérieure fait foi', async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    await ecrireConsentement(dossier.id, 'COMMUNICATION_MEDECIN', true, new Date('2026-08-01T10:00:00Z'))
    await ecrireConsentement(dossier.id, 'COMMUNICATION_MEDECIN', false, new Date('2026-08-20T10:00:00Z'))

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/consentements/courants`)
      .set('Authorization', entete(user))
      .expect(200)

    const entree = parType(res.body, 'COMMUNICATION_MEDECIN')
    assert.equal(entree.accepted, false)
    // Révoqué n'est pas « jamais demandé » : les deux valent false sur
    // `accepted`, et l'écran ne doit pas les présenter pareil.
    assert.equal(entree.renseigne, true)
  })

  await t.test('un accord redonné après révocation fait foi à son tour', async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    await ecrireConsentement(dossier.id, 'TELECONSULTATION', true, new Date('2026-08-01T10:00:00Z'))
    await ecrireConsentement(dossier.id, 'TELECONSULTATION', false, new Date('2026-08-10T10:00:00Z'))
    await ecrireConsentement(dossier.id, 'TELECONSULTATION', true, new Date('2026-08-25T10:00:00Z'))

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/consentements/courants`)
      .set('Authorization', entete(user))
      .expect(200)

    assert.equal(parType(res.body, 'TELECONSULTATION').accepted, true)
  })

  await t.test('chaque type est indépendant des autres', async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    await ecrireConsentement(dossier.id, 'TRAITEMENT_DONNEES', true, new Date('2026-08-01T10:00:00Z'))
    await ecrireConsentement(dossier.id, 'COMMUNICATION_MEDECIN', false, new Date('2026-08-02T10:00:00Z'))

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/consentements/courants`)
      .set('Authorization', entete(user))
      .expect(200)

    assert.equal(parType(res.body, 'TRAITEMENT_DONNEES').accepted, true)
    assert.equal(parType(res.body, 'COMMUNICATION_MEDECIN').accepted, false)
    assert.equal(parType(res.body, 'UTILISATION_ANONYMISEE_RECHERCHE').renseigne, false)
  })

  await t.test("le consentement d'un autre dossier n'interfère pas", async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    const autreDossier = await creerDossier({ patient })
    await ecrireConsentement(autreDossier.id, 'TRAITEMENT_DONNEES', true, new Date('2026-08-01T10:00:00Z'))

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/consentements/courants`)
      .set('Authorization', entete(user))
      .expect(200)

    assert.equal(parType(res.body, 'TRAITEMENT_DONNEES').renseigne, false)
  })

  await t.test('un tiers sans accès au dossier est refusé', async () => {
    const { patient } = await creerPatient()
    const { user: specialisteUser } = await creerSpecialiste()
    const dossier = await creerDossier({ patient })

    await api()
      .get(`/api/dossiers/${dossier.id}/consentements/courants`)
      .set('Authorization', entete(specialisteUser))
      .expect(403)
  })

  await t.test("l'historique complet reste disponible sur la route d'origine", async () => {
    const { user, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    await ecrireConsentement(dossier.id, 'COMMUNICATION_MEDECIN', true, new Date('2026-08-01T10:00:00Z'))
    await ecrireConsentement(dossier.id, 'COMMUNICATION_MEDECIN', false, new Date('2026-08-20T10:00:00Z'))

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/consentements`)
      .set('Authorization', entete(user))
      .expect(200)

    // L'audit doit continuer de voir les deux lignes : c'est la preuve du
    // revirement, on ne la remplace pas par l'état courant.
    assert.equal(res.body.length, 2)
  })
})
