require('./helpers/env')
const test = require('node:test')
const assert = require('node:assert/strict')

// Aucun stockage réel pendant les tests : on garde ce qui est écrit pour
// pouvoir le relire au téléchargement.
const s3 = require('../src/lib/s3')
const { Readable } = require('stream')
const stockes = new Map()
s3.putObject = async (cle, corps) => { stockes.set(cle, corps) }
s3.getObjectStream = async (cle) => {
  const corps = stockes.get(cle) || Buffer.alloc(0)
  return { body: Readable.from([corps]), contentType: 'application/pdf', contentLength: corps.length }
}

const { api, entete } = require('./helpers/http')
const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { creerMedecinLocal, creerCoordinateur } = require('./helpers/factories')

test.beforeEach(viderBase)
test.after(fermerBase)

const PDF = Buffer.from('%PDF-1.4 attestation')
const MOTIF = 'Je soigne ces maladies depuis quinze ans, attestation du chef de village jointe.'

async function tradipraticien(specialites = ['medecine_generale']) {
  const { user, medecinLocal } = await creerMedecinLocal()
  await prisma.medecinLocal.update({
    where: { id: medecinLocal.id },
    data: { typePratique: 'TRADITIONNEL', annuaireSpecialites: specialites },
  })
  const u = await prisma.user.update({ where: { id: user.id }, data: { role: 'TRADIPRATICIEN' } })
  return { user: u, medecinLocal }
}

function demander(user, { specialites = ['dermatologie'], motif = MOTIF, pieces = 1 } = {}) {
  let req = api().post('/api/prises-en-charge').set('Authorization', entete(user)).field('motif', motif)
  for (const s of specialites) req = req.field('specialites', s)
  for (let i = 0; i < pieces; i++) req = req.attach('pieces', PDF, { filename: `piece-${i}.pdf`, contentType: 'application/pdf' })
  return req
}

const specialitesDe = async (medecinLocal) =>
  (await prisma.medecinLocal.findUnique({ where: { id: medecinLocal.id } })).annuaireSpecialites

test("le tradipraticien ne modifie plus lui-même ce qu'il prend en charge", async () => {
  const { user, medecinLocal } = await tradipraticien()
  const auth = entete(user)
  const ajout = await api().put('/api/annuaire/medecin/moi').set('Authorization', auth)
    .send({ annuaireVisible: false, annuaireSpecialites: ['medecine_generale', 'cardiologie'] })
  assert.equal(ajout.status, 403)
  const retrait = await api().put('/api/annuaire/medecin/moi').set('Authorization', auth)
    .send({ annuaireVisible: false, annuaireSpecialites: [] })
  assert.equal(retrait.status, 403)
  assert.deepEqual(await specialitesDe(medecinLocal), ['medecine_generale'])

  // Le reste de sa fiche s'enregistre toujours, sans renvoyer la liste.
  const reste = await api().put('/api/annuaire/medecin/moi').set('Authorization', auth)
    .send({ annuaireVisible: true, pays: 'cm', quartier: 'Bonapriso' })
  assert.equal(reste.status, 200)
  assert.equal(reste.body.quartier, 'Bonapriso')
  assert.deepEqual(reste.body.annuaireSpecialites, ['medecine_generale'])
})

test("le tradipraticien ne modifie pas ses années d'expérience", async () => {
  const { user, medecinLocal } = await tradipraticien()
  await prisma.medecinLocal.update({ where: { id: medecinLocal.id }, data: { annuaireExperience: 12 } })
  const auth = entete(user)
  const changement = await api().put('/api/annuaire/medecin/moi').set('Authorization', auth)
    .send({ annuaireVisible: false, annuaireExperience: 40 })
  assert.equal(changement.status, 403)
  const identique = await api().put('/api/annuaire/medecin/moi').set('Authorization', auth)
    .send({ annuaireVisible: false, annuaireExperience: 12 })
  assert.equal(identique.status, 200)
  assert.equal((await prisma.medecinLocal.findUnique({ where: { id: medecinLocal.id } })).annuaireExperience, 12)

  // La coordination, elle, les corrige.
  const coord = await creerCoordinateur()
  const parCoord = await api().patch(`/api/admin/users/${user.id}`).set('Authorization', entete(coord))
    .send({ annuaireExperience: 20 })
  assert.equal(parCoord.status, 200)
  assert.equal((await prisma.medecinLocal.findUnique({ where: { id: medecinLocal.id } })).annuaireExperience, 20)

  // Le médecin conventionnel, lui, garde la main.
  const { user: medecin } = await creerMedecinLocal()
  const conv = await api().put('/api/annuaire/medecin/moi').set('Authorization', entete(medecin))
    .send({ annuaireVisible: false, annuaireExperience: 8 })
  assert.equal(conv.status, 200)
})

test('le médecin conventionnel garde la main sur ses spécialités', async () => {
  const { user, medecinLocal } = await creerMedecinLocal()
  const res = await api().put('/api/annuaire/medecin/moi').set('Authorization', entete(user))
    .send({ annuaireVisible: false, annuaireSpecialites: ['pediatrie'] })
  assert.equal(res.status, 200)
  assert.deepEqual(await specialitesDe(medecinLocal), ['pediatrie'])
})

