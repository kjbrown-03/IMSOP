require('./helpers/env')
const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert/strict')

const { prisma, viderBase, fermerBase } = require('./helpers/db')
const { api, entete } = require('./helpers/http')
const f = require('./helpers/factories')
const push = require('../src/services/pushService')

const ABONNEMENT = {
  endpoint: 'https://web.push.apple.com/abonnement-de-test-1',
  keys: { p256dh: 'BPj_K7xQ8vF2nL9mQ4rT6wY1zA3cE5gH7jK9lM0nO2pQ', auth: 'cle-auth-de-test' },
}

describe('Notifications poussées', () => {
  beforeEach(viderBase)
  after(fermerBase)

  test("la clé publique est lisible sans être connecté", async () => {
    // La page la demande avant même de savoir si l'utilisateur acceptera.
    const res = await api().get('/api/push/cle')
    assert.equal(res.status, 200)
    assert.equal(typeof res.body.disponible, 'boolean')
  })

  test("un appareil s'abonne, et le même appareil qui se réabonne ne crée pas de doublon", async () => {
    const { user } = await f.creerPatient()

    await api().post('/api/push/abonnements').set('Authorization', entete(user)).send(ABONNEMENT).expect(201)
    await api().post('/api/push/abonnements').set('Authorization', entete(user)).send(ABONNEMENT).expect(201)

    const n = await prisma.pushSubscription.count({ where: { userId: user.id } })
    assert.equal(n, 1, 'le réabonnement doit remplacer, pas empiler')
  })

  test("s'abonner exige d'être connecté", async () => {
    await api().post('/api/push/abonnements').send(ABONNEMENT).expect(401)
  })

  // Sans ce filtre, connaître l'endpoint d'un tiers suffirait à le faire taire.
  test("on ne peut pas désabonner l'appareil de quelqu'un d'autre", async () => {
    const { user: victime } = await f.creerPatient()
    const { user: autre } = await f.creerPatient()

    await api().post('/api/push/abonnements').set('Authorization', entete(victime)).send(ABONNEMENT).expect(201)
    await api()
      .delete('/api/push/abonnements')
      .set('Authorization', entete(autre))
      .send({ endpoint: ABONNEMENT.endpoint })
      .expect(200)

    const reste = await prisma.pushSubscription.count({ where: { userId: victime.id } })
    assert.equal(reste, 1, "l'abonnement de la victime doit survivre")
  })

  // Ce que `PushSubscription.toJSON()` renvoie REELLEMENT dans un navigateur :
  // `expirationTime` y figure, souvent a null. Le schema le refusait, et
  // l'abonnement echouait sur « Requête invalide » alors que le navigateur
  // envoyait exactement ce que la norme prevoit. Vu sur un vrai telephone.
  test("l'objet exact produit par le navigateur est accepté", async () => {
    const { user } = await f.creerPatient()
    await api()
      .post('/api/push/abonnements')
      .set('Authorization', entete(user))
      .send({ ...ABONNEMENT, expirationTime: null })
      .expect(201)
  })

  test('un endpoint mal formé est refusé', async () => {
    const { user } = await f.creerPatient()
    await api()
      .post('/api/push/abonnements')
      .set('Authorization', entete(user))
      .send({ ...ABONNEMENT, endpoint: 'pas-une-url' })
      .expect(400)
  })

  // Ce qui s'affiche sur un écran verrouillé que n'importe qui peut lire.
  describe('contenu affiché', () => {
    test('aucun détail médical ne sort de la plateforme', () => {
      for (const type of ['MESSAGE', 'APPEL', 'DOSSIER', 'COORDINATION']) {
        const c = push.composer(type, { dossierId: 'abc-123' })
        const texte = `${c.titre} ${c.corps}`.toLowerCase()
        for (const mot of ['vih', 'cancer', 'diagnostic', 'résultat', 'symptôme', 'maladie']) {
          assert.ok(!texte.includes(mot), `« ${mot} » ne doit pas apparaître dans une notification`)
        }
      }
    })

    test("un appel est marqué urgent, une étape de dossier ne l'est pas", () => {
      assert.equal(push.composer('APPEL', {}).urgent, true)
      assert.equal(push.composer('DOSSIER', {}).urgent, false)
      assert.equal(push.composer('MESSAGE', {}).urgent, false)
    })

    test('le lien ramène au dossier concerné', () => {
      assert.equal(push.composer('MESSAGE', { dossierId: 'xyz' }).url, '/dossiers/xyz')
      // Sans dossier, on ne fabrique pas une URL cassée.
      assert.equal(push.composer('MESSAGE', {}).url, '/')
    })

    test('un type inconnu ne fait pas planter et retombe sur un texte générique', () => {
      const c = push.composer('TYPE_QUI_NEXISTE_PAS', {})
      assert.ok(c.titre && c.corps)
    })
  })

  describe("notification d'essai", () => {
    test("sans appareil abonné, l'essai répond franchement qu'il n'est pas parti", async () => {
      const { user } = await f.creerPatient()
      const res = await api().post('/api/push/essai').set('Authorization', entete(user))
      assert.equal(res.status, 409)
    })

    test("l'essai exige d'être connecté", async () => {
      await api().post('/api/push/essai').expect(401)
    })

    // Il dit ce qu'il est : reçu sur un écran verrouillé, on ne doit pas le
    // prendre pour une vraie alerte.
    test("le contenu de l'essai s'annonce comme un essai", () => {
      const c = push.composer('ESSAI', {})
      assert.match(`${c.titre} ${c.corps}`.toLowerCase(), /essai|fonctionne/)
    })
  })

  test("l'envoi à un utilisateur sans appareil ne lève pas", async () => {
    const { user } = await f.creerPatient()
    const r = await push.envoyer(user.id, 'MESSAGE', {})
    assert.equal(r.envoyes, 0)
  })
})
