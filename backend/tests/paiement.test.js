require('./helpers/env')
const { test, describe, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api, entete } = require('./helpers/http')
const f = require('./helpers/factories')

// CDC §24 — le webhook ne débloque jamais un dossier sur la seule foi de ce
// qu'on lui poste. Son URL est publique et connue de CinetPay : rien n'empêche
// un tiers d'y envoyer « statut : payé ». La seule source de vérité est la
// ré-interrogation de l'API CinetPay. Ces tests décrivent ce contrat.
//
// `fetch` global est remplacé plutôt que le module cinetpay.service : on
// vérifie ainsi que le service appelle bien l'API distante, au lieu de faire
// confiance à un module simulé qui masquerait sa disparition.
const fetchOriginal = globalThis.fetch

function simulerReponseCinetPay(statut) {
  const appels = []
  globalThis.fetch = async (url, options) => {
    appels.push({ url, body: JSON.parse(options.body) })
    return {
      ok: true,
      json: async () => ({ code: '00', data: { status: statut } }),
    }
  }
  return appels
}

function simulerCinetPayIndisponible() {
  globalThis.fetch = async () => {
    throw new Error('réseau indisponible')
  }
}

async function creerPaiementEnAttente() {
  const { user, patient } = await f.creerPatient()
  const dossier = await f.creerDossier({ patient, status: 'EN_ATTENTE_PAIEMENT' })
  const paiement = await prisma.paiement.create({
    data: {
      dossierId: dossier.id,
      amount: 150000,
      currency: 'XAF',
      status: 'EN_ATTENTE',
      cinetpayTransactionId: `TX-${dossier.id.slice(0, 8)}`,
    },
  })
  return { user, patient, dossier, paiement }
}

describe('Webhook de paiement', () => {
  beforeEach(async () => {
    await viderBase()
  })

  afterEach(() => {
    globalThis.fetch = fetchOriginal
  })

  after(async () => {
    await viderBase()
    await fermerBase()
  })

  test('un webhook annonçant un paiement accepté est vérifié auprès de CinetPay', async () => {
    const { paiement } = await creerPaiementEnAttente()
    const appels = simulerReponseCinetPay('ACCEPTED')

    const res = await api()
      .post('/api/paiements/webhook')
      .send({ cpm_trans_id: paiement.cinetpayTransactionId, cpm_result: '00' })

    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'PAYE')
    assert.equal(appels.length, 1, 'CinetPay doit être ré-interrogé exactement une fois')
    assert.match(appels[0].url, /payment\/check$/)
    assert.equal(appels[0].body.transaction_id, paiement.cinetpayTransactionId)
  })

  // Le test central : le webhook annonce un succès, CinetPay dit non.
  test("un webhook qui annonce un paiement refusé par CinetPay ne débloque rien", async () => {
    const { dossier, paiement } = await creerPaiementEnAttente()
    simulerReponseCinetPay('REFUSED')

    const res = await api()
      .post('/api/paiements/webhook')
      .send({ cpm_trans_id: paiement.cinetpayTransactionId, cpm_result: '00', cpm_amount: '150000' })

    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'ECHOUE')

    const apres = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(apres.status, 'ECHOUE')
    assert.equal(apres.confirmedAt, null)

    const dossierApres = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(dossierApres.status, 'EN_ATTENTE_PAIEMENT', "le dossier ne doit pas avancer")
  })

  test('le paiement confirmé fait avancer le dossier et laisse une trace', async () => {
    const { dossier, paiement } = await creerPaiementEnAttente()
    simulerReponseCinetPay('ACCEPTED')

    await api().post('/api/paiements/webhook').send({ cpm_trans_id: paiement.cinetpayTransactionId })

    const apres = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(apres.status, 'PAYE')
    assert.ok(apres.confirmedAt)

    const dossierApres = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(dossierApres.status, 'EN_ATTENTE_AFFECTATION')

    const trace = await prisma.auditLog.findFirst({ where: { action: 'PAIEMENT_CONFIRME', dossierId: dossier.id } })
    assert.ok(trace, 'une confirmation de paiement doit être auditée')
  })

  test('CinetPay injoignable : rien n\'est confirmé', async () => {
    const { dossier, paiement } = await creerPaiementEnAttente()
    simulerCinetPayIndisponible()

    const res = await api().post('/api/paiements/webhook').send({ cpm_trans_id: paiement.cinetpayTransactionId })

    assert.equal(res.status, 502)
    const apres = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(apres.status, 'EN_ATTENTE', 'en cas de doute, le paiement reste en attente')
    const dossierApres = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(dossierApres.status, 'EN_ATTENTE_PAIEMENT')
  })

  test('une transaction inconnue est rejetée', async () => {
    const appels = simulerReponseCinetPay('ACCEPTED')

    const res = await api().post('/api/paiements/webhook').send({ cpm_trans_id: 'TX-inventee' })

    assert.equal(res.status, 404)
    assert.equal(appels.length, 0, 'inutile de solliciter CinetPay pour une transaction qui n\'existe pas')
  })

  test('un webhook sans identifiant de transaction est rejeté', async () => {
    const res = await api().post('/api/paiements/webhook').send({ cpm_result: '00' })
    assert.equal(res.status, 400)
  })
})

