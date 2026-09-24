require('./helpers/env')
const { test, describe, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api, entete } = require('./helpers/http')
const f = require('./helpers/factories')
const env = require('../src/config/env')
const { trier } = require('../src/lib/triage')

// Même approche que paiement-fapshi.test.js : `fetch` est remplacé, pas le
// service, et la confirmation passe par le VRAI webhook - c'est la branche
// « recherche d'annuaire » de confirmerPaiement qu'on veut voir fonctionner.
const fetchOriginal = globalThis.fetch
const fapshiOriginal = { ...env.fapshi }
const SECRET = 'secret-de-test-annuaire'

function activerFapshi() {
  Object.assign(env.fapshi, { apiUser: 'utilisateur-test', apiKey: 'cle-test', webhookSecret: SECRET, environnement: 'sandbox' })
}

function simulerFapshi({ statut = 'SUCCESSFUL', transId = 'FAPSHI-ANN-1' } = {}) {
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith('/initiate-pay')) {
      return { ok: true, json: async () => ({ message: 'ok', link: 'https://checkout.fapshi.com/test/x', transId, dateInitiated: '2026-09-17' }) }
    }
    if (url.includes('/payment-status/')) {
      return { ok: true, json: async () => ({ transId, status: statut, amount: env.tarifs.ANNUAIRE, medium: 'mobile money' }) }
    }
    throw new Error('URL inattendue : ' + url)
  }
}

async function confirmerParWebhook(transId = 'FAPSHI-ANN-1') {
  return api().post('/api/paiements/webhook/fapshi').set('x-wh-secret', SECRET).send({ transId, status: 'SUCCESSFUL' }).expect(200)
}

// Un médecin prêt à être trouvé : volontaire, habilité, avec un vrai code pays.
async function medecinVisible({ specialites = ['medecine_generale'], ville = 'Douala', quartier = 'Logpom', ...reste } = {}) {
  const { user, medecinLocal } = await f.creerMedecinLocal(reste)
  const medecin = await prisma.medecinLocal.update({
    where: { id: medecinLocal.id },
    data: { annuaireVisible: true, annuaireSpecialites: specialites, pays: 'cm', ville, quartier, annuairePresentation: 'Cabinet ouvert du lundi au samedi.' },
  })
  await prisma.user.update({ where: { id: user.id }, data: { phone: '+237 6 99 00 00 00' } })
  return { user, medecin }
}

const SYMPTOMES_DERMATO = 'Des boutons qui grattent sur les bras depuis une semaine'

describe('Annuaire — triage des symptômes', () => {
  test('un drapeau rouge ferme la vente', () => {
    for (const s of [
      'douleur à la poitrine et essoufflement',
      'sa bouche est déviée et il ne peut plus bouger le bras',
      'envie de mourir',
      'je saigne beaucoup et ça ne s arrête pas',
    ]) assert.equal(trier(s).urgence, true, s)
  })

  test('des symptômes ordinaires orientent vers une spécialité, généraliste en filet', () => {
    const r = trier(SYMPTOMES_DERMATO)
    assert.equal(r.urgence, false)
    assert.equal(r.specialites[0], 'dermatologie')
    assert.ok(r.specialites.includes('medecine_generale'))
  })

  test('« dossier » ne réveille pas « dos »', () => {
    assert.deepEqual(trier('je dois compléter mon dossier médical').specialites, ['medecine_generale'])
  })
})

