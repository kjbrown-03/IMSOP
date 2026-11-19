require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerMedecinLocal, creerPatient, creerCoordinateur, creerDossier, MOT_DE_PASSE } = require('./helpers/factories')

test.beforeEach(viderBase)
test.after(fermerBase)

const PATIENT = {
  nom: 'Ngo Bassa Marie',
  age: 42,
  sexe: 'FEMININ',
  paysOrigine: 'Cameroun',
  diagnostic: 'Douleurs articulaires chroniques',
  therapeutique: 'Décoction d’écorces, massage',
  dureeTraitement: '21 jours',
}

async function tradipraticien() {
  const { user, medecinLocal } = await creerMedecinLocal()
  await prisma.medecinLocal.update({ where: { id: medecinLocal.id }, data: { typePratique: 'TRADITIONNEL' } })
  const u = await prisma.user.update({ where: { id: user.id }, data: { role: 'TRADIPRATICIEN' } })
  return { user: u, medecinLocal }
}

const creer = (user, corps = PATIENT) =>
  api().post('/api/registre').set('Authorization', entete(user)).send(corps)

test('un tradipraticien enregistre un patient et le retrouve dans son registre', async () => {
  const { user } = await tradipraticien()
  const res = await creer(user)
  assert.equal(res.status, 201)
  assert.equal(res.body.nom, PATIENT.nom)
  assert.equal(res.body.referenceVers, null)

  const liste = await api().get('/api/registre').set('Authorization', entete(user))
  assert.equal(liste.status, 200)
  assert.equal(liste.body.total, 1)
  assert.equal(liste.body.items[0].dureeTraitement, '21 jours')
})

test('tous les champs du patient sont obligatoires', async () => {
  const { user } = await tradipraticien()
  for (const champ of Object.keys(PATIENT)) {
    const { [champ]: _, ...incomplet } = PATIENT
    const res = await creer(user, incomplet)
    assert.equal(res.status, 400, `sans ${champ}`)
  }
  assert.equal((await creer(user, { ...PATIENT, age: -1 })).status, 400)
  assert.equal((await creer(user, { ...PATIENT, sexe: 'AUTRE' })).status, 400)
})

test('le registre est fermé au médecin conventionnel et aux autres rôles', async () => {
  const { user: conventionnel } = await creerMedecinLocal()
  assert.equal((await creer(conventionnel)).status, 403)

  const { user: patient } = await creerPatient()
  assert.equal((await creer(patient)).status, 403)
  const coord = await creerCoordinateur()
  assert.equal((await api().get('/api/registre').set('Authorization', entete(coord))).status, 403)
})

test("un tradipraticien ne voit ni ne touche les patients d'un confrère", async () => {
  const { user: a } = await tradipraticien()
  const { user: b } = await tradipraticien()
  const { body: fiche } = await creer(a)

  const liste = await api().get('/api/registre').set('Authorization', entete(b))
  assert.equal(liste.body.total, 0)

  const modif = await api().patch(`/api/registre/${fiche.id}`).set('Authorization', entete(b)).send({ age: 50 })
  assert.equal(modif.status, 404)
  const ref = await api().post(`/api/registre/${fiche.id}/reference`).set('Authorization', entete(b))
    .send({ referenceVers: 'HOPITAL_CONVENTIONNEL', referenceDestinataire: 'Hôpital Laquintinie' })
  assert.equal(ref.status, 404)
  const suppr = await api().delete(`/api/registre/${fiche.id}`).set('Authorization', entete(b))
  assert.equal(suppr.status, 404)
  assert.ok(await prisma.patientRegistre.findUnique({ where: { id: fiche.id } }))
})

