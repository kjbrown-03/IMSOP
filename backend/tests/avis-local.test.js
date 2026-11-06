require('./helpers/env')
// Le stockage objet est remplace AVANT de charger l'application : les controleurs
// recuperent `putObject` par destructuration au moment du require, et ce test
// verifie le parcours, pas Garage.
const s3 = require('../src/lib/s3')
s3.putObject = async () => {}

const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const {
  creerPatient,
  creerSpecialiste,
  creerMedecinLocal,
  creerCoordinateur,
  creerDossier,
} = require('./helpers/factories')
const { couvreLaSpecialite } = require('../src/services/avisLocalService')

test.beforeEach(viderBase)
test.after(fermerBase)

const MOTIF_CONFLIT = "J'ai déjà soigné ce patient dans mon cabinet l'an dernier."
const REDACTION = { synthese: 'Synthèse du cas', diagnostic: 'Diagnostic confirmé', optionsTherapeutiques: 'Poursuivre' }

async function redacteur({ pays = 'cm', profil = {}, ...options } = {}) {
  const { user, medecinLocal } = await creerMedecinLocal(options)
  const maj = await prisma.medecinLocal.update({
    where: { id: medecinLocal.id },
    data: { avisLocalActif: true, pays, annuaireSpecialites: ['cardiologie'], ...profil },
  })
  await prisma.user.update({ where: { id: user.id }, data: { phone: '+237699000111' } })
  return { user, medecinLocal: maj }
}

// Dossier paye, en attente d'affectation : le point de depart reel d'un avis local.
async function dossierLocalPaye(reste = {}) {
  const { user: patientUser, patient } = await creerPatient()
  await prisma.user.update({ where: { id: patientUser.id }, data: { phone: '+237677000222' } })
  await prisma.patient.update({
    where: { id: patient.id },
    data: { emergencyContactName: 'Proche', emergencyContactPhone: '+237655000333' },
  })
  const dossier = await creerDossier({ patient, portee: 'LOCAL', status: 'EN_ATTENTE_AFFECTATION', ...reste })
  await prisma.paiement.create({
    data: { dossierId: dossier.id, amount: 15000, currency: 'XAF', status: 'PAYE', confirmedAt: new Date() },
  })
  return { dossier, patientUser, patient }
}

const affecter = (coord, dossier, medecinLocal) =>
  api()
    .post(`/api/dossiers/${dossier.id}/assigner-medecin-local`)
    .set('Authorization', entete(coord))
    .send({ medecinLocalId: medecinLocal.id })

// Un dossier deja entre les mains du medecin, analyse demarree.
async function dossierEnRedaction() {
  const coord = await creerCoordinateur()
  const contexte = await dossierLocalPaye()
  const r = await redacteur()
  await affecter(coord, contexte.dossier, r.medecinLocal).expect(200)
  const auth = entete(r.user)
  await api().post(`/api/dossiers/${contexte.dossier.id}/accepter`).set('Authorization', auth).expect(200)
  await api().post(`/api/dossiers/${contexte.dossier.id}/analyser`).set('Authorization', auth).expect(200)
  return { ...contexte, coord, ...r, auth }
}

