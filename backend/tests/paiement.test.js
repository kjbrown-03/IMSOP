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

  /*
   * Idempotence : un fournisseur de paiement REJOUE ses notifications.
   *
   * Ce n'est pas une anomalie, c'est son fonctionnement : tant qu'il n'a pas recu
   * un accuse franc, il reessaie. Un reseau coupe au mauvais moment suffit.
   *
   * Sans garde, le rejeu renvoyait un second courriel au patient, empilait les
   * traces d'audit, et — le plus grave — remettait le dossier en
   * EN_ATTENTE_AFFECTATION alors qu'un coordinateur l'avait peut-etre deja
   * affecte. Un rejeu tardif faisait RECULER un dossier en cours de traitement.
   */
  test('un webhook rejoue ne confirme pas deux fois', async () => {
    const { dossier, paiement } = await creerPaiementEnAttente()
    simulerReponseCinetPay('ACCEPTED')

    const corps = { cpm_trans_id: paiement.cinetpayTransactionId, cpm_result: '00' }
    await api().post('/api/paiements/webhook').send(corps).expect(200)

    // Entre les deux appels, le dossier avance : c'est le cas qui fait mal.
    await prisma.dossier.update({ where: { id: dossier.id }, data: { status: 'AFFECTE' } })

    const second = await api().post('/api/paiements/webhook').send(corps)
    assert.equal(second.status, 200)

    const apres = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.equal(apres.status, 'AFFECTE', "le rejeu ne doit pas faire reculer le dossier")

    const traces = await prisma.auditLog.count({ where: { action: 'PAIEMENT_CONFIRME', entityId: paiement.id } })
    assert.equal(traces, 1, 'une seule confirmation doit etre tracee')

    const notifs = await prisma.notification.count({ where: { type: 'PAIEMENT_CONFIRME' } })
    assert.equal(notifs, 1, 'le patient ne doit etre prevenu qu une fois')
  })

  // Deux rejeux SIMULTANES : la lecture prealable ne les arrete pas, seule
  // l'ecriture conditionnelle de confirmerPaiement le fait.
  test('deux webhooks simultanes ne confirment pas deux fois', async () => {
    const { paiement } = await creerPaiementEnAttente()
    simulerReponseCinetPay('ACCEPTED')

    const corps = { cpm_trans_id: paiement.cinetpayTransactionId, cpm_result: '00' }
    await Promise.all([
      api().post('/api/paiements/webhook').send(corps),
      api().post('/api/paiements/webhook').send(corps),
    ])

    const traces = await prisma.auditLog.count({ where: { action: 'PAIEMENT_CONFIRME', entityId: paiement.id } })
    assert.equal(traces, 1, 'une seule confirmation malgre deux appels concurrents')
  })

  // Un paiement DEJA CONFIRME ne doit jamais basculer en echec : un webhook
  // tardif annoncant l'expiration reverrouillerait ce que le patient a paye.
  test("un echec tardif ne defait pas un paiement confirme", async () => {
    const { dossier, paiement } = await creerPaiementEnAttente()
    simulerReponseCinetPay('ACCEPTED')
    const corps = { cpm_trans_id: paiement.cinetpayTransactionId, cpm_result: '00' }
    await api().post('/api/paiements/webhook').send(corps).expect(200)

    simulerReponseCinetPay('REFUSED')
    await api().post('/api/paiements/webhook').send(corps).expect(200)

    const apres = await prisma.paiement.findUnique({ where: { id: paiement.id } })
    assert.equal(apres.status, 'PAYE', 'le paiement confirme doit le rester')
    const d = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    assert.notEqual(d.status, 'EN_ATTENTE_PAIEMENT', 'le dossier ne doit pas etre reverrouille')
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

  // Le volet financier ne regarde que le patient qui paie et la coordination qui
  // en repond.
  //
  // Ce test a longtemps ete en `todo` : la documentation promettait 403, le code
  // renvoyait 200, et personne n'avait tranche. Les routes de paiement ne
  // posaient aucun controle de role — elles verifiaient seulement l'acces au
  // dossier, lequel autorise le medecin traitant designe.
  //
  // Arbitrage rendu : le medecin traitant accompagne le parcours medical, pas la
  // transaction. Il garde l'acces au dossier, aux pieces et a la messagerie.
  test("le médecin traitant désigné est tenu à l'écart du volet financier", async () => {
    const { patient } = await creerPaiementEnAttente()
    const { user, medecinLocal } = await f.creerMedecinLocal()
    const dossier = await f.creerDossier({ patient, medecinLocal, status: 'EN_ATTENTE_PAIEMENT' })
    await prisma.paiement.create({
      data: { dossierId: dossier.id, amount: 150000, status: 'EN_ATTENTE', cinetpayTransactionId: `TX-med-${dossier.id.slice(0, 8)}` },
    })

    // Les quatre routes, pas seulement la consultation : initier ou simuler un
    // paiement a la place du patient ne le regarde pas davantage.
    for (const appel of [
      () => api().get(`/api/dossiers/${dossier.id}/paiement/status`),
      () => api().get(`/api/dossiers/${dossier.id}/paiement/tarif`),
      () => api().post(`/api/dossiers/${dossier.id}/paiement/init`),
      () => api().post(`/api/dossiers/${dossier.id}/paiement/simulate`),
    ]) {
      const res = await appel().set('Authorization', entete(user))
      assert.equal(res.status, 403)
    }
  })

  // Le patient, lui, doit continuer de passer : fermer l'acces au medecin ne
  // devait pas fermer la porte a celui qui paie.
  test('le patient garde accès à son propre paiement', async () => {
    const { user, dossier } = await creerPaiementEnAttente()
    const res = await api()
      .get(`/api/dossiers/${dossier.id}/paiement/status`)
      .set('Authorization', entete(user))
    assert.equal(res.status, 200)
  })
})
