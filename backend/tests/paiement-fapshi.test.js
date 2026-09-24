require('./helpers/env')
const { test, describe, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api, entete } = require('./helpers/http')
const f = require('./helpers/factories')
const env = require('../src/config/env')
const { fournisseurPour } = require('../src/controllers/paiements.controller')

// Même approche que paiement.test.js : `fetch` est remplacé, pas le service,
// pour vérifier que l'API distante est réellement appelée.
const fetchOriginal = globalThis.fetch
const fapshiOriginal = { ...env.fapshi }

const SECRET = 'secret-de-test-fapshi'

function activerFapshi() {
  Object.assign(env.fapshi, {
    apiUser: 'utilisateur-test',
    apiKey: 'cle-test',
    webhookSecret: SECRET,
    environnement: 'sandbox',
  })
}

function desactiverFapshi() {
  Object.assign(env.fapshi, { apiUser: undefined, apiKey: undefined, webhookSecret: undefined })
}

/** Simule Fapshi : le lien à la création, puis le statut à la relecture. */
function simulerFapshi({ statut = 'SUCCESSFUL', montant = 150000, transId = 'FAPSHI-TX-1' } = {}) {
  const appels = []
  globalThis.fetch = async (url, options = {}) => {
    appels.push({ url, method: options.method, headers: options.headers, body: options.body ? JSON.parse(options.body) : null })
    if (url.endsWith('/initiate-pay')) {
      return { ok: true, json: async () => ({ message: 'ok', link: 'https://checkout.fapshi.com/x', transId, dateInitiated: '2026-09-17' }) }
    }
    if (url.includes('/payment-status/')) {
      return { ok: true, json: async () => ({ transId, status: statut, amount: montant, medium: 'mobile money' }) }
    }
    throw new Error('URL inattendue : ' + url)
  }
  return appels
}

async function paiementFapshiEnAttente(transId = 'FAPSHI-TX-1') {
  const { user, patient } = await f.creerPatient()
  const dossier = await f.creerDossier({ patient, status: 'EN_ATTENTE_PAIEMENT' })
  const paiement = await prisma.paiement.create({
    data: {
      dossierId: dossier.id,
      provider: 'FAPSHI',
      amount: 150000,
      currency: 'XAF',
      status: 'EN_ATTENTE',
      cinetpayTransactionId: `IMSOP-${dossier.reference}-000001`,
      fapshiTransId: transId,
    },
  })
  return { user, patient, dossier, paiement }
}

describe('Fapshi — choix du fournisseur', () => {
  beforeEach(async () => {
    await viderBase()
    activerFapshi()
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
    Object.assign(env.fapshi, fapshiOriginal)
  })

  test('un patient au Cameroun passe par Fapshi', () => {
    assert.equal(fournisseurPour({ patient: { country: 'cm' } }), 'FAPSHI')
    assert.equal(fournisseurPour({ patient: { country: 'CM' } }), 'FAPSHI')
  })

  // Fapshi ne prend ni la carte bancaire ni les autres pays : un patient en
  // France doit rester sur CinetPay.
  test("un patient hors Cameroun reste sur CinetPay", () => {
    assert.equal(fournisseurPour({ patient: { country: 'fr' } }), 'CINETPAY')
    assert.equal(fournisseurPour({ patient: { country: 'sn' } }), 'CINETPAY')
  })

  test('un dossier sans patient reste sur CinetPay', () => {
    assert.equal(fournisseurPour({ patient: null }), 'CINETPAY')
  })

  // Sans accès Fapshi, rien ne doit changer pour personne.
  test('Fapshi non configuré : tout le monde sur CinetPay', () => {
    desactiverFapshi()
    assert.equal(fournisseurPour({ patient: { country: 'cm' } }), 'CINETPAY')
  })
})

describe('Fapshi — création du lien de paiement', () => {
  beforeEach(async () => {
    await viderBase()
    activerFapshi()
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
    Object.assign(env.fapshi, fapshiOriginal)
  })

  test('un patient camerounais obtient un lien Fapshi et le paiement est enregistré', async () => {
    const appels = simulerFapshi()
    const { user, patient } = await f.creerPatient()
    await prisma.patient.update({ where: { id: patient.id }, data: { country: 'cm' } })
    const dossier = await f.creerDossier({ patient, status: 'EN_ATTENTE_PAIEMENT' })

    const res = await api()
      .post(`/api/dossiers/${dossier.id}/paiement/init`)
      .set('Authorization', entete(user))
      .expect(201)

    assert.equal(res.body.paymentUrl, 'https://checkout.fapshi.com/x')
    assert.equal(res.body.paiement.provider, 'FAPSHI')
    assert.equal(res.body.paiement.fapshiTransId, 'FAPSHI-TX-1')

    // L'appel distant porte bien les en-têtes d'authentification et vise le
    // sandbox tant que FAPSHI_ENV ne dit pas le contraire.
    const init = appels.find((a) => a.url.endsWith('/initiate-pay'))
    assert.ok(init.url.startsWith('https://sandbox.fapshi.com'))
    assert.equal(init.headers.apiuser, 'utilisateur-test')
    assert.equal(init.headers.apikey, 'cle-test')
    assert.equal(init.body.externalId, res.body.paiement.cinetpayTransactionId)
  })

  // Un enregistrement sans identifiant Fapshi resterait à jamais « en attente ».
  test("si Fapshi ne répond pas, aucun paiement n'est créé", async () => {
    globalThis.fetch = async () => { throw new Error('réseau indisponible') }
    const { user, patient } = await f.creerPatient()
    await prisma.patient.update({ where: { id: patient.id }, data: { country: 'cm' } })
    const dossier = await f.creerDossier({ patient, status: 'EN_ATTENTE_PAIEMENT' })

    await api()
      .post(`/api/dossiers/${dossier.id}/paiement/init`)
      .set('Authorization', entete(user))
      .expect(502)

    assert.equal(await prisma.paiement.count(), 0)
  })
})

