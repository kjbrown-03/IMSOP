require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

// Remplacé avant de charger l'application : notificationService garde sa propre
// référence à sendMail dès son chargement, un remplacement plus tardif n'y
// changerait rien et le test ne lirait aucun courriel.
const mailer = require('../src/lib/mailer')
let courriels = []
mailer.sendMail = async (m) => { courriels.push(m); return { skipped: true } }

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const {
  creerPatient,
  creerSpecialiste,
  creerMedecinLocal,
  creerCoordinateur,
  creerAdmin,
  creerDossier,
} = require('./helpers/factories')

const PRECISIONS = 'Merci de préciser la date de votre dernière chimiothérapie.'

test.beforeEach(viderBase)
test.after(fermerBase)

test('Demande ouverte par un médecin, sans patient', async (t) => {
  await t.test("l'affectation réussit et prévient le médecin demandeur", async () => {
    const coordinateur = await creerCoordinateur()
    const { user: medecinUser, medecinLocal } = await creerMedecinLocal()
    const { specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ demandeurMedecin: medecinLocal, status: 'EN_ATTENTE_AFFECTATION' })

    await api()
      .post(`/api/dossiers/${dossier.id}/assigner`)
      .set('Authorization', entete(coordinateur))
      .send({ specialisteId: specialiste.id })
      .expect(200)

    const note = await prisma.notification.findFirst({ where: { userId: medecinUser.id, type: 'DOSSIER_AFFECTE' } })
    assert.ok(note, 'le médecin demandeur doit être prévenu')
  })

  await t.test('la demande de complément prévient le médecin demandeur, qui peut répondre', async () => {
    const { user: expert, specialiste } = await creerSpecialiste()
    const { user: medecinUser, medecinLocal } = await creerMedecinLocal()
    const dossier = await creerDossier({ demandeurMedecin: medecinLocal, specialiste, status: 'EN_ANALYSE' })

    await api()
      .post(`/api/dossiers/${dossier.id}/demander-complement`)
      .set('Authorization', entete(expert))
      .send({ precisions: PRECISIONS })
      .expect(200)

    assert.ok(await prisma.notification.findFirst({ where: { userId: medecinUser.id, type: 'COMPLEMENT_DEMANDE' } }))
    await api()
      .post(`/api/dossiers/${dossier.id}/complement-fourni`)
      .set('Authorization', entete(medecinUser))
      .send({ reponse: 'Mars 2026.' })
      .expect(200)
  })
})

test('Coordonnées du dossier', async (t) => {
  const contacts = (fiche) => [fiche?.user?.email, fiche?.user?.phone]

  await t.test("le spécialiste ne reçoit ni le téléphone ni l'e-mail du patient ou du médecin", async () => {
    const { user: patientUser, patient } = await creerPatient()
    await prisma.user.update({ where: { id: patientUser.id }, data: { phone: '+237699000001' } })
    const { medecinLocal } = await creerMedecinLocal()
    const { user: expert, specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ patient, medecinLocal, specialiste, status: 'EN_ANALYSE' })

    const detail = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(expert)).expect(200)
    const liste = await api().get('/api/dossiers').set('Authorization', entete(expert)).expect(200)

    for (const vue of [detail.body, liste.body.items[0]]) {
      assert.deepEqual(contacts(vue.patient), [undefined, undefined])
      assert.deepEqual(contacts(vue.medecinLocal), [undefined, undefined])
      assert.ok(vue.patient.user.fullName, 'le nom reste : il sert à détecter un conflit')
    }
    const brut = JSON.stringify(detail.body)
    assert.ok(!brut.includes(patientUser.email))
    assert.ok(!brut.includes('+237699000001'))
  })

  await t.test("le patient ne reçoit pas les coordonnées de l'expert", async () => {
    const { user: patientUser, patient } = await creerPatient()
    const { user: expert, specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ patient, specialiste, status: 'EN_ANALYSE' })

    const { body } = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(patientUser)).expect(200)
    assert.equal(body.specialiste.user.fullName, expert.fullName)
    assert.deepEqual(contacts(body.specialiste), [undefined, undefined])
    assert.equal(body.patient.user.email, patientUser.email, 'le patient garde ses propres coordonnées')
  })

  await t.test('la coordination garde les coordonnées', async () => {
    const coordinateur = await creerCoordinateur()
    const { user: patientUser, patient } = await creerPatient()
    const dossier = await creerDossier({ patient })
    const { body } = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(coordinateur)).expect(200)
    assert.equal(body.patient.user.email, patientUser.email)
  })
})

