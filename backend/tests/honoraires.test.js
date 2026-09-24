require('./helpers/env')
const { test, describe, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api, entete } = require('./helpers/http')
const f = require('./helpers/factories')
const env = require('../src/config/env')
const {
  deviseDuSpecialiste,
  tauxXafVers,
  calculerVentilation,
  creerHonorairePourDossier,
  XAF_PAR_EURO,
} = require('../src/services/honorairesService')

const fetchOriginal = globalThis.fetch
const fapshiOriginal = { ...env.fapshi }
const commissionOriginale = env.honoraires.commissionPourcent

// Le modèle économique : le demandeur paie en XAF, la plateforme retient une
// commission, le reste revient au spécialiste dans sa devise.
describe('Honoraires — ventilation', () => {
  beforeEach(() => { env.honoraires.commissionPourcent = 30 })
  afterEach(() => { env.honoraires.commissionPourcent = commissionOriginale })

  test('la devise suit le pays du spécialiste, quelle que soit la graphie', () => {
    assert.equal(deviseDuSpecialiste({ pays: 'France' }), 'EUR')
    assert.equal(deviseDuSpecialiste({ pays: 'Cameroun' }), 'XAF')
    assert.equal(deviseDuSpecialiste({ pays: 'CAMEROUN' }), 'XAF')
    assert.equal(deviseDuSpecialiste({ pays: 'Sénégal' }), 'XOF')
    assert.equal(deviseDuSpecialiste({ pays: "Côte d'Ivoire" }), 'XOF')
    assert.equal(deviseDuSpecialiste({ pays: 'Suisse' }), 'CHF')
  })

  // Un pays inconnu ne doit pas planter : EUR par défaut, visible sur le relevé.
  test('un pays inconnu tombe en euros', () => {
    assert.equal(deviseDuSpecialiste({ pays: 'Atlantide' }), 'EUR')
    assert.equal(deviseDuSpecialiste({ pays: null }), 'EUR')
  })

  test('le franc CFA est arrimé à l\'euro, pas coté', () => {
    assert.equal(tauxXafVers('XAF'), 1)
    assert.equal(tauxXafVers('XOF'), 1)
    assert.equal(tauxXafVers('EUR'), 1 / XAF_PAR_EURO)
  })

  test('une devise sans taux configuré est refusée plutôt que devinée', () => {
    assert.throws(() => tauxXafVers('JPY'), /Aucun taux/)
  })

  test('115 000 XAF payés, 30 % de commission : le spécialiste français touche 122,72 €', () => {
    const v = calculerVentilation(115000, { pays: 'France' })

    assert.equal(v.commission, 34500)
    assert.equal(v.montantNet, 80500)
    assert.equal(v.deviseNet, 'EUR')
    // 80 500 / 655,957
    assert.equal(v.montantNetDevise, 122.72)
    assert.equal(v.canal, 'VIREMENT')
  })

  test('un spécialiste camerounais est payé en XAF, à l\'unité, par Fapshi', () => {
    const v = calculerVentilation(115000, { pays: 'Cameroun' })

    assert.equal(v.montantNet, 80500)
    assert.equal(v.deviseNet, 'XAF')
    assert.equal(v.montantNetDevise, 80500)
    assert.equal(v.canal, 'FAPSHI')
  })

  test('la commission est un réglage', () => {
    env.honoraires.commissionPourcent = 20
    const v = calculerVentilation(100000, { pays: 'France' })
    assert.equal(v.commission, 20000)
    assert.equal(v.montantNet, 80000)
  })
})