test('Affectation — chaque portée garde son vivier', async (t) => {
  await t.test('un expert international ne peut pas recevoir un dossier local', async () => {
    const coord = await creerCoordinateur()
    const { dossier } = await dossierLocalPaye()
    const { specialiste } = await creerSpecialiste()
    await api()
      .post(`/api/dossiers/${dossier.id}/assigner`)
      .set('Authorization', entete(coord))
      .send({ specialisteId: specialiste.id })
      .expect(409)
    const relu = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(relu.specialisteId, null)
  })

  await t.test('un médecin local ne peut pas recevoir un dossier international', async () => {
    const coord = await creerCoordinateur()
    const { dossier } = await dossierLocalPaye({ portee: 'INTERNATIONAL' })
    const { medecinLocal } = await redacteur()
    await affecter(coord, dossier, medecinLocal).expect(409)
  })

  await t.test('un dossier non payé ne peut pas être confié', async () => {
    const coord = await creerCoordinateur()
    const { dossier } = await dossierLocalPaye({ status: 'EN_ATTENTE_PAIEMENT' })
    const { medecinLocal } = await redacteur()
    await affecter(coord, dossier, medecinLocal).expect(409)
  })

  await t.test('seule la coordination affecte', async () => {
    const { dossier, patientUser } = await dossierLocalPaye()
    const { medecinLocal, user } = await redacteur()
    await affecter(patientUser, dossier, medecinLocal).expect(403)
    await affecter(user, dossier, medecinLocal).expect(403)
  })

  await t.test("l'affectation réussie notifie sans aucun détail médical", async () => {
    const coord = await creerCoordinateur()
    const { dossier, patientUser } = await dossierLocalPaye()
    const { medecinLocal, user } = await redacteur()

    const res = await affecter(coord, dossier, medecinLocal).expect(200)
    assert.equal(res.body.status, 'AFFECTE')
    assert.equal(res.body.medecinRedacteurId, medecinLocal.id)
    assert.equal(res.body.specialisteId, null)

    const notif = await prisma.notification.findFirst({ where: { userId: user.id, type: 'AVIS_LOCAL_A_REDIGER' } })
    assert.ok(notif)
    assert.deepEqual(Object.keys(notif.payload).sort(), ['name', 'reference'])
    assert.ok(await prisma.notification.findFirst({ where: { userId: patientUser.id, type: 'AVIS_LOCAL_AFFECTE' } }))
  })
})

test('Affectation — médecins écartés', async (t) => {
  const CAS = [
    ['sans accord pour rédiger', { profil: { avisLocalActif: false } }],
    ['non retenu par le comité', { valideParComite: false }],
    ['habilitation suspendue', { verificationStatus: 'SUSPENDU' }],
    ['médecine traditionnelle', { profil: { typePratique: 'TRADITIONNEL' } }],
    ['hors zone CEMAC', { pays: 'fr' }],
  ]
  for (const [nom, options] of CAS) {
    await t.test(nom, async () => {
      const coord = await creerCoordinateur()
      const { dossier } = await dossierLocalPaye()
      const { medecinLocal } = await redacteur(options)
      await affecter(coord, dossier, medecinLocal).expect(409)
      const liste = await api()
        .get(`/api/dossiers/${dossier.id}/redacteurs-possibles`)
        .set('Authorization', entete(coord))
        .expect(200)
      assert.equal(liste.body.length, 0)
    })
  }

  await t.test('le médecin traitant du patient ne donne pas un deuxième avis', async () => {
    const coord = await creerCoordinateur()
    const { medecinLocal } = await redacteur()
    const { dossier } = await dossierLocalPaye({ medecinLocalId: medecinLocal.id })
    await affecter(coord, dossier, medecinLocal).expect(409)
  })

  await t.test('le patient ne peut pas prendre le rédacteur pour médecin traitant', async () => {
    const coord = await creerCoordinateur()
    const { dossier, patientUser } = await dossierLocalPaye()
    const { medecinLocal, user } = await redacteur()
    await affecter(coord, dossier, medecinLocal).expect(200)
    await api()
      .post(`/api/dossiers/${dossier.id}/medecin-local`)
      .set('Authorization', entete(patientUser))
      .send({ email: user.email })
      .expect(409)
  })

  await t.test('la liste classe et ne donne aucune coordonnée', async () => {
    const coord = await creerCoordinateur()
    const { dossier } = await dossierLocalPaye()
    const hors = await redacteur({ profil: { annuaireSpecialites: ['pediatrie'], specialite: 'Pédiatrie' } })
    const bon = await redacteur()
    const { body } = await api()
      .get(`/api/dossiers/${dossier.id}/redacteurs-possibles`)
      .set('Authorization', entete(coord))
      .expect(200)
    assert.deepEqual(body.map((m) => m.id), [bon.medecinLocal.id, hors.medecinLocal.id])
    assert.equal(body[0].specialiteConfirmee, true)
    assert.equal(body[1].specialiteConfirmee, false)
    assert.equal(JSON.stringify(body).includes('+237'), false)
  })
})