test('Spécialiste après la remise du rapport', async (t) => {
  for (const status of ['RAPPORT_SOUMIS', 'RAPPORT_VALIDE', 'RAPPORT_TRANSMIS', 'CLOTURE']) {
    await t.test(`refus et récusation sont fermés au statut ${status}`, async () => {
      const { patient } = await creerPatient()
      const { user, specialiste } = await creerSpecialiste()
      const dossier = await creerDossier({ patient, specialiste, status })

      await api().post(`/api/dossiers/${dossier.id}/refuser`).set('Authorization', entete(user)).send({}).expect(400)
      await api()
        .post(`/api/dossiers/${dossier.id}/conflit-interets`)
        .set('Authorization', entete(user))
        .send({ motif: "J'ai opéré ce patient il y a deux ans, je me récuse." })
        .expect(400)

      const relu = await prisma.dossier.findUnique({ where: { id: dossier.id } })
      assert.equal(relu.status, status)
      assert.equal(relu.specialisteId, specialiste.id)
    })
  }

  await t.test('le refus reste possible avant la remise', async () => {
    const { patient } = await creerPatient()
    const { user, specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ patient, specialiste, status: 'AFFECTE' })
    await api().post(`/api/dossiers/${dossier.id}/refuser`).set('Authorization', entete(user)).send({}).expect(200)
  })
})

test('Demande de complément', async (t) => {
  t.beforeEach(() => { courriels = [] })

  async function demande() {
    const { user: patientUser, patient } = await creerPatient()
    const { user: expert, specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ patient, specialiste, status: 'EN_ANALYSE' })
    await api()
      .post(`/api/dossiers/${dossier.id}/demander-complement`)
      .set('Authorization', entete(expert))
      .send({ precisions: PRECISIONS })
      .expect(200)
    return { patientUser, expert, dossier }
  }

  await t.test('ni le courriel, ni la notification, ni le journal ne portent le texte médical', async () => {
    const { patientUser, dossier } = await demande()

    const auPatient = courriels.find((m) => m.to === patientUser.email)
    assert.ok(auPatient, 'le patient est prévenu')
    assert.doesNotMatch(JSON.stringify(auPatient), /chimioth/)
    assert.doesNotMatch(auPatient.text, /messagerie/, "il n'a pas accès à la messagerie")

    const note = await prisma.notification.findFirst({ where: { userId: patientUser.id, type: 'COMPLEMENT_DEMANDE' } })
    assert.doesNotMatch(JSON.stringify(note.payload), /chimioth/)

    const journal = await prisma.auditLog.findMany({ where: { dossierId: dossier.id } })
    assert.doesNotMatch(JSON.stringify(journal), /chimioth/)
  })

  await t.test('le patient lit la demande dans son espace, répond, et le praticien lit la réponse', async () => {
    const { patientUser, expert, dossier } = await demande()

    const lu = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(patientUser)).expect(200)
    assert.equal(lu.body.complementPrecisions, PRECISIONS)

    await api()
      .post(`/api/dossiers/${dossier.id}/complement-fourni`)
      .set('Authorization', entete(patientUser))
      .send({ reponse: 'En mars 2026.' })
      .expect(200)

    const relu = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', entete(expert)).expect(200)
    assert.equal(relu.body.status, 'EN_ANALYSE')
    assert.equal(relu.body.complementReponse, 'En mars 2026.')
  })

  await t.test('répondre sans texte reste possible : le complément peut être un document', async () => {
    const { patientUser, dossier } = await demande()
    await api()
      .post(`/api/dossiers/${dossier.id}/complement-fourni`)
      .set('Authorization', entete(patientUser))
      .send({})
      .expect(200)
  })

  await t.test('une nouvelle demande efface la réponse précédente', async () => {
    const { patientUser, expert, dossier } = await demande()
    await api()
      .post(`/api/dossiers/${dossier.id}/complement-fourni`)
      .set('Authorization', entete(patientUser))
      .send({ reponse: 'Première réponse.' })
      .expect(200)
    await api()
      .post(`/api/dossiers/${dossier.id}/demander-complement`)
      .set('Authorization', entete(expert))
      .send({ precisions: 'Autre question.' })
      .expect(200)
    const relu = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(relu.complementReponse, null)
    assert.equal(relu.complementPrecisions, 'Autre question.')
  })
})

test('Statistiques : les avis locaux comptent', async (t) => {
  await t.test('le médecin rédacteur figure dans le délai par praticien', async () => {
    const admin = await creerAdmin()
    const { patient } = await creerPatient()
    const { user: medecinUser, medecinLocal } = await creerMedecinLocal()
    const dossier = await creerDossier({
      patient,
      portee: 'LOCAL',
      medecinRedacteurId: medecinLocal.id,
      status: 'RAPPORT_TRANSMIS',
    })
    await prisma.rapport.create({
      data: { dossierId: dossier.id, medecinRedacteurId: medecinLocal.id, status: 'VALIDE', validatedAt: new Date() },
    })

    const { body } = await api().get('/api/admin/statistiques').set('Authorization', entete(admin)).expect(200)
    assert.ok(body.performance.delaiParSpecialiste.some((s) => s.nom === medecinUser.fullName))
  })
})