test('une demande sans justificatif ou sans motif est refusée', async () => {
  const { user } = await tradipraticien()
  assert.equal((await demander(user, { pieces: 0 })).status, 400)
  assert.equal((await demander(user, { motif: 'court' })).status, 400)
  assert.equal((await demander(user, { specialites: ['inventee'] })).status, 400)
  assert.equal((await demander(user, { specialites: ['medecine_generale'] })).status, 400, 'déjà prise en charge')
  assert.equal(await prisma.demandePriseEnCharge.count(), 0)
})

test('acceptée par la coordination, la demande ajoute les maladies à la fiche', async () => {
  const { user, medecinLocal } = await tradipraticien()
  const coord = await creerCoordinateur()

  const depot = await demander(user, { specialites: ['dermatologie', 'medecine_generale'], pieces: 2 })
  assert.equal(depot.status, 201)
  // Ce qu'il a déjà n'est pas redemandé.
  assert.deepEqual(depot.body.specialites, ['dermatologie'])
  assert.equal(depot.body.pieces.length, 2)
  assert.deepEqual(await specialitesDe(medecinLocal), ['medecine_generale'], 'rien avant la décision')

  // Une seule demande à la fois.
  assert.equal((await demander(user, { specialites: ['pediatrie'] })).status, 409)

  const enAttente = await api().get('/api/prises-en-charge').set('Authorization', entete(coord))
  assert.equal(enAttente.status, 200)
  assert.equal(enAttente.body.length, 1)
  assert.equal(enAttente.body[0].medecinLocal.user.id, user.id)

  const piece = await api().get(`/api/prises-en-charge/pieces/${depot.body.pieces[0].id}`).set('Authorization', entete(coord))
  assert.equal(piece.status, 200)

  const decision = await api().post(`/api/prises-en-charge/${depot.body.id}/decision`).set('Authorization', entete(coord))
    .send({ decision: 'ACCEPTEE' })
  assert.equal(decision.status, 200)
  assert.deepEqual((await specialitesDe(medecinLocal)).sort(), ['dermatologie', 'medecine_generale'])

  // Une décision ne se rejoue pas : un refus arrivé second ne défait rien.
  const rejeu = await api().post(`/api/prises-en-charge/${depot.body.id}/decision`).set('Authorization', entete(coord))
    .send({ decision: 'REFUSEE', motifRefus: 'Pièces illisibles' })
  assert.equal(rejeu.status, 409)
  assert.equal((await prisma.demandePriseEnCharge.findUnique({ where: { id: depot.body.id } })).statut, 'ACCEPTEE')

  const notif = await prisma.notification.findFirst({ where: { userId: user.id, type: 'PRISE_EN_CHARGE_TRAITEE' } })
  assert.ok(notif)

  // La demande traitée, il peut en déposer une autre.
  assert.equal((await demander(user, { specialites: ['pediatrie'] })).status, 201)
})

test('un refus doit être motivé et ne touche pas la fiche', async () => {
  const { user, medecinLocal } = await tradipraticien()
  const coord = await creerCoordinateur()
  const { body: d } = await demander(user)

  const sansMotif = await api().post(`/api/prises-en-charge/${d.id}/decision`).set('Authorization', entete(coord))
    .send({ decision: 'REFUSEE' })
  assert.equal(sansMotif.status, 400)

  const refus = await api().post(`/api/prises-en-charge/${d.id}/decision`).set('Authorization', entete(coord))
    .send({ decision: 'REFUSEE', motifRefus: 'Aucune pièce ne concerne la dermatologie.' })
  assert.equal(refus.status, 200)
  assert.deepEqual(await specialitesDe(medecinLocal), ['medecine_generale'])

  const miennes = await api().get('/api/prises-en-charge/moi').set('Authorization', entete(user))
  assert.equal(miennes.body[0].statut, 'REFUSEE')
  assert.equal(miennes.body[0].motifRefus, 'Aucune pièce ne concerne la dermatologie.')
})

test('cloisonnement : ni un confrère ni un médecin ne voient ou ne tranchent', async () => {
  const { user: a } = await tradipraticien()
  const { user: b } = await tradipraticien()
  const { user: medecin } = await creerMedecinLocal()
  const { body: d } = await demander(a)

  assert.equal((await api().get(`/api/prises-en-charge/pieces/${d.pieces[0].id}`).set('Authorization', entete(b))).status, 404)
  assert.equal((await api().get('/api/prises-en-charge/moi').set('Authorization', entete(b))).body.length, 0)
  assert.equal((await api().get('/api/prises-en-charge').set('Authorization', entete(a))).status, 403)
  assert.equal((await api().post(`/api/prises-en-charge/${d.id}/decision`).set('Authorization', entete(a)).send({ decision: 'ACCEPTEE' })).status, 403)
  assert.equal((await demander(medecin)).status, 403)
})

test('le tradipraticien change son numéro de téléphone, et lui seul', async () => {
  const { user } = await tradipraticien()
  const res = await api().patch('/api/users/me/telephone').set('Authorization', entete(user)).send({ phone: '+237 6 99 12 34 56' })
  assert.equal(res.status, 200)
  assert.equal(res.body.phone, '+237 6 99 12 34 56')
  assert.equal((await api().patch('/api/users/me/telephone').set('Authorization', entete(user)).send({ phone: 'abc' })).status, 400)
  assert.equal((await api().patch('/api/users/me/telephone').set('Authorization', entete(user)).send({ phone: '12' })).status, 400)

  const { user: medecin } = await creerMedecinLocal()
  assert.equal((await api().patch('/api/users/me/telephone').set('Authorization', entete(medecin)).send({ phone: '+237699123456' })).status, 403)
})