test('Spécialité — comparaison entre libellés et clés', async (t) => {
  await t.test('accents, tirets et ligatures', () => {
    assert.equal(couvreLaSpecialite({ annuaireSpecialites: ['gynecologie'] }, 'Gynécologie-Obstétrique'), true)
    assert.equal(couvreLaSpecialite({ specialite: 'Cœur et vaisseaux' }, 'COEUR ET VAISSEAUX'), true)
  })
  await t.test("une clé courte ne trouve pas n'importe quel mot", () => {
    assert.equal(couvreLaSpecialite({ annuaireSpecialites: ['orl'] }, 'Chirurgie orlandaise'), false)
    assert.equal(couvreLaSpecialite({ annuaireSpecialites: ['orl'] }, 'ORL'), true)
  })
})

test('Accès — le rédacteur répond au dossier, il ne le gère pas', async (t) => {
  await t.test('un autre médecin ne voit rien', async () => {
    const { dossier } = await dossierEnRedaction()
    const autre = await redacteur()
    const auth = entete(autre.user)
    await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', auth).expect(403)
    await api().get(`/api/dossiers/${dossier.id}/documents`).set('Authorization', auth).expect(403)
    await api().post(`/api/dossiers/${dossier.id}/accepter`).set('Authorization', auth).expect(403)
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', auth).send(REDACTION).expect(403)
  })

  await t.test('le médecin traitant ne peut ni accepter ni rédiger', async () => {
    const traitant = await redacteur()
    const coord = await creerCoordinateur()
    const { dossier } = await dossierLocalPaye({ medecinLocalId: traitant.medecinLocal.id })
    const r = await redacteur()
    await affecter(coord, dossier, r.medecinLocal).expect(200)
    const auth = entete(traitant.user)
    await api().post(`/api/dossiers/${dossier.id}/accepter`).set('Authorization', auth).expect(403)
    await api().post(`/api/dossiers/${dossier.id}/refuser`).set('Authorization', auth).send({}).expect(403)
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', auth).send(REDACTION).expect(403)
  })

  await t.test('il ne reçoit aucune coordonnée du patient', async () => {
    const { dossier, auth } = await dossierEnRedaction()
    for (const url of [`/api/dossiers/${dossier.id}`, '/api/dossiers/avis-a-rediger']) {
      const { body } = await api().get(url).set('Authorization', auth).expect(200)
      const texte = JSON.stringify(body)
      for (const secret of ['+237677000222', '+237655000333', '@imsop.test', 'identityDocumentKey']) {
        assert.equal(texte.includes(secret), false, `${url} divulgue ${secret}`)
      }
      assert.ok(texte.includes('Compte PATIENT'), 'le nom reste visible : un avis se signe')
    }
  })

  await t.test('le patient ne reçoit aucune coordonnée du médecin', async () => {
    const { dossier, patientUser, medecinLocal } = await dossierEnRedaction()
    const auth = entete(patientUser)
    for (const url of [`/api/dossiers/${dossier.id}`, '/api/dossiers']) {
      const { body } = await api().get(url).set('Authorization', auth).expect(200)
      const texte = JSON.stringify(body)
      assert.equal(texte.includes('+237699000111'), false, `${url} divulgue le téléphone`)
      assert.ok(medecinLocal.id)
    }
    const { body } = await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', auth).expect(200)
    assert.equal(body.medecinRedacteur.user.email, undefined)
    assert.equal(body.medecinRedacteur.numeroOrdre, undefined)
    assert.ok(body.medecinRedacteur.user.fullName)
  })

  await t.test('les routes de gestion lui restent fermées', async () => {
    const { dossier, auth } = await dossierEnRedaction()
    const id = dossier.id
    await api().patch(`/api/dossiers/${id}`).set('Authorization', auth).send({ motif: 'Réécrit par le rédacteur' }).expect(403)
    await api().post(`/api/dossiers/${id}/question-medecin-local`).set('Authorization', auth).send({ question: 'Une question ?' }).expect(403)
    await api().post(`/api/dossiers/${id}/documents`).set('Authorization', auth).attach('file', Buffer.from('%PDF-1.4'), { filename: 'a.pdf', contentType: 'application/pdf' }).expect(403)
    await api().get(`/api/dossiers/${id}/messages`).set('Authorization', auth).expect(403)

    await api().post(`/api/dossiers/${id}/demander-complement`).set('Authorization', auth).send({ precisions: 'Il manque le scanner' }).expect(200)
    // Il ne peut pas declarer lui-meme que le complement qu'il attend est arrive.
    await api().post(`/api/dossiers/${id}/complement-fourni`).set('Authorization', auth).expect(403)
    const relu = await prisma.dossier.findUnique({ where: { id } })
    assert.equal(relu.motif, dossier.motif)
    assert.equal(relu.status, 'INFORMATION_COMPLEMENTAIRE_DEMANDEE')
  })

  await t.test("une habilitation retirée coupe l'accès sur-le-champ", async () => {
    const { dossier, auth, medecinLocal } = await dossierEnRedaction()
    await prisma.medecinLocal.update({ where: { id: medecinLocal.id }, data: { verificationStatus: 'SUSPENDU' } })
    await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', auth).expect(403)
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', auth).send(REDACTION).expect(403)
    const { body } = await api().get('/api/dossiers/avis-a-rediger').set('Authorization', auth).expect(200)
    assert.equal(body.items.length, 0)
  })

  await t.test('ses avis restent hors de la liste de ses propres patients', async () => {
    const { dossier, auth } = await dossierEnRedaction()
    const propres = await api().get('/api/dossiers').set('Authorization', auth).expect(200)
    assert.equal(propres.body.items.length, 0)
    const avis = await api().get('/api/dossiers/avis-a-rediger').set('Authorization', auth).expect(200)
    assert.deepEqual(avis.body.items.map((d) => d.id), [dossier.id])
  })
})