describe('Annuaire — recherche et floutage', () => {
  beforeEach(viderBase)
  after(fermerBase)

  test('sans compte, on obtient un nombre et des fiches floutées - jamais un nom ni un contact', async () => {
    const { user } = await medecinVisible({ specialites: ['dermatologie', 'medecine_generale'] })
    await medecinVisible({ specialites: ['cardiologie'] }) // hors sujet, ne doit pas ressortir

    const res = await api()
      .post('/api/annuaire/recherches')
      .send({ symptomes: SYMPTOMES_DERMATO, pays: 'cm', ville: 'Douala' })
      .expect(201)

    assert.equal(res.body.statut, 'FLOUTEE')
    assert.equal(res.body.urgence, false)
    assert.equal(res.body.nombre, 1)
    const fiche = res.body.resultats[0]
    assert.ok(fiche.specialites.includes('dermatologie'))
    assert.equal(fiche.ville, 'Douala')
    for (const champ of ['nom', 'telephone', 'email', 'quartier', 'etablissement', 'medecinId']) {
      assert.equal(fiche[champ], undefined, `${champ} ne doit pas fuiter avant paiement`)
    }
    const brut = JSON.stringify(res.body)
    assert.ok(!brut.includes(user.fullName), 'le nom du médecin ne doit apparaître nulle part')
    assert.ok(!brut.includes(user.email))
  })

  test('un médecin non volontaire, non habilité ou inactif ne ressort jamais', async () => {
    const visible = await medecinVisible({ specialites: ['dermatologie'] })
    // Même spécialité, mais pas volontaire.
    const nonVolontaire = await f.creerMedecinLocal()
    await prisma.medecinLocal.update({ where: { id: nonVolontaire.medecinLocal.id }, data: { annuaireSpecialites: ['dermatologie'], pays: 'cm' } })
    // Volontaire mais encore en vérification.
    await medecinVisible({ specialites: ['dermatologie'], verificationStatus: 'EN_VERIFICATION' })
    // Volontaire, habilité, mais compte désactivé.
    const inactif = await medecinVisible({ specialites: ['dermatologie'] })
    await prisma.user.update({ where: { id: inactif.user.id }, data: { active: false } })

    const res = await api().post('/api/annuaire/recherches').send({ symptomes: SYMPTOMES_DERMATO, pays: 'cm' }).expect(201)
    assert.equal(res.body.nombre, 1)
    assert.ok(visible.medecin)
  })

  test('la géographie classe sans exclure : même ville, puis même pays, puis le reste de la zone', async () => {
    const gabon = await medecinVisible({ specialites: ['dermatologie'], ville: 'Libreville' })
    await prisma.medecinLocal.update({ where: { id: gabon.medecin.id }, data: { pays: 'ga' } })
    await medecinVisible({ specialites: ['dermatologie'], ville: 'Yaoundé' })
    await medecinVisible({ specialites: ['dermatologie'], ville: 'Douala' })

    const res = await api().post('/api/annuaire/recherches').send({ symptomes: SYMPTOMES_DERMATO, pays: 'cm', ville: 'Douala' }).expect(201)
    assert.equal(res.body.nombre, 3, 'le dermatologue du Gabon ressort aussi : il peut résoudre le problème')
    assert.deepEqual(
      res.body.resultats.map((r) => r.ville),
      ['Douala', 'Yaoundé', 'Libreville'],
      'même ville, puis même pays, puis le reste de la zone',
    )
  })

  test('une urgence détectée : recherche enregistrée, zéro médecin, aucun paiement possible', async () => {
    await medecinVisible({ specialites: ['cardiologie', 'medecine_generale'] })
    const { user } = await f.creerPatient()

    const res = await api()
      .post('/api/annuaire/recherches')
      .set('Authorization', entete(user))
      .send({ symptomes: 'Forte douleur à la poitrine et je suis très essoufflé', pays: 'cm' })
      .expect(201)

    assert.equal(res.body.urgence, true)
    assert.equal(res.body.nombre, 0)

    const paiement = await api().post(`/api/annuaire/recherches/${res.body.id}/paiement`).set('Authorization', entete(user)).expect(400)
    assert.match(paiement.body.message, /urgence/i)
  })

  test('un pays hors CEMAC est refusé', async () => {
    await api().post('/api/annuaire/recherches').send({ symptomes: SYMPTOMES_DERMATO, pays: 'fr' }).expect(400)
  })
})