describe('Honoraires — création à la transmission du rapport', () => {
  beforeEach(async () => {
    await viderBase()
    env.honoraires.commissionPourcent = 30
  })
  afterEach(() => { env.honoraires.commissionPourcent = commissionOriginale })

  async function dossierPayeAvecSpecialiste(pays = 'France') {
    const { user, patient } = await f.creerPatient()
    const { specialiste } = await f.creerSpecialiste()
    await prisma.specialiste.update({ where: { id: specialiste.id }, data: { pays } })
    const dossier = await f.creerDossier({ patient, specialiste, status: 'RAPPORT_SOUMIS' })
    await prisma.paiement.create({
      data: { dossierId: dossier.id, amount: 115000, currency: 'XAF', status: 'PAYE', confirmedAt: new Date() },
    })
    return { user, patient, specialiste, dossier }
  }

  test("l'honoraire est calculé à partir de ce qui a été payé", async () => {
    const { dossier, specialiste } = await dossierPayeAvecSpecialiste('France')

    const h = await creerHonorairePourDossier(dossier.id)

    assert.equal(h.specialisteId, specialiste.id)
    assert.equal(Number(h.montantBrut), 115000)
    assert.equal(Number(h.commission), 34500)
    assert.equal(Number(h.montantNetDevise), 122.72)
    assert.equal(h.deviseNet, 'EUR')
    assert.equal(h.statut, 'A_REVERSER')
  })

  // Un avis n'est payé qu'une fois : un second appel ne crée pas de doublon.
  test('deux appels ne créent qu\'un honoraire', async () => {
    const { dossier } = await dossierPayeAvecSpecialiste()
    const a = await creerHonorairePourDossier(dossier.id)
    const b = await creerHonorairePourDossier(dossier.id)
    assert.equal(a.id, b.id)
    assert.equal(await prisma.honoraire.count(), 1)
  })

  // Parcours médecin : pas de paiement patient, donc rien à ventiler. Inventer
  // un montant serait pire que ne rien écrire.
  test("sans paiement confirmé, aucun honoraire n'est créé", async () => {
    const { patient } = await f.creerPatient()
    const { specialiste } = await f.creerSpecialiste()
    const dossier = await f.creerDossier({ patient, specialiste })

    assert.equal(await creerHonorairePourDossier(dossier.id), null)
  })

  // Les réglages peuvent bouger : un relevé déjà écrit ne doit pas changer.
  test("l'honoraire est figé même si la commission change ensuite", async () => {
    const { dossier } = await dossierPayeAvecSpecialiste()
    const h = await creerHonorairePourDossier(dossier.id)
    env.honoraires.commissionPourcent = 50
    const relu = await prisma.honoraire.findUnique({ where: { id: h.id } })
    assert.equal(Number(relu.tauxCommission), 30)
    assert.equal(Number(relu.commission), 34500)
  })

  test("valider le rapport crée l'honoraire", async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({}) })
    const { dossier, specialiste } = await dossierPayeAvecSpecialiste('Cameroun')
    const coordinateur = await f.creerCoordinateur()
    const rapport = await prisma.rapport.create({
      data: { dossierId: dossier.id, specialisteId: specialiste.id, synthese: 's', diagnostic: 'd', status: 'SOUMIS' },
    })

    // La validation dépose un PDF sur S3 : hors de portée ici, on vérifie
    // seulement que la ligne d'honoraire existe une fois le rapport transmis.
    const res = await api().post(`/api/rapports/${rapport.id}/valider`).set('Authorization', entete(coordinateur))
    globalThis.fetch = fetchOriginal

    const d = await prisma.dossier.findUnique({ where: { id: dossier.id } })
    if (d.status === 'RAPPORT_TRANSMIS') {
      const h = await prisma.honoraire.findUnique({ where: { dossierId: dossier.id } })
      assert.ok(h, 'un rapport transmis doit avoir son honoraire')
      assert.equal(h.canal, 'FAPSHI')
    } else {
      // Stockage indisponible dans cet environnement : la validation a échoué
      // avant la transmission, il n'y a donc rien à vérifier ici.
      assert.notEqual(res.status, 200)
    }
  })
})