test('Rédaction — du dépôt à la lecture par le patient', async (t) => {
  await t.test('le parcours complet aboutit et rémunère le médecin', async () => {
    const { dossier, patientUser, coord, medecinLocal, auth } = await dossierEnRedaction()
    const id = dossier.id

    const brouillon = await api().put(`/api/dossiers/${id}/rapport`).set('Authorization', auth).send(REDACTION).expect(200)
    assert.equal(brouillon.body.medecinRedacteurId, medecinLocal.id)
    assert.equal(brouillon.body.specialisteId, null)

    // Son propre brouillon lui reste lisible, le patient n'y a pas encore droit.
    await api().get(`/api/dossiers/${id}/rapport`).set('Authorization', auth).expect(200)
    await api().get(`/api/dossiers/${id}/rapport`).set('Authorization', entete(patientUser)).expect(403)

    await api().post(`/api/dossiers/${id}/rapport/soumettre`).set('Authorization', auth).expect(200)
    await api().post(`/api/rapports/${brouillon.body.id}/valider`).set('Authorization', entete(coord)).expect(200)

    const final = await api().get(`/api/dossiers/${id}/rapport`).set('Authorization', entete(patientUser)).expect(200)
    assert.equal(final.body.status, 'VALIDE')
    const relu = await prisma.dossier.findUnique({ where: { id } })
    assert.equal(relu.status, 'RAPPORT_TRANSMIS')

    const honoraire = await prisma.honoraire.findUnique({ where: { dossierId: id } })
    assert.equal(honoraire.medecinRedacteurId, medecinLocal.id)
    assert.equal(honoraire.specialisteId, null)
    assert.equal(Number(honoraire.montantBrut), 15000)
    assert.equal(Number(honoraire.montantNetDevise), 10500)
    assert.equal(honoraire.deviseNet, 'XAF')
    assert.equal(honoraire.canal, 'FAPSHI')

    // Le releve des reversements lit `specialiste` : il plantait sur un medecin.
    const releve = await api().get('/api/honoraires').set('Authorization', entete(coord)).expect(200)
    assert.equal(releve.body[0].specialiste.id, medecinLocal.id)
    assert.ok(releve.body[0].specialiste.user.fullName)
    const synthese = await api().get('/api/honoraires/synthese').set('Authorization', entete(coord)).expect(200)
    assert.equal(synthese.body[0].total, 10500)
  })

  await t.test('un médecin de Libreville est réglé en XAF, hors Mobile Money Fapshi', async () => {
    const { creerHonorairePourDossier } = require('../src/services/honorairesService')
    const { dossier, medecinLocal } = await dossierEnRedaction()
    await prisma.medecinLocal.update({ where: { id: medecinLocal.id }, data: { pays: 'ga' } })
    const honoraire = await creerHonorairePourDossier(dossier.id)
    assert.equal(honoraire.deviseNet, 'XAF')
    assert.equal(honoraire.canal, 'VIREMENT')
  })

  await t.test('rien ne se rédige avant acceptation', async () => {
    const coord = await creerCoordinateur()
    const { dossier } = await dossierLocalPaye()
    const r = await redacteur()
    await affecter(coord, dossier, r.medecinLocal).expect(200)
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', entete(r.user)).send(REDACTION).expect(409)
  })

  await t.test('un rapport remis ne se réécrit plus, un rapport validé ne recule plus', async () => {
    const { dossier, coord, auth } = await dossierEnRedaction()
    const id = dossier.id
    const { body: rapport } = await api().put(`/api/dossiers/${id}/rapport`).set('Authorization', auth).send(REDACTION).expect(200)
    await api().post(`/api/dossiers/${id}/rapport/soumettre`).set('Authorization', auth).expect(200)
    await api().put(`/api/dossiers/${id}/rapport`).set('Authorization', auth).send({ ...REDACTION, diagnostic: 'Autre' }).expect(409)
    await api().post(`/api/rapports/${rapport.id}/valider`).set('Authorization', entete(coord)).expect(200)
    await api().post(`/api/dossiers/${id}/rapport/soumettre`).set('Authorization', auth).expect(409)
    assert.equal((await prisma.rapport.findUnique({ where: { id: rapport.id } })).status, 'VALIDE')
    assert.equal((await prisma.dossier.findUnique({ where: { id } })).status, 'RAPPORT_TRANSMIS')
    await api().post(`/api/dossiers/${id}/refuser`).set('Authorization', auth).send({}).expect(400)
  })

  await t.test("la même garde protège le rapport d'un spécialiste", async () => {
    const { patient } = await creerPatient()
    const { user, specialiste } = await creerSpecialiste()
    const dossier = await creerDossier({ patient, specialiste, status: 'EN_ANALYSE' })
    const auth = entete(user)
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', auth).send(REDACTION).expect(200)
    await api().post(`/api/dossiers/${dossier.id}/rapport/soumettre`).set('Authorization', auth).expect(200)
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', auth).send(REDACTION).expect(409)
    await api().post(`/api/dossiers/${dossier.id}/rapport/soumettre`).set('Authorization', auth).expect(409)
  })

  await t.test('la base refuse un rapport sans auteur ou avec deux', async () => {
    const { dossier, medecinLocal } = await dossierEnRedaction()
    const { specialiste } = await creerSpecialiste()
    await assert.rejects(prisma.rapport.create({ data: { dossierId: dossier.id } }))
    await assert.rejects(
      prisma.rapport.create({ data: { dossierId: dossier.id, specialisteId: specialiste.id, medecinRedacteurId: medecinLocal.id } }),
    )
  })
})