test("référer vers l'hôpital puis vers un confrère, et annuler", async () => {
  const { user } = await tradipraticien()
  const { body: fiche } = await creer(user)
  const url = `/api/registre/${fiche.id}/reference`

  const hopital = await api().post(url).set('Authorization', entete(user))
    .send({ referenceVers: 'HOPITAL_CONVENTIONNEL', referenceDestinataire: 'Hôpital Laquintinie', referenceMotif: 'Pas d’amélioration' })
  assert.equal(hopital.status, 200)
  assert.equal(hopital.body.referenceVers, 'HOPITAL_CONVENTIONNEL')
  assert.ok(hopital.body.referenceLe)

  const confrere = await api().post(url).set('Authorization', entete(user))
    .send({ referenceVers: 'AUTRE_TRADIPRATICIEN', referenceDestinataire: 'Tradipraticien Essomba' })
  assert.equal(confrere.body.referenceVers, 'AUTRE_TRADIPRATICIEN')
  // Une orientation sans motif ne garde pas celui de la précédente.
  assert.equal(confrere.body.referenceMotif, null)

  const invalide = await api().post(url).set('Authorization', entete(user))
    .send({ referenceVers: 'PHARMACIE', referenceDestinataire: 'X' })
  assert.equal(invalide.status, 400)

  const annule = await api().delete(url).set('Authorization', entete(user))
  assert.equal(annule.status, 200)
  assert.equal(annule.body.referenceVers, null)
  assert.equal(annule.body.referenceLe, null)
})

test("le journal d'audit ne contient ni le nom ni le diagnostic", async () => {
  const { user } = await tradipraticien()
  await creer(user)
  const logs = await prisma.auditLog.findMany({ where: { entityType: 'PatientRegistre' } })
  assert.equal(logs.length, 1)
  const brut = JSON.stringify(logs)
  assert.ok(!brut.includes(PATIENT.nom))
  assert.ok(!brut.includes(PATIENT.diagnostic))
})

test('le profil expose la nature de la pratique', async () => {
  const { user } = await tradipraticien()
  const me = await api().get('/api/auth/me').set('Authorization', entete(user))
  assert.equal(me.body.typePratique, 'TRADITIONNEL')
})

test("le tradipraticien n'a pas accès aux dossiers de second avis", async () => {
  const { user } = await tradipraticien()
  const auth = entete(user)
  assert.equal((await api().get('/api/dossiers').set('Authorization', auth)).status, 403)
  assert.equal((await api().get('/api/dossiers/avis-a-rediger').set('Authorization', auth)).status, 403)
  assert.equal((await api().post('/api/dossiers/demande-medecin').set('Authorization', auth).send({})).status, 403)
})

test('le tradipraticien garde sa fiche d’annuaire, sans justificatifs libres', async () => {
  const { user } = await tradipraticien()
  const auth = entete(user)
  assert.equal((await api().get('/api/annuaire/medecin/moi').set('Authorization', auth)).status, 200)
  // Ses pièces accompagnent ses demandes de prise en charge, pas un espace à part.
  assert.equal((await api().get('/api/professionnels/me/justificatifs').set('Authorization', auth)).status, 403)
})

test('connexion par la mauvaise porte : le tradipraticien est renvoyé vers son espace', async () => {
  const { user } = await tradipraticien()
  const mauvaise = await api().post('/api/auth/login').send({ email: user.email, password: MOT_DE_PASSE, role: 'MEDECIN_LOCAL' })
  assert.equal(mauvaise.status, 409)
  assert.equal(mauvaise.body.espace, 'tradipraticien')
  // Sans le bon mot de passe, rien ne trahit la nature du compte.
  const sansMdp = await api().post('/api/auth/login').send({ email: user.email, password: 'mauvais-mot-de-passe', role: 'MEDECIN_LOCAL' })
  assert.equal(sansMdp.status, 401)
  const bonne = await api().post('/api/auth/login').send({ email: user.email, password: MOT_DE_PASSE, role: 'TRADIPRATICIEN' })
  assert.equal(bonne.status, 200)
  assert.equal(bonne.body.twoFactorRequired, true)
})

test("le tradipraticien ne lit aucun dossier, même en connaissant son identifiant", async () => {
  const { user } = await tradipraticien()
  const { patient } = await creerPatient()
  const dossier = await creerDossier({ patient })
  const auth = entete(user)
  assert.equal((await api().get(`/api/dossiers/${dossier.id}`).set('Authorization', auth)).status, 403)
  assert.equal((await api().get(`/api/dossiers/${dossier.id}/documents`).set('Authorization', auth)).status, 403)
  assert.equal((await api().get(`/api/dossiers/${dossier.id}/messages`).set('Authorization', auth)).status, 403)
})

test("un tradipraticien ne peut pas s'engager à rédiger des avis", async () => {
  const { user } = await tradipraticien()
  const res = await api().put('/api/annuaire/medecin/moi').set('Authorization', entete(user)).send({ annuaireVisible: false, avisLocalActif: true })
  assert.equal(res.status, 403)
})