describe('Fapshi — webhook', () => {
  beforeEach(async () => {
    await viderBase()
    activerFapshi()
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
    Object.assign(env.fapshi, fapshiOriginal)
  })
  after(fermerBase)

  test('un webhook sans le bon secret est rejeté avant toute lecture', async () => {
    const appels = simulerFapshi()
    const { paiement } = await paiementFapshiEnAttente()

    await api()
      .post('/api/paiements/webhook/fapshi')
      .set('x-wh-secret', 'mauvais-secret')
      .send({ transId: paiement.fapshiTransId, status: 'SUCCESSFUL' })
      .expect(401)

    assert.equal(appels.length, 0, 'aucune relecture ne doit partir sans secret valide')
    const apres = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(apres.status, 'EN_ATTENTE')
  })

  // Le sandbox Fapshi n'a pas de secret de webhook (seule l'URL se configure)
  // : un webhook sans en-tête y est accepté. Mais "accepté" ne veut pas dire
  // "cru" - la relecture auprès de Fapshi reste le seul juge, donc un webhook
  // forgé sans secret ne débloque rien tant que Fapshi ne dit pas SUCCESSFUL.
  test('en sandbox, un webhook sans secret est accepté mais ne confirme rien sans relecture positive', async () => {
    const appels = simulerFapshi({ statut: 'CREATED' })
    const { paiement } = await paiementFapshiEnAttente()

    const res = await api()
      .post('/api/paiements/webhook/fapshi')
      .send({ transId: paiement.fapshiTransId, status: 'SUCCESSFUL' })
      .expect(200)

    assert.equal(res.body.status, 'CREATED', 'le statut rendu est celui relu chez Fapshi, pas celui du corps')
    assert.ok(appels.some((a) => a.url.includes('/payment-status/')), 'la relecture doit avoir eu lieu')
    const apres = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(apres.status, 'EN_ATTENTE', 'le corps du webhook seul ne confirme jamais un paiement')
  })

  // En live le champ secret existe chez Fapshi et le verrou est obligatoire :
  // l'assouplissement sandbox ne doit jamais fuir en production.
  test('en live, un webhook sans secret du tout est rejeté', async () => {
    const appels = simulerFapshi()
    const { paiement } = await paiementFapshiEnAttente()
    env.fapshi.environnement = 'live'

    await api()
      .post('/api/paiements/webhook/fapshi')
      .send({ transId: paiement.fapshiTransId })
      .expect(401)

    assert.equal(appels.length, 0, 'aucune relecture ne doit partir sans secret en live')
  })

  // Le corps du webhook n'est jamais cru sur parole : c'est la relecture auprès
  // de Fapshi qui décide.
  test('un paiement réussi est relu auprès de Fapshi puis confirmé', async () => {
    const appels = simulerFapshi({ statut: 'SUCCESSFUL' })
    const { paiement, dossier } = await paiementFapshiEnAttente()

    const res = await api()
      .post('/api/paiements/webhook/fapshi')
      .set('x-wh-secret', SECRET)
      .send({ transId: paiement.fapshiTransId, status: 'SUCCESSFUL' })
      .expect(200)

    assert.equal(res.body.status, 'PAYE')
    assert.ok(appels.some((a) => a.url.includes(`/payment-status/${paiement.fapshiTransId}`)))

    const p = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(p.status, 'PAYE')
    assert.ok(p.confirmedAt)
    const d = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(d.status, 'EN_ATTENTE_AFFECTATION')
  })

  test('le corps annonce un succès mais Fapshi dit FAILED : rien ne se débloque', async () => {
    simulerFapshi({ statut: 'FAILED' })
    const { paiement, dossier } = await paiementFapshiEnAttente()

    await api()
      .post('/api/paiements/webhook/fapshi')
      .set('x-wh-secret', SECRET)
      .send({ transId: paiement.fapshiTransId, status: 'SUCCESSFUL' })
      .expect(200)

    const p = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(p.status, 'ECHOUE')
    const d = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(d.status, 'EN_ATTENTE_PAIEMENT')
  })

  // PENDING n'est pas un échec : le patient est peut-être en train de valider.
  test('un statut PENDING laisse le paiement en attente', async () => {
    simulerFapshi({ statut: 'PENDING' })
    const { paiement } = await paiementFapshiEnAttente()

    await api()
      .post('/api/paiements/webhook/fapshi')
      .set('x-wh-secret', SECRET)
      .send({ transId: paiement.fapshiTransId })
      .expect(200)

    const p = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(p.status, 'EN_ATTENTE')
  })

  // Une transaction réussie de 100 XAF ne débloque pas un dossier à 150 000.
  test('un montant inférieur au montant attendu est refusé', async () => {
    simulerFapshi({ statut: 'SUCCESSFUL', montant: 100 })
    const { paiement, dossier } = await paiementFapshiEnAttente()

    const res = await api()
      .post('/api/paiements/webhook/fapshi')
      .set('x-wh-secret', SECRET)
      .send({ transId: paiement.fapshiTransId })
      .expect(200)

    assert.equal(res.body.status, 'ECHOUE')
    const d = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(d.status, 'EN_ATTENTE_PAIEMENT')
  })

  test('un webhook rejoué sur un paiement déjà confirmé ne refait rien', async () => {
    const appels = simulerFapshi()
    const { paiement } = await paiementFapshiEnAttente()
    await prisma.paiement.update({ where: { id: paiement.id }, data: { status: 'PAYE', confirmedAt: new Date() } })

    await api()
      .post('/api/paiements/webhook/fapshi')
      .set('x-wh-secret', SECRET)
      .send({ transId: paiement.fapshiTransId })
      .expect(200)

    assert.equal(appels.length, 0, 'un paiement déjà confirmé ne doit pas être relu')
    assert.equal(await prisma.notification.count({ where: { type: 'PAIEMENT_CONFIRME' } }), 0)
  })

  test('Fapshi injoignable à la relecture : rien n\'est confirmé', async () => {
    globalThis.fetch = async () => { throw new Error('réseau indisponible') }
    const { paiement } = await paiementFapshiEnAttente()

    await api()
      .post('/api/paiements/webhook/fapshi')
      .set('x-wh-secret', SECRET)
      .send({ transId: paiement.fapshiTransId })
      .expect(502)

    const p = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(p.status, 'EN_ATTENTE')
  })

  test('une transaction inconnue est rejetée', async () => {
    simulerFapshi()
    await api()
      .post('/api/paiements/webhook/fapshi')
      .set('x-wh-secret', SECRET)
      .send({ transId: 'inconnue' })
      .expect(404)
  })
})