describe('Annuaire — mise en relation par paiement', () => {
  beforeEach(async () => {
    await viderBase()
    activerFapshi()
    simulerFapshi()
  })
  afterEach(() => {
    globalThis.fetch = fetchOriginal
    Object.assign(env.fapshi, fapshiOriginal)
  })
  after(fermerBase)

  async function rechercheAvecResultats() {
    const { user: medecinUser } = await medecinVisible({ specialites: ['dermatologie'] })
    const res = await api().post('/api/annuaire/recherches').send({ symptomes: SYMPTOMES_DERMATO, pays: 'cm' }).expect(201)
    return { rechercheId: res.body.id, medecinUser }
  }

  test('sans compte : un e-mail suffit, la confirmation par webhook révèle les coordonnées', async () => {
    const { rechercheId, medecinUser } = await rechercheAvecResultats()

    // Sans e-mail, rien ne part : le fournisseur en a besoin, et c'est tout ce
    // qui identifie la personne mise en relation.
    const sansEmail = await api().post(`/api/annuaire/recherches/${rechercheId}/paiement`).send({}).expect(400)
    assert.match(sansEmail.body.message, /e-mail/i)

    const init = await api().post(`/api/annuaire/recherches/${rechercheId}/paiement`).send({ email: 'patiente@exemple.cm' }).expect(201)
    assert.equal(init.body.amount, env.tarifs.ANNUAIRE)
    assert.equal(init.body.paiement.provider, 'FAPSHI', 'un patient camerounais passe par Fapshi')
    assert.equal(init.body.paiement.rechercheAnnuaireId, rechercheId)
    assert.equal(init.body.paiement.dossierId, null, 'un paiement de mise en relation ne porte aucun dossier')
    assert.match(init.body.paymentUrl, /checkout\.fapshi\.com/)

    const enBase = await prisma.rechercheAnnuaire.findUnique({ where: { id: rechercheId } })
    assert.equal(enBase.emailContact, 'patiente@exemple.cm')
    assert.equal(enBase.userId, null, 'sans session, la recherche ne se rattache à aucun compte')

    // Toujours floutée tant que rien n'est confirmé - et lisible par le lien.
    const avant = await api().get(`/api/annuaire/recherches/${rechercheId}`).expect(200)
    assert.equal(avant.body.statut, 'FLOUTEE')
    assert.equal(avant.body.resultats[0].telephone, undefined)

    // Fapshi notifie, le backend relit le statut, la recherche se débloque.
    const wh = await confirmerParWebhook()
    assert.equal(wh.body.status, 'PAYE')

    const apres = await api().get(`/api/annuaire/recherches/${rechercheId}`).expect(200)
    assert.equal(apres.body.statut, 'DEBLOQUEE')
    assert.ok(apres.body.debloqueeLe)
    const fiche = apres.body.resultats[0]
    assert.equal(fiche.nom, medecinUser.fullName)
    assert.equal(fiche.telephone, '+237 6 99 00 00 00')
    assert.equal(fiche.email, medecinUser.email)
    assert.equal(fiche.quartier, 'Logpom')
    assert.equal(fiche.pays, 'cm')

    const p = await prisma.paiement.findFirst({ where: { rechercheAnnuaireId: rechercheId } })
    assert.equal(p.status, 'PAYE')
  })

  test('connecté : l\'e-mail du compte est repris et la recherche devient privée', async () => {
    const { rechercheId } = await rechercheAvecResultats()
    const { user: patient } = await f.creerPatient()

    // Pas d'e-mail dans le corps : celui du compte fait foi.
    await api().post(`/api/annuaire/recherches/${rechercheId}/paiement`).set('Authorization', entete(patient)).send({}).expect(201)
    const enBase = await prisma.rechercheAnnuaire.findUnique({ where: { id: rechercheId } })
    assert.equal(enBase.emailContact, patient.email)
    assert.equal(enBase.userId, patient.id)

    // Rattachée : un autre compte ne la voit plus, un anonyme non plus.
    const { user: autre } = await f.creerPatient()
    await api().get(`/api/annuaire/recherches/${rechercheId}`).set('Authorization', entete(autre)).expect(403)
    await api().get(`/api/annuaire/recherches/${rechercheId}`).expect(403)
    await api().get(`/api/annuaire/recherches/${rechercheId}`).set('Authorization', entete(patient)).expect(200)
  })

  test('un webhook dont Fapshi ne confirme pas le succès ne débloque rien', async () => {
    const { rechercheId } = await rechercheAvecResultats()
    const { user } = await f.creerPatient()
    await api().post(`/api/annuaire/recherches/${rechercheId}/paiement`).set('Authorization', entete(user)).expect(201)

    simulerFapshi({ statut: 'PENDING' })
    await confirmerParWebhook()

    const r = await api().get(`/api/annuaire/recherches/${rechercheId}`).set('Authorization', entete(user)).expect(200)
    assert.equal(r.body.statut, 'FLOUTEE', 'PENDING n\'est pas un succès : on attend')
    assert.equal(r.body.resultats[0].telephone, undefined)
  })

  test('on ne fait pas payer une recherche sans résultat', async () => {
    // Pays ouvert mais base vide : la recherche aboutit, sans aucun médecin.
    const res = await api().post('/api/annuaire/recherches').send({ symptomes: SYMPTOMES_DERMATO, pays: 'cm' }).expect(201)
    assert.equal(res.body.nombre, 0)
    const { user } = await f.creerPatient()
    const r = await api().post(`/api/annuaire/recherches/${res.body.id}/paiement`).set('Authorization', entete(user)).expect(400)
    assert.match(r.body.message, /aucun médecin/i)
  })

  test('un pays sans paiement branché refuse la recherche', async () => {
    // Le Tchad n'est pas dans ANNUAIRE_PAYS_OUVERTS : laisser passer la
    // recherche conduirait le patient jusqu'au paiement, pour rien.
    const r = await api().post('/api/annuaire/recherches').send({ symptomes: SYMPTOMES_DERMATO, pays: 'td' }).expect(400)
    assert.match(r.body.message, /pas encore disponible/i)
    assert.equal(await prisma.rechercheAnnuaire.count(), 0, 'rien ne doit être enregistré')
  })

  test('une recherche déjà débloquée ne se paie pas deux fois', async () => {
    const { rechercheId } = await rechercheAvecResultats()
    const { user } = await f.creerPatient()
    await api().post(`/api/annuaire/recherches/${rechercheId}/paiement`).set('Authorization', entete(user)).expect(201)
    await confirmerParWebhook()
    await api().post(`/api/annuaire/recherches/${rechercheId}/paiement`).set('Authorization', entete(user)).expect(400)
  })
})