test('Changement de main — le dossier repart propre', async (t) => {
  await t.test('un refus rend le dossier, efface le brouillon et coupe l\'accès', async () => {
    const { dossier, auth } = await dossierEnRedaction()
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', auth).send(REDACTION).expect(200)
    const { body } = await api().post(`/api/dossiers/${dossier.id}/refuser`).set('Authorization', auth).send({ motif: 'Pas le temps' }).expect(200)
    assert.equal(body.status, 'EN_ATTENTE_AFFECTATION')
    assert.equal(body.medecinRedacteurId, null)
    assert.equal(await prisma.rapport.count({ where: { dossierId: dossier.id } }), 0)
    await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', auth).expect(403)
  })

  await t.test('un médecin récusé ne revient plus sur ce dossier', async () => {
    const { dossier, coord, medecinLocal, auth } = await dossierEnRedaction()
    await api().post(`/api/dossiers/${dossier.id}/conflit-interets`).set('Authorization', auth).send({ motif: MOTIF_CONFLIT }).expect(200)
    assert.equal((await prisma.recusationMedecinLocal.findFirst({ where: { dossierId: dossier.id } })).medecinLocalId, medecinLocal.id)
    const liste = await api().get(`/api/dossiers/${dossier.id}/redacteurs-possibles`).set('Authorization', entete(coord)).expect(200)
    assert.equal(liste.body.some((m) => m.id === medecinLocal.id), false)
    await affecter(coord, dossier, medecinLocal).expect(409)
  })

  await t.test("réaffecter retire l'accès et le brouillon au précédent, et le prévient", async () => {
    const { dossier, coord, user, auth } = await dossierEnRedaction()
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', auth).send(REDACTION).expect(200)
    const suivant = await redacteur()
    await affecter(coord, dossier, suivant.medecinLocal).expect(200)
    await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', auth).expect(403)
    assert.equal(await prisma.rapport.count({ where: { dossierId: dossier.id } }), 0)
    assert.ok(await prisma.notification.findFirst({ where: { userId: user.id, type: 'AVIS_LOCAL_RETIRE' } }))
    await affecter(coord, dossier, suivant.medecinLocal).expect(409)
  })

  await t.test('un rapport déjà remis ne peut plus changer de main', async () => {
    const { dossier, coord, auth } = await dossierEnRedaction()
    await api().put(`/api/dossiers/${dossier.id}/rapport`).set('Authorization', auth).send(REDACTION).expect(200)
    await api().post(`/api/dossiers/${dossier.id}/rapport/soumettre`).set('Authorization', auth).expect(200)
    const suivant = await redacteur()
    await affecter(coord, dossier, suivant.medecinLocal).expect(409)
    assert.equal(await prisma.rapport.count({ where: { dossierId: dossier.id } }), 1)
  })
})

test("Interrupteur et consentement", async (t) => {
  await t.test('un médecin non retenu ne peut pas activer la rédaction', async () => {
    const { user } = await creerMedecinLocal({ valideParComite: false })
    await api()
      .put('/api/annuaire/medecin/moi')
      .set('Authorization', entete(user))
      .send({ annuaireVisible: false, avisLocalActif: true })
      .expect(403)
  })

  await t.test('le formulaire vierge existe dans les deux versions et elles diffèrent', async () => {
    const { user } = await creerPatient()
    const auth = entete(user)
    const inter = await api().get('/api/consentement-pdf').set('Authorization', auth).buffer().expect(200)
    const local = await api().get('/api/consentement-pdf?portee=LOCAL').set('Authorization', auth).buffer().expect(200)
    assert.match(local.headers['content-type'], /pdf/)
    assert.notEqual(Number(inter.headers['content-length']), Number(local.headers['content-length']))
  })
})
