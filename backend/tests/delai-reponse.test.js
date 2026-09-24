require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerPatient, creerSpecialiste, creerCoordinateur, creerDossier } = require('./helpers/factories')
const { niveauDelai, echeanceDe, envoyerAlertesDelai } = require('../src/services/delaiReponseService')

const HEURE = 3600 * 1000
const ilYA = (heures) => new Date(Date.now() - heures * HEURE)

test.beforeEach(viderBase)
test.after(fermerBase)

// Le chrono démarre à l'affectation et s'arrête quand le rapport devient
// lisible par le demandeur — pas à sa remise par le spécialiste.
test('Délai de réponse — niveaux', async (t) => {
  await t.test('un dossier récent est au vert', () => {
    assert.equal(niveauDelai(ilYA(2)), 'normal')
  })

  await t.test('juste avant la mi-parcours, encore au vert', () => {
    assert.equal(niveauDelai(ilYA(23)), 'normal')
  })

  await t.test('à la mi-parcours, il passe en alerte', () => {
    assert.equal(niveauDelai(ilYA(24)), 'alerte')
    assert.equal(niveauDelai(ilYA(47)), 'alerte')
  })

  await t.test("à l'échéance, il est dépassé", () => {
    assert.equal(niveauDelai(ilYA(48)), 'depasse')
    assert.equal(niveauDelai(ilYA(72)), 'depasse')
  })

  await t.test("sans affectation, il n'y a pas de chrono", () => {
    assert.equal(niveauDelai(null), null)
  })

  await t.test("l'échéance tombe 48 h après l'affectation", () => {
    const affecteLe = new Date('2026-09-01T10:00:00Z')
    assert.equal(echeanceDe(affecteLe).toISOString(), '2026-09-03T10:00:00.000Z')
  })
})

test('Délai de réponse — file suivie par la coordination', async (t) => {
  async function dossierAffecte(heuresEcoulees, status = 'EN_ANALYSE') {
    const { patient } = await creerPatient()
    const { specialiste } = await creerSpecialiste()
    return creerDossier({ patient, specialiste, status, assignedAt: ilYA(heuresEcoulees) })
  }

  await t.test('un dossier affecté apparaît avec son échéance', async () => {
    const coordinateur = await creerCoordinateur()
    const dossier = await dossierAffecte(5)

    const res = await api()
      .get('/api/dossiers/en-cours')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].id, dossier.id)
    assert.equal(res.body[0].delai.niveau, 'normal')
    assert.ok(res.body[0].delai.echeanceLe)
  })

  // Le chrono continue de courir tant que la coordination n'a pas validé :
  // c'est ce qui l'empêche de laisser dormir un rapport rendu à l'heure.
  await t.test('un rapport soumis mais non validé reste dans la file', async () => {
    const coordinateur = await creerCoordinateur()
    await dossierAffecte(30, 'RAPPORT_SOUMIS')

    const res = await api()
      .get('/api/dossiers/en-cours')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].delai.niveau, 'alerte')
  })

  await t.test('un dossier transmis sort de la file', async () => {
    const coordinateur = await creerCoordinateur()
    await dossierAffecte(10, 'RAPPORT_TRANSMIS')

    const res = await api()
      .get('/api/dossiers/en-cours')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.length, 0)
  })

  await t.test("un dossier jamais affecté n'y figure pas", async () => {
    const coordinateur = await creerCoordinateur()
    const { patient } = await creerPatient()
    await creerDossier({ patient, status: 'EN_ATTENTE_AFFECTATION' })

    const res = await api()
      .get('/api/dossiers/en-cours')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.equal(res.body.length, 0)
  })

  await t.test('les plus anciens passent en premier', async () => {
    const coordinateur = await creerCoordinateur()
    const recent = await dossierAffecte(2)
    const ancien = await dossierAffecte(40)

    const res = await api()
      .get('/api/dossiers/en-cours')
      .set('Authorization', entete(coordinateur))
      .expect(200)

    assert.deepEqual(res.body.map((d) => d.id), [ancien.id, recent.id])
  })

  await t.test('un spécialiste ne voit pas cette file', async () => {
    const { user } = await creerSpecialiste()

    await api().get('/api/dossiers/en-cours').set('Authorization', entete(user)).expect(403)
  })
})

test('Délai de réponse — alerte de mi-parcours', async (t) => {
  async function dossierAffecte(heuresEcoulees, status = 'EN_ANALYSE') {
    const { patient } = await creerPatient()
    const { specialiste } = await creerSpecialiste()
    return creerDossier({ patient, specialiste, status, assignedAt: ilYA(heuresEcoulees) })
  }

  await t.test('un dossier au-delà de 24 h déclenche une alerte', async () => {
    await creerCoordinateur()
    const dossier = await dossierAffecte(25)

    const { alertes } = await envoyerAlertesDelai()

    assert.equal(alertes, 1)
    const apres = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.ok(apres.alerteDelaiEnvoyeeLe)
  })

  await t.test("un dossier en deçà de 24 h n'alerte pas", async () => {
    await creerCoordinateur()
    await dossierAffecte(10)

    const { alertes } = await envoyerAlertesDelai()

    assert.equal(alertes, 0)
  })

  // Sans le témoin, la tâche horaire renverrait la même alerte à chaque
  // passage et la coordination cesserait de les lire.
  await t.test('la même alerte ne part pas deux fois', async () => {
    await creerCoordinateur()
    await dossierAffecte(30)

    assert.equal((await envoyerAlertesDelai()).alertes, 1)
    assert.equal((await envoyerAlertesDelai()).alertes, 0)
  })

  await t.test('un dossier déjà transmis ne déclenche rien', async () => {
    await creerCoordinateur()
    await dossierAffecte(60, 'RAPPORT_TRANSMIS')

    assert.equal((await envoyerAlertesDelai()).alertes, 0)
  })

  await t.test("l'alerte laisse une notification à chaque coordinateur", async () => {
    const premier = await creerCoordinateur()
    const second = await creerCoordinateur()
    await dossierAffecte(26)

    await envoyerAlertesDelai()

    for (const membre of [premier, second]) {
      const notification = await prisma.notification.findFirst({
        where: { userId: membre.id, type: 'DELAI_REPONSE_ALERTE' },
      })
      assert.ok(notification, 'chaque membre de la coordination doit être prévenu')
    }
  })
})