describe('Annuaire — réglages du médecin', () => {
  beforeEach(viderBase)
  after(fermerBase)

  test('un médecin habilité peut se rendre visible avec un pays CEMAC et des spécialités', async () => {
    const { user } = await f.creerMedecinLocal()
    const res = await api()
      .put('/api/annuaire/medecin/moi')
      .set('Authorization', entete(user))
      .send({ annuaireVisible: true, annuaireSpecialites: ['medecine_generale', 'pediatrie'], pays: 'cm', ville: 'Douala', quartier: 'Logpom' })
      .expect(200)
    assert.equal(res.body.annuaireVisible, true)
    assert.deepEqual(res.body.annuaireSpecialites, ['medecine_generale', 'pediatrie'])
    assert.equal(res.body.quartier, 'Logpom')
  })

  test('sans spécialité, sans pays CEMAC valide, ou non habilité : refusé', async () => {
    const { user } = await f.creerMedecinLocal()
    await api().put('/api/annuaire/medecin/moi').set('Authorization', entete(user))
      .send({ annuaireVisible: true, annuaireSpecialites: [] }).expect(400)
    // Un pays hors zone saisi à l'inscription (texte libre) ne suffit pas :
    // il faut choisir un code CEMAC. « CM » en majuscules, lui, est accepté.
    const { medecinLocal } = await f.creerMedecinLocal()
    await prisma.medecinLocal.update({ where: { id: medecinLocal.id }, data: { pays: 'France' } })
    const horsZone = await prisma.user.findUnique({ where: { id: medecinLocal.userId } })
    const r = await api().put('/api/annuaire/medecin/moi').set('Authorization', entete(horsZone))
      .send({ annuaireVisible: true, annuaireSpecialites: ['medecine_generale'] }).expect(400)
    assert.match(r.body.message, /CEMAC/)

    const { user: nonHabilite } = await f.creerMedecinLocal({ verificationStatus: 'EN_VERIFICATION' })
    await api().put('/api/annuaire/medecin/moi').set('Authorization', entete(nonHabilite))
      .send({ annuaireVisible: true, annuaireSpecialites: ['medecine_generale'], pays: 'cm' }).expect(403)
  })

  test('une ville hors de la liste du pays est refusée', async () => {
    const { user } = await f.creerMedecinLocal()
    await api().put('/api/annuaire/medecin/moi').set('Authorization', entete(user))
      .send({ annuaireVisible: true, annuaireSpecialites: ['medecine_generale'], pays: 'ga', ville: 'Douala' }).expect(400)
  })

  test('un patient ne touche pas aux réglages médecin', async () => {
    const { user } = await f.creerPatient()
    await api().put('/api/annuaire/medecin/moi').set('Authorization', entete(user)).send({ annuaireVisible: false }).expect(403)
  })
})