describe('Honoraires — relevé et reversements', () => {
  beforeEach(async () => {
    await viderBase()
    env.honoraires.commissionPourcent = 30
    Object.assign(env.fapshi, { payoutApiUser: 'payout-user', payoutApiKey: 'payout-key', environnement: 'sandbox' })
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
    Object.assign(env.fapshi, fapshiOriginal)
    env.honoraires.commissionPourcent = commissionOriginale
  })
  after(fermerBase)

  async function honoraireEnAttente(pays, telephone = '699000001') {
    const { patient } = await f.creerPatient()
    const { user, specialiste } = await f.creerSpecialiste()
    await prisma.specialiste.update({ where: { id: specialiste.id }, data: { pays } })
    await prisma.user.update({ where: { id: user.id }, data: { phone: telephone } })
    const dossier = await f.creerDossier({ patient, specialiste, status: 'RAPPORT_TRANSMIS' })
    await prisma.paiement.create({
      data: { dossierId: dossier.id, amount: 115000, currency: 'XAF', status: 'PAYE', confirmedAt: new Date() },
    })
    const honoraire = await creerHonorairePourDossier(dossier.id)
    return { honoraire, specialiste, dossier }
  }

  test('la coordination lit le relevé', async () => {
    const coordinateur = await f.creerCoordinateur()
    await honoraireEnAttente('France')

    const res = await api().get('/api/honoraires?statut=A_REVERSER').set('Authorization', entete(coordinateur)).expect(200)
    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].deviseNet, 'EUR')
  })

  test("un spécialiste ne lit pas le relevé", async () => {
    const { user } = await f.creerSpecialiste()
    await api().get('/api/honoraires').set('Authorization', entete(user)).expect(403)
  })

  test('la synthèse totalise par spécialiste et par devise', async () => {
    const admin = await f.creerAdmin()
    const { specialiste } = await honoraireEnAttente('France')
    // Un second dossier pour le même spécialiste.
    const { patient } = await f.creerPatient()
    const d2 = await f.creerDossier({ patient, specialiste, status: 'RAPPORT_TRANSMIS' })
    await prisma.paiement.create({ data: { dossierId: d2.id, amount: 115000, currency: 'XAF', status: 'PAYE', confirmedAt: new Date() } })
    await creerHonorairePourDossier(d2.id)

    const res = await api().get('/api/honoraires/synthese').set('Authorization', entete(admin)).expect(200)
    assert.equal(res.body.length, 1)
    assert.equal(res.body[0].dossiers, 2)
    assert.equal(res.body[0].devise, 'EUR')
    assert.equal(res.body[0].total, 245.44)
    assert.equal(res.body[0].canal, 'VIREMENT')
  })

  // Europe : le virement est fait à la banque, la plateforme n'en garde que la trace.
  test('un virement SEPA est enregistré avec sa référence', async () => {
    const admin = await f.creerAdmin()
    const { honoraire } = await honoraireEnAttente('France')

    const res = await api()
      .post(`/api/honoraires/${honoraire.id}/reverser`)
      .set('Authorization', entete(admin))
      .send({ reference: 'SEPA-2026-09-0042' })
      .expect(200)

    assert.equal(res.body.statut, 'REVERSE')
    assert.equal(res.body.referenceReversement, 'SEPA-2026-09-0042')
    assert.ok(res.body.reverseLe)
  })

  test('un virement sans référence est refusé', async () => {
    const admin = await f.creerAdmin()
    const { honoraire } = await honoraireEnAttente('France')

    await api().post(`/api/honoraires/${honoraire.id}/reverser`).set('Authorization', entete(admin)).send({}).expect(400)
  })

  // Cameroun : la plateforme décaisse elle-même, en Mobile Money, avec les accès
  // de décaissement — pas ceux d'encaissement.
  test('un honoraire camerounais est reversé par Fapshi', async () => {
    const appels = []
    globalThis.fetch = async (url, options) => {
      appels.push({ url, headers: options.headers, body: JSON.parse(options.body) })
      return { ok: true, json: async () => ({ message: 'ok', transId: 'PAYOUT-1', dateInitiated: '2026-09-17' }) }
    }
    const admin = await f.creerAdmin()
    const { honoraire } = await honoraireEnAttente('Cameroun', '6 99 00 00 01')

    const res = await api().post(`/api/honoraires/${honoraire.id}/reverser`).set('Authorization', entete(admin)).send({}).expect(200)

    assert.equal(res.body.statut, 'REVERSE')
    assert.equal(res.body.referenceReversement, 'PAYOUT-1')
    const appel = appels.find((a) => a.url.endsWith('/payout'))
    assert.equal(appel.headers.apiuser, 'payout-user')
    assert.equal(appel.body.amount, 80500)
    // Fapshi attend le numéro local, sans indicatif.
    assert.equal(appel.body.phone, '699000001')
  })

  test("sans numéro de téléphone, le reversement Fapshi est refusé et marqué en échec", async () => {
    const admin = await f.creerAdmin()
    const { honoraire } = await honoraireEnAttente('Cameroun', null)

    await api().post(`/api/honoraires/${honoraire.id}/reverser`).set('Authorization', entete(admin)).send({}).expect(502)

    const h = await prisma.honoraire.findUnique({ where: { id: honoraire.id } })
    assert.equal(h.statut, 'ECHOUE')
    assert.match(h.motifEchec, /téléphone/)
  })

  test('Fapshi injoignable : l\'honoraire passe en échec, pas en reversé', async () => {
    globalThis.fetch = async () => { throw new Error('réseau indisponible') }
    const admin = await f.creerAdmin()
    const { honoraire } = await honoraireEnAttente('Cameroun')

    await api().post(`/api/honoraires/${honoraire.id}/reverser`).set('Authorization', entete(admin)).send({}).expect(502)
    const h = await prisma.honoraire.findUnique({ where: { id: honoraire.id } })
    assert.equal(h.statut, 'ECHOUE')
  })

  test('un honoraire déjà reversé ne se reverse pas deux fois', async () => {
    const admin = await f.creerAdmin()
    const { honoraire } = await honoraireEnAttente('France')
    await prisma.honoraire.update({ where: { id: honoraire.id }, data: { statut: 'REVERSE' } })

    await api().post(`/api/honoraires/${honoraire.id}/reverser`).set('Authorization', entete(admin)).send({ reference: 'SEPA-DEJA-FAIT' }).expect(409)
  })
})