describe('Tarifs — des montants réels, lus par l\'écran', () => {
  beforeEach(viderBase)
  afterEach(() => { globalThis.fetch = fetchOriginal })

  // 175 XAF valaient 27 centimes d'euro : un second avis ne peut pas coûter ça.
  test('le tarif standard est un montant significatif en XAF', async () => {
    const { user, patient } = await f.creerPatient()
    const dossier = await f.creerDossier({ patient, urgence: 'NORMAL' })

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/paiement/tarif`)
      .set('Authorization', entete(user))
      .expect(200)

    assert.equal(res.body.currency, 'XAF')
    assert.ok(res.body.amount >= 10000, `tarif ${res.body.amount} XAF : trop bas pour un second avis`)
    assert.equal(res.body.urgence, 'NORMAL')
  })

  test("l'urgence renchérit le tarif", async () => {
    const { user, patient } = await f.creerPatient()
    const standard = await f.creerDossier({ patient, urgence: 'NORMAL' })
    const urgent = await f.creerDossier({ patient, urgence: 'URGENT' })

    const a = await api().get(`/api/dossiers/${standard.id}/paiement/tarif`).set('Authorization', entete(user)).expect(200)
    const b = await api().get(`/api/dossiers/${urgent.id}/paiement/tarif`).set('Authorization', entete(user)).expect(200)

    assert.ok(b.body.amount > a.body.amount)
  })

  // Le montant facturé doit être celui que l'écran a affiché.
  test('le paiement créé porte le même montant que le tarif annoncé', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ code: '00', data: { payment_url: 'https://cinetpay/x' } }) })
    const { user, patient } = await f.creerPatient()
    const dossier = await f.creerDossier({ patient, urgence: 'PRIORITAIRE', status: 'EN_ATTENTE_PAIEMENT' })

    const tarif = await api().get(`/api/dossiers/${dossier.id}/paiement/tarif`).set('Authorization', entete(user)).expect(200)
    const init = await api().post(`/api/dossiers/${dossier.id}/paiement/init`).set('Authorization', entete(user)).expect(201)

    assert.equal(Number(init.body.paiement.amount), tarif.body.amount)
    assert.equal(init.body.paiement.currency, tarif.body.currency)
  })

  test("un tiers ne lit pas le tarif d'un dossier qui n'est pas le sien", async () => {
    const { patient } = await f.creerPatient()
    const autre = await f.creerPatient()
    const dossier = await f.creerDossier({ patient })

    await api().get(`/api/dossiers/${dossier.id}/paiement/tarif`).set('Authorization', entete(autre.user)).expect(403)
  })
})