// CDC §32 — le médecin traitant est explicitement tenu à l'écart du volet
// financier du dossier.
describe('Accès au statut de paiement', () => {
  beforeEach(async () => {
    await viderBase()
  })

  after(async () => {
    await viderBase()
  })

  test('le patient consulte le paiement de son dossier', async () => {
    const { user, dossier } = await creerPaiementEnAttente()

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/paiement/status`)
      .set('Authorization', entete(user))

    assert.equal(res.status, 200)
    assert.equal(res.body.status, 'EN_ATTENTE')
  })

  test("un patient tiers ne consulte pas le paiement d'un autre dossier", async () => {
    const { dossier } = await creerPaiementEnAttente()
    const tiers = await f.creerPatient()

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/paiement/status`)
      .set('Authorization', entete(tiers.user))

    assert.equal(res.status, 403)
  })

  // ÉCART CONNU, volontairement laissé en `todo` plutôt que supprimé.
  //
  // `docs/ecarts-implementation.md` (§32) affirme « le médecin local n'a
  // effectivement aucun accès au paiement », et backend/README.md reprend la
  // même garantie. Le code dit autre chose : `GET .../paiement/status` ne pose
  // aucun `requireRole`, il se contente de `loadDossierWithAccessCheck`, qui
  // autorise le médecin traitant désigné. Ce test renvoie donc 200 là où la
  // documentation promet 403.
  //
  // Le corriger est une décision produit, pas une évidence technique : on peut
  // défendre que le médecin traitant voie l'état d'avancement du paiement de
  // son patient. Tant que l'arbitrage n'est pas rendu, l'écart reste visible
  // ici à chaque exécution au lieu de dormir dans un document.
  test('le médecin traitant désigné est tenu à l\'écart du volet financier', { todo: 'écart documenté : le code renvoie 200, la doc annonce 403' }, async () => {
    const { patient } = await creerPaiementEnAttente()
    const { user, medecinLocal } = await f.creerMedecinLocal()
    const dossier = await f.creerDossier({ patient, medecinLocal, status: 'EN_ATTENTE_PAIEMENT' })
    await prisma.paiement.create({
      data: { dossierId: dossier.id, amount: 150000, status: 'EN_ATTENTE', cinetpayTransactionId: `TX-med-${dossier.id.slice(0, 8)}` },
    })

    const res = await api()
      .get(`/api/dossiers/${dossier.id}/paiement/status`)
      .set('Authorization', entete(user))

    assert.equal(res.status, 403)
  })
})
